"""
MANSA Terminal - Service d'authentification
JWT : HS256 par défaut (dev), RS256 si JWT_PRIVATE_KEY/JWT_PUBLIC_KEY définis (prod)
Bcrypt pour les mots de passe
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt as pyjwt

from app.core.config import settings


# ---- Bcrypt ----

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ---- JWT helpers ----

def _signing_key() -> str:
    """Clé de signature : clé privée RS256 si dispo, sinon secret HS256."""
    return settings.JWT_PRIVATE_KEY or settings.JWT_SECRET_KEY


def _verify_key() -> str:
    """Clé de vérification : clé publique RS256 si dispo, sinon secret HS256."""
    return settings.JWT_PUBLIC_KEY or settings.JWT_SECRET_KEY


def _algorithm() -> str:
    return "RS256" if settings.JWT_PRIVATE_KEY else settings.JWT_ALGORITHM


# ---- Token creation ----

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return pyjwt.encode(to_encode, _signing_key(), algorithm=_algorithm())


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return pyjwt.encode(to_encode, _signing_key(), algorithm=_algorithm())


def create_email_verify_token(user_id: str) -> str:
    """JWT signé pour la vérification d'email (24 h)."""
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    return pyjwt.encode(
        {"sub": user_id, "type": "email_verify", "exp": expire},
        _signing_key(),
        algorithm=_algorithm(),
    )


# ---- Token verification ----

def decode_token(token: str) -> dict:
    """Décode et vérifie un JWT. Retourne {} si invalide ou expiré."""
    try:
        return pyjwt.decode(
            token,
            _verify_key(),
            algorithms=[_algorithm(), "HS256", "RS256"],  # tolérant pendant migration
        )
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return {}
