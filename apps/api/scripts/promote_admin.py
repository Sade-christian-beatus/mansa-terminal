"""
MANSA Terminal — Promotion / rétrogradation d'un compte administrateur
=====================================================================

Définit le rôle d'un utilisateur (admin | analyst). L'utilisateur doit déjà
exister dans la table `users` (s'être connecté au moins une fois — le rôle est
créé via le sync Supabase).

Le rôle `admin` débloque les actions d'administration protégées par
`require_admin` (ex. déclenchement de la ré-ingestion des données).

Usage :
    python scripts/promote_admin.py user@email.com            # → admin
    python scripts/promote_admin.py user@email.com analyst    # → rétrograde
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

from app.core.config import settings

VALID_ROLES = {"admin", "analyst"}


async def set_role(email: str, role: str) -> None:
    if role not in VALID_ROLES:
        print(f"❌ Rôle invalide : '{role}'. Choix : {sorted(VALID_ROLES)}")
        return

    engine = create_async_engine(settings.database_url_async)
    async with AsyncSession(engine) as session:
        result = await session.execute(
            text("UPDATE users SET role = :role WHERE email = :email RETURNING id"),
            {"role": role, "email": email},
        )
        row = result.fetchone()
        if not row:
            print(f"❌ Utilisateur '{email}' introuvable. "
                  "Il doit s'être connecté au moins une fois.")
            await session.rollback()
        else:
            await session.commit()
            print(f"✅ {email} → rôle '{role}'")
    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage : python scripts/promote_admin.py user@email.com [admin|analyst]")
        sys.exit(1)
    email = sys.argv[1]
    role = sys.argv[2] if len(sys.argv) > 2 else "admin"
    asyncio.run(set_role(email, role))
