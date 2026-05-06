"""
MANSA Terminal — Dependencies FastAPI
Injection de dépendances : user courant, vérification abonnement
"""
from typing import Annotated
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import User, Subscription


def _extract_token(request: Request) -> str | None:
    """Lit le JWT depuis le cookie httpOnly en priorité, puis le header Bearer."""
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token or None


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extrait et valide l'utilisateur depuis le cookie httpOnly ou le Bearer token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _extract_token(request)
    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Compte inactif")
    return current_user


async def get_active_subscription(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
) -> Subscription:
    """Retourne l'objet Subscription actif de l'utilisateur, ou 402 si absent.
    En mode development, retourne un abonnement fictif pour les tests locaux."""
    from app.core.config import settings
    if settings.APP_ENV == "development":
        fake_sub = Subscription()
        fake_sub.user_id = current_user.id
        fake_sub.plan = "professional"
        fake_sub.status = "active"
        fake_sub.seats = 5
        fake_sub.is_active = True
        return fake_sub

    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_(["trialing", "active"])
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Abonnement requis. Rendez-vous sur /billing pour souscrire.",
        )
    return sub


async def require_active_subscription(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Vérifie que l'utilisateur a un abonnement actif (retourne User).
    En mode development, le check est bypassé pour faciliter les tests locaux."""
    from app.core.config import settings
    if settings.APP_ENV == "development":
        return current_user

    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_(["trialing", "active"])
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Abonnement requis. Rendez-vous sur /billing pour souscrire.",
        )
    return current_user


async def require_professional_plan(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Réservé aux plans Professional et Enterprise"""
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status.in_(["trialing", "active"]),
            Subscription.plan.in_(["professional", "enterprise"])
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cette fonctionnalité nécessite un plan Professional ou Enterprise.",
        )
    return current_user
