"""
MANSA Terminal — Router Auth
Inscription, connexion, refresh token — cookies httpOnly
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.limiter import limiter
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    create_email_verify_token, decode_token,
)
from app.models.models import User
from app.services.email import send_verification_email

router = APIRouter()


# --- Schémas Pydantic ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str | None


class RefreshRequest(BaseModel):
    refresh_token: str | None = None  # facultatif : lu depuis le cookie si absent


# --- Helper cookies ---
def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Pose les cookies httpOnly sur la réponse."""
    is_prod = settings.APP_ENV == "production"
    kwargs = dict(httponly=True, samesite="lax", secure=is_prod)

    response.set_cookie(
        "access_token", access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **kwargs,
    )
    response.set_cookie(
        "refresh_token", refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/auth/refresh",  # cookie envoyé uniquement au refresh endpoint
        **kwargs,
    )
    # Cookie lisible par JS/middleware pour savoir si connecté (pas le token lui-même)
    response.set_cookie(
        "mansa_auth", "1",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False, samesite="lax", secure=is_prod,
    )


# --- Endpoints ---
@router.post("/register", response_model=TokenResponse,
             status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Créer un nouveau compte MANSA"""
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        organization=data.organization,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    verify_token = create_email_verify_token(str(user.id))
    send_verification_email(user.email, verify_token)

    response = JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=TokenResponse(
            user_id=str(user.id),
            email=user.email,
            full_name=user.full_name,
        ).model_dump(),
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Connexion avec email + mot de passe"""
    result = await db.execute(
        select(User).where(User.email == data.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    response = JSONResponse(
        content=TokenResponse(
            user_id=str(user.id),
            email=user.email,
            full_name=user.full_name,
        ).model_dump(),
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.get("/me")
async def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    """Retourne les informations de l'utilisateur connecté"""
    return {
        "user_id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "organization": current_user.organization,
        "is_verified": current_user.is_verified,
    }


@router.post("/logout")
async def logout():
    """Déconnexion — supprime les cookies d'authentification"""
    response = JSONResponse(content={"message": "Déconnecté"})
    for cookie in ("access_token", "refresh_token", "mansa_auth"):
        response.delete_cookie(cookie, path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")
    return response


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Valide le token de vérification email et active le compte"""
    payload = decode_token(token)
    if not payload or payload.get("type") != "email_verify":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lien de vérification invalide ou expiré",
        )

    result = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if not user.is_verified:
        user.is_verified = True
        await db.commit()

    return {"message": "Email vérifié avec succès", "email": user.email}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    data: RefreshRequest = RefreshRequest(),
    db: AsyncSession = Depends(get_db),
):
    """Renouveler les tokens — lit le refresh_token depuis le cookie ou le corps"""
    raw_token = (
        request.cookies.get("refresh_token")
        or (data.refresh_token if data else None)
    )
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token manquant",
        )

    payload = decode_token(raw_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré",
        )

    result = await db.execute(
        select(User).where(User.id == payload.get("sub"), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable",
        )

    access_token = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    response = JSONResponse(
        content=TokenResponse(
            user_id=str(user.id),
            email=user.email,
            full_name=user.full_name,
        ).model_dump(),
    )
    _set_auth_cookies(response, access_token, new_refresh)
    return response
