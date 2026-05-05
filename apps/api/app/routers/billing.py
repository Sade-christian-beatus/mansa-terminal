"""
MANSA Terminal — Router Billing
Stripe Checkout + Webhooks
"""
from typing import Annotated
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
            "AI Analyst (50 requêtes/mois)",
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
            "AI Analyst illimité",
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
            "Support dédié",
            "Données haute fréquence",
            "Contrats sur mesure",
        ],
    },
}


class CheckoutRequest(BaseModel):
    plan: str
    success_url: str = "https://app.mansa.ai/billing/success"
    cancel_url: str = "https://app.mansa.ai/billing"


@router.get("/plans")
async def get_plans():
    """Liste des plans (public)"""
    return PLANS


@router.post("/checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    if request.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Plan invalide")

    plan = PLANS[request.plan]
    if not plan["price_id"]:
        raise HTTPException(
            status_code=503,
            detail="Stripe non configuré. Définir STRIPE_PRICE_* dans .env",
        )

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": plan["price_id"], "quantity": 1}],
        mode="subscription",
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        customer_email=current_user.email,
        subscription_data={
            "trial_period_days": 14,
            "metadata": {
                "user_id": str(current_user.id),
                "plan": request.plan,
            },
        },
        metadata={"user_id": str(current_user.id), "plan": request.plan},
    )
    return {"checkout_url": session.url}


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook invalide")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["user_id"]
        plan = session["metadata"]["plan"]

        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()

        if sub:
            sub.status = "active"
            sub.plan = plan
            sub.stripe_subscription_id = session.get("subscription")
            sub.seats = PLANS[plan]["seats"]
        else:
            db.add(Subscription(
                user_id=user_id,
                plan=plan,
                status="active",
                stripe_customer_id=session.get("customer"),
                stripe_subscription_id=session.get("subscription"),
                seats=PLANS[plan]["seats"],
            ))

    elif event["type"] == "customer.subscription.deleted":
        stripe_sub_id = event["data"]["object"]["id"]
        result = await db.execute(
            select(Subscription).where(
                Subscription.stripe_subscription_id == stripe_sub_id
            )
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "canceled"

    await db.commit()
    return {"received": True}


@router.get("/status")
async def get_billing_status(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
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
        "is_active": sub.is_active,
        "trial_ends_at": (sub.trial_ends_at.isoformat()
                          if sub.trial_ends_at else None),
        "current_period_end": (sub.current_period_end.isoformat()
                               if sub.current_period_end else None),
    }
