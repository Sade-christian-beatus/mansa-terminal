"""
MANSA Terminal — Service email
Envoi d'emails via SMTP (smtplib). Dégradation gracieuse si SMTP non configuré.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


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


def send_verification_email(to_email: str, token: str) -> bool:
    """
    Envoie l'email de vérification.
    Retourne True si envoyé, False sinon (ne lève pas d'exception).
    Si SMTP non configuré, logge le lien pour le dev local.
    """
    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "[DEV] Email verification not sent (SMTP not configured). "
            "Use this link: %s", verify_url
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Vérifiez votre email — MANSA Terminal"
        msg["From"] = f"MANSA Terminal <{settings.SMTP_USER}>"
        msg["To"] = to_email

        msg.attach(MIMEText(_build_verification_html(verify_url), "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_USER, to_email, msg.as_string())

        logger.info("Verification email sent to %s", to_email)
        return True

    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
        return False
