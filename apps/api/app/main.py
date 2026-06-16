"""
MANSA Terminal — FastAPI Application Entry Point
"""
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.core.config import settings
from app.core.limiter import limiter
from app.routers import auth, health, macro, countries, ai_analyst, billing, markets, climate, news, alerts, acled, public_api, forecast


# ---- Logging structuré (JSON en prod, standard en dev) ----
class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        })


def _configure_logging() -> None:
    handler = logging.StreamHandler()
    if settings.APP_ENV == "production":
        handler.setFormatter(_JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        ))
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
        handlers=[handler],
        force=True,
    )


# ---- Sentry ----
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,       # 10 % des transactions tracées
        profiles_sample_rate=0.05,    # 5 % des transactions profilées
        send_default_pii=False,
    )


def _validate_required_env() -> None:
    """Bloque le démarrage si des variables critiques sont absentes en production."""
    import logging
    _log = logging.getLogger(__name__)

    # Variables qui font crasher l'app si absentes
    hard_required = []
    if not settings.ANTHROPIC_API_KEY:
        hard_required.append("ANTHROPIC_API_KEY")
    if not getattr(settings, "ANTHROPIC_MODEL_ID", None):
        hard_required.append("ANTHROPIC_MODEL_ID")
    if settings.APP_ENV == "production":
        if not getattr(settings, "SUPABASE_JWT_SECRET", None):
            hard_required.append("SUPABASE_JWT_SECRET")

    if hard_required:
        raise RuntimeError(
            f"Variables d'environnement manquantes : {', '.join(hard_required)}. "
            "Vérifiez votre fichier .env ou la configuration Railway."
        )

    # Variables optionnelles — warning seulement (fonctionnalité dégradée)
    if settings.APP_ENV == "production":
        if not getattr(settings, "STRIPE_WEBHOOK_SECRET", None):
            _log.warning(
                "STRIPE_WEBHOOK_SECRET absent — les webhooks Stripe seront rejetés. "
                "Ajoutez-la dans Railway si vous activez la facturation."
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    _validate_required_env()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "**MANSA Terminal** — Africa's Macro-Fiscal Intelligence Platform\n\n"
        "API publique pour économistes, data scientists et institutions.\n\n"
        "**Authentification** : `Authorization: Bearer mansa_xxx`\n\n"
        "Obtenez votre clé sur [mansa.ai/profile](https://mansa-terminal.vercel.app/profile)."
    ),
    debug=False,
    lifespan=lifespan,
    # Swagger accessible en production pour la doc publique de l'API
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---- Rate limiting ----
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---- Rate limit middleware par route pattern ----
@app.middleware("http")
async def route_rate_limit_headers(request: Request, call_next) -> Response:
    """
    Ajoute les headers X-RateLimit-* pour transparence client.
    Les limites réelles sont appliquées par slowapi sur les routes individuelles.
    Ici on expose les limites attendues par endpoint pour les clients API.
    """
    response = await call_next(request)
    path = request.url.path

    # Communiquer les limites par type de route
    if "/api/ai" in path:
        response.headers["X-RateLimit-Policy"] = "20/hour"
    elif "/api/auth" in path:
        response.headers["X-RateLimit-Policy"] = "10/minute"
    elif "/api/macro/export" in path:
        response.headers["X-RateLimit-Policy"] = "20/hour"
    elif "/api/markets" in path:
        response.headers["X-RateLimit-Policy"] = "60/minute"
    elif "/api/news" in path:
        response.headers["X-RateLimit-Policy"] = "30/minute"
    elif "/api/macro" in path:
        response.headers["X-RateLimit-Policy"] = "120/minute"
    elif "/api/acled" in path:
        response.headers["X-RateLimit-Policy"] = "60/minute"
    else:
        response.headers["X-RateLimit-Policy"] = "200/minute"

    return response


# ---- Request ID middleware ----
@app.middleware("http")
async def request_id_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    return response


# ---- Middlewares ----
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Accept"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
    max_age=600,
)

# ---- Routers ----
app.include_router(health.router,     prefix="/health",        tags=["Health"])
app.include_router(auth.router,       prefix="/api/auth",      tags=["Auth"])
app.include_router(macro.router,      prefix="/api/macro",     tags=["Macro"])
app.include_router(countries.router,  prefix="/api/countries", tags=["Countries"])
app.include_router(ai_analyst.router, prefix="/api/ai",        tags=["AI Analyst"])
app.include_router(billing.router,    prefix="/api/billing",   tags=["Billing"])
app.include_router(markets.router,    prefix="/api/markets",   tags=["Markets"])
app.include_router(climate.router,    prefix="/api/climate",   tags=["Climate"])
app.include_router(news.router,       prefix="/api/news",      tags=["News"])
app.include_router(alerts.router,     prefix="/api/alerts",    tags=["Alerts"])
app.include_router(acled.router,      prefix="/api/acled",     tags=["Conflicts"])
app.include_router(public_api.router, prefix="/api",           tags=["API Keys", "Public Data"])
app.include_router(forecast.router,   prefix="/api/forecast",  tags=["Forecasting"])


@app.get("/", tags=["Root"])
async def root():
    # Ne jamais exposer APP_ENV ni le nom des services internes en production
    return {
        "service": "MANSA Terminal API",
        "version": settings.APP_VERSION,
        "status": "operational",
    }
