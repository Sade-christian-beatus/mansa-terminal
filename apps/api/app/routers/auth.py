"""
MANSA Terminal — Router Auth
Supabase Auth gère login / register / refresh / logout côté frontend.
Ce router expose uniquement :
  POST /sync  — synchronise un utilisateur Supabase dans notre table users
               (appelé par le frontend après signup ou premier login)
  GET  /me    — retourne les infos de l'utilisateur connecté
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.dependencies import get_current_active_user, _decode_supabase_token, _extract_token
from app.core.limiter import limiter
from app.models.models import User, Subscription

router = APIRouter()


# ── Schémas ────────────────────────────────────────────────────────────────

class SyncRequest(BaseModel):
    """Métadonnées optionnelles envoyées au moment de l'inscription."""
    full_name: str | None = None
    organization: str | None = None


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str | None
    organization: str | None
    is_verified: bool


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/sync", response_model=UserResponse)
@limiter.limit("10/minute")
async def sync_user(
    request: Request,
    body: SyncRequest = SyncRequest(),
    db: AsyncSession = Depends(get_db),
):
    """
    Synchronise un utilisateur Supabase dans notre table `users`.

    Appelé par le frontend après :
    - Une inscription (signUp) → crée l'utilisateur + abonnement trial
    - Un premier login OAuth → idem
    - Un login existant → retourne les infos sans rien créer

    Le JWT Supabase dans le header Authorization identifie l'utilisateur.
    Son `sub` (UUID Supabase) devient la clé primaire dans notre table.
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")

    payload = _decode_supabase_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    supabase_user_id = payload.get("sub")
    email = payload.get("email") or payload.get("user_metadata", {}).get("email", "")

    if not supabase_user_id or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token incomplet")

    import uuid
    user_uuid = uuid.UUID(supabase_user_id)

    # Chercher l'utilisateur existant
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if not user:
        # 1ère connexion — créer l'utilisateur dans notre table
        user_meta = payload.get("user_metadata") or {}
        user = User(
            id=user_uuid,
            email=email,
            hashed_password="supabase_managed",  # Auth déléguée à Supabase
            full_name=body.full_name or user_meta.get("full_name"),
            organization=body.organization or user_meta.get("organization"),
            is_active=True,
            is_verified=True,  # Supabase gère la vérification email
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        # Créer un abonnement trial 30j automatiquement
        trial_sub = Subscription(
            user_id=user.id,
            plan="professional",
            status="trialing",
            seats=1,
            trial_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        db.add(trial_sub)
        await db.commit()
        await db.refresh(user)
    elif body.full_name and not user.full_name:
        # Mettre à jour les métadonnées si manquantes
        user.full_name = body.full_name
        user.organization = body.organization or user.organization
        await db.commit()

    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        organization=user.organization,
        is_verified=user.is_verified,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retourne les informations de l'utilisateur connecté."""
    return UserResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        organization=current_user.organization,
        is_verified=current_user.is_verified,
    )
