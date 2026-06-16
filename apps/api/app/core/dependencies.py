"""
MANSA Terminal — Dependencies FastAPI
Injection de dépendances : user courant, vérification abonnement.

AUTH STRATEGY:
  Supabase Auth émet les JWTs (HS256, secret = SUPABASE_JWT_SECRET).
  FastAPI vérifie le token via l'en-tête Authorization: Bearer <token>.
  Le claim `sub` du JWT = UUID Supabase de l'utilisateur, utilisé comme
  clé primaire dans notre table `users` (synchronisée au 1er login).
"""
from typing import Annotated
import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User, Subscription


def _extract_token(request: Request) -> str | None:
    """Lit le JWT Supabase depuis le header Authorization: Bearer."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def _decode_supabase_token(token: str) -> dict:
    """
    Vérifie et décode un JWT émis par Supabase Auth.
    Retourne {} si invalide ou expiré.
    """
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        # En production, refuser les tokens non vérifiés
        if getattr(settings, "APP_ENV", "development") == "production":
            return {}
        # Dev uniquement : accepte sans vérification (ne jamais déployer sans secret)
        try:
            return pyjwt.decode(token, options={"verify_signature": False})
        except Exception:
            return {}
    try:
        return pyjwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return {}


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extrait l'utilisateur depuis le JWT Supabase (Authorization: Bearer).
    Le `sub` du JWT = UUID Supabase = clé primaire de notre table users.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Non authentifié",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(request)
    if not token:
        raise credentials_exception

    payload = _decode_supabase_token(token)
    if not payload:
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Compte inactif")
    return current_user


async def get_active_subscription(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Retourne l'abonnement actif. Raise 402 si absent."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_(["trialing", "active"]),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Abonnement requis. Contactez l'équipe MANSA pour accéder à la plateforme.",
        )
    return sub


async def require_active_subscription(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_(["trialing", "active"]),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Abonnement requis.",
        )
    return current_user


async def require_professional_plan(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
) -> User:
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_(["trialing", "active"]),
            Subscription.plan.in_(["professional", "enterprise"]),
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cette fonctionnalité nécessite un plan Professional ou Enterprise.",
        )
    return current_user
