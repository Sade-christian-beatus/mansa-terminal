"""
MANSA Terminal — Activation manuelle d'un abonnement (DEV ONLY)
Pour tester le AI Analyst sans configurer Stripe

Usage : python scripts/activate_test_subscription.py user@email.com
"""
import asyncio
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.core.config import settings


async def activate(email: str, plan: str = "professional"):
    if settings.is_production:
        print("❌ Ne PAS exécuter en production !")
        return

    engine = create_async_engine(settings.DATABASE_URL)

    async with AsyncSession(engine) as session:
        # Récupérer l'utilisateur
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": email}
        )
        row = result.fetchone()
        if not row:
            print(f"❌ Utilisateur '{email}' non trouvé")
            return

        user_id = row[0]

        # Insérer ou mettre à jour l'abonnement
        seats_map = {"starter": 1, "professional": 5, "enterprise": 25}
        await session.execute(text("""
            INSERT INTO subscriptions
              (id, user_id, plan, status, seats, created_at)
            VALUES
              (gen_random_uuid(), :uid, :plan, 'active', :seats, NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET plan = EXCLUDED.plan,
                status = 'active',
                seats = EXCLUDED.seats
        """), {"uid": user_id, "plan": plan, "seats": seats_map[plan]})
        await session.commit()

    await engine.dispose()
    print(f"✅ Abonnement '{plan}' activé pour {email}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python activate_test_subscription.py user@email.com [plan]")
        print("Plans: starter | professional | enterprise")
        sys.exit(1)

    email = sys.argv[1]
    plan = sys.argv[2] if len(sys.argv) > 2 else "professional"
    asyncio.run(activate(email, plan))
