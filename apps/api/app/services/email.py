"""
MANSA Terminal — Service email
Envoi d'emails via Resend API. Dégradation gracieuse si RESEND_API_KEY non configuré.
"""
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_SEND_URL = "https://api.resend.com/emails"


def _build_verification_html(verify_url: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background:#0A0F1E; color:#E2E8F0; padding:40px;">
  <div style="max-width:480px; margin:0 auto; background:#141B2E;
              border-radius:12px; padding:32px; border:1px solid #1E2A42;">
    <h2 style="color:#00D4AA; margin-top:0;">Vérifiez votre email</h2>
    <p>Bienvenue sur <strong>MANSA Terminal</strong>.</p>
    <p>Cliquez sur le bouton ci-dessous pour activer votre compte :</p>
    <a href="{verify_url}"
       style="display:inline-block; background:#00D4AA; color:#0A0F1E;
              font-weight:bold; padding:12px 24px; border-radius:8px;
              text-decoration:none; margin:16px 0;">
      Vérifier mon email
    </a>
    <p style="color:#6B7280; font-size:12px; margin-top:24px;">
      Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte,
      ignorez cet email.
    </p>
  </div>
</body>
</html>
"""


def _build_trial_expiry_html(days_left: int, upgrade_url: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background:#0A0F1E; color:#E2E8F0; padding:40px;">
  <div style="max-width:480px; margin:0 auto; background:#141B2E;
              border-radius:12px; padding:32px; border:1px solid #1E2A42;">
    <h2 style="color:#F59E0B; margin-top:0;">Votre essai se termine dans {days_left} jour(s)</h2>
    <p>Votre période d'essai gratuit de <strong>MANSA Terminal</strong> se termine bientôt.</p>
    <p>Pour continuer à accéder à toutes les fonctionnalités, passez à un plan payant :</p>
    <a href="{upgrade_url}"
       style="display:inline-block; background:#00D4AA; color:#0A0F1E;
              font-weight:bold; padding:12px 24px; border-radius:8px;
              text-decoration:none; margin:16px 0;">
      Choisir un plan
    </a>
    <p style="color:#6B7280; font-size:12px; margin-top:24px;">
      Starter dès 50$/mois · Professional dès 100$/mois · Enterprise sur mesure.
    </p>
  </div>
</body>
</html>
"""


def _send_via_resend(to_email: str, subject: str, html: str) -> bool:
    """Envoie un email via Resend API. Retourne True si succès."""
    if not settings.RESEND_API_KEY:
        return False

    try:
        response = httpx.post(
            RESEND_SEND_URL,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if response.status_code in (200, 201):
            logger.info("Email sent via Resend to %s (status %s)", to_email, response.status_code)
            return True
        else:
            logger.error("Resend API error %s: %s", response.status_code, response.text)
            return False
    except Exception as exc:
        logger.error("Failed to send email to %s via Resend: %s", to_email, exc)
        return False


def send_verification_email(to_email: str, token: str) -> bool:
    """
    Envoie l'email de vérification.
    Retourne True si envoyé, False sinon (ne lève pas d'exception).
    Si Resend non configuré, logge le lien pour le dev local.
    """
    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"

    if not settings.RESEND_API_KEY:
        logger.warning(
            "[DEV] Email verification not sent (RESEND_API_KEY not configured). "
            "Use this link: %s", verify_url
        )
        return False

    return _send_via_resend(
        to_email=to_email,
        subject="Vérifiez votre email — MANSA Terminal",
        html=_build_verification_html(verify_url),
    )


def send_trial_expiry_warning(to_email: str, days_left: int) -> bool:
    """Envoie un email d'avertissement de fin d'essai."""
    upgrade_url = f"{settings.FRONTEND_URL}/billing"

    if not settings.RESEND_API_KEY:
        logger.warning(
            "[DEV] Trial expiry warning not sent (RESEND_API_KEY not configured). "
            "User %s has %d day(s) left.", to_email, days_left
        )
        return False

    return _send_via_resend(
        to_email=to_email,
        subject=f"Votre essai MANSA Terminal se termine dans {days_left} jour(s)",
        html=_build_trial_expiry_html(days_left, upgrade_url),
    )
