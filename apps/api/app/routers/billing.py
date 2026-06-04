"""
MANSA Terminal — Router Billing
Stripe Checkout + Webhooks

Events Stripe gérés :
  checkout.session.completed       → Paiement initial OK → sub active
  customer.subscription.updated    → Changement de plan / fin de trial
  customer.subscription.deleted    → Résiliation → sub canceled
  invoice.payment_failed           → Échec de paiement → sub past_due
  customer.subscription.trial_will_end → Trial se termine dans 3j (notification)
"""
from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import stripe
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.models import User, Subscription

router = APIRouter()

# Stripe est initialisé uniquement si la clé est présente
if settings.STRIPE_SECRET_KEY:
    stripe.api_key = settings.STRIPE_SECRET_KEY

PLANS = {
    "starter": {
        "price_id": settings.STRIPE_PRICE_STARTER,
        "price_usd": 5000,
        "seats": 1,
        "name": "Starter",
        "features": [
            "1 siège",
            "54 pays — indicateurs de base",
            "AI Analyst (10 requêtes/jour)",
            "Export CSV",
        ],
    },
    "professional": {
        "price_id": settings.STRIPE_PRICE_PROFESSIONAL,
        "price_usd": 10000,
        "seats": 5,
        "name": "Professional",
        "features": [
            "5 sièges",
            "54 pays — couverture complète",
            "AI Analyst (50 requêtes/jour)",
            "Accès API",
            "Export Excel/PDF",
        ],
    },
    "enterprise": {
        "price_id": settings.STRIPE_PRICE_ENTERPRISE,
        "price_usd": 15000,
        "seats": 25,
        "name": "Enterprise",
        "features": [
            "25 sièges",
            "Toutes les fonctionnalités Pro",
            "MEAI — Economic Activity Index",
            "AI Analyst (200 requêtes/jour)",
            "Support dédié",
            "Données haute fréquence",
        ],
    },
}


class CheckoutRequest(BaseModel):
    plan: str
    # URLs dynamiques basées sur FRONTEND_URL pour éviter le hardcodage
    success_url: str | None = None
    cancel_url: str | None = None


# ── Plans (public) ─────────────────────────────────────────────────────────

@router.get("/plans")
async def get_plans():
    """Liste des plans disponibles (endpoint public)."""
    # Masquer les price_id internes Stripe
    return {
        name: {k: v for k, v in plan.items() if k != "price_id"}
        for name, plan in PLANS.items()
    }


# ── Checkout ───────────────────────────────────────────────────────────────

@router.post("/checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Crée une session Stripe Checkout pour upgrader l'abonnement."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Paiement non disponible. Contactez l'équipe MANSA.",
        )

    if request.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Plan invalide")

    plan = PLANS[request.plan]
    if not plan["price_id"]:
        raise HTTPException(
            status_code=503,
            detail="Ce plan n'est pas encore disponible. Contactez l'équipe MANSA.",
        )

    success_url = request.success_url or f"{settings.FRONTEND_URL}/billing/success"
    cancel_url = request.cancel_url or f"{settings.FRONTEND_URL}/billing"

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": plan["price_id"], "quantity": 1}],
        mode="subscription",
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        customer_email=current_user.email,
        metadata={
            "user_id": str(current_user.id),
            "plan": request.plan,
        },
    )
    return {"checkout_url": session.url}


# ── Webhook Stripe ─────────────────────────────────────────────────────────

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Réceptionne les events Stripe et met à jour l'état de la subscription en DB.
    La vérification de signature garantit que l'event vient bien de Stripe.
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook non configuré")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature webhook invalide")
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook invalide")

    event_type = event["type"]
    obj = event["data"]["object"]

    # ── checkout.session.completed ─────────────────────────────────────────
    # Paiement initial réussi → activer/mettre à jour la subscription
    if event_type == "checkout.session.completed":
        user_id = obj.get("metadata", {}).get("user_id")
        plan = obj.get("metadata", {}).get("plan")
        if not user_id or not plan or plan not in PLANS:
            return {"received": True}

        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()

        if sub:
            sub.plan = plan
            sub.status = "active"
            sub.stripe_customer_id = obj.get("customer")
            sub.stripe_subscription_id = obj.get("subscription")
            sub.seats = PLANS[plan]["seats"]
            sub.trial_ends_at = None   # Trial terminé — paiement effectué
        else:
            db.add(Subscription(
                user_id=user_id,
                plan=plan,
                status="active",
                stripe_customer_id=obj.get("customer"),
                stripe_subscription_id=obj.get("subscription"),
                seats=PLANS[plan]["seats"],
            ))

    # ── customer.subscription.updated ────────────────────────────────────
    # Changement de plan, fin de trial, renouvellement
    elif event_type == "customer.subscription.updated":
        stripe_sub_id = obj.get("id")
        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            new_status = obj.get("status", sub.status)
            # Mapping status Stripe → MANSA
            status_map = {
                "active": "active",
                "trialing": "trialing",
                "past_due": "past_due",
                "canceled": "canceled",
                "unpaid": "past_due",
                "incomplete": "past_due",
            }
            sub.status = status_map.get(new_status, new_status)

            # Mettre à jour current_period_end
            period_end = obj.get("current_period_end")
            if period_end:
                sub.current_period_end = datetime.fromtimestamp(
                    period_end, tz=timezone.utc
                )

            # Mettre à jour trial_ends_at si trial toujours en cours
            trial_end = obj.get("trial_end")
            if trial_end:
                sub.trial_ends_at = datetime.fromtimestamp(
                    trial_end, tz=timezone.utc
                )

    # ── customer.subscription.deleted ────────────────────────────────────
    # Résiliation définitive
    elif event_type == "customer.subscription.deleted":
        stripe_sub_id = obj.get("id")
        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "canceled"

    # ── invoice.payment_failed ────────────────────────────────────────────
    # Échec de prélèvement → passer en past_due (accès maintenu 7j par Stripe)
    elif event_type == "invoice.payment_failed":
        stripe_sub_id = obj.get("subscription")
        if stripe_sub_id:
            result = await db.execute(
                select(Subscription).where(
                    Subscription.stripe_subscription_id == stripe_sub_id
                )
            )
            sub = result.scalar_one_or_none()
            if sub:
                sub.status = "past_due"

    # ── customer.subscription.trial_will_end ─────────────────────────────
    # Trial se termine dans 3 jours — placeholder pour email de relance
    elif event_type == "customer.subscription.trial_will_end":
        pass   # TODO Phase 2 : envoyer un email de relance

    await db.commit()
    return {"received": True}


# ── Status abonnement ─────────────────────────────────────────────────────

@router.get("/status")
async def get_billing_status(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Retourne l'état de l'abonnement de l'utilisateur connecté."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return {"has_subscription": False, "plan": None, "status": None}

    return {
        "has_subscription": True,
        "plan": sub.plan,
        "status": sub.status,
        "seats": sub.seats,
        "is_active": sub.status in ("active", "trialing"),
        "trial_ends_at": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "current_period_end": (
            sub.current_period_end.isoformat() if sub.current_period_end else None
        ),
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
    }
