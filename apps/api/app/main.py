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
from app.routers import auth, health, macro, countries, ai_analyst, billing, markets


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---- Rate limiting ----
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)

# ---- Routers ----
app.include_router(health.router,     prefix="/health",        tags=["Health"])
app.include_router(auth.router,       prefix="/api/auth",      tags=["Auth"])
app.include_router(macro.router,      prefix="/api/macro",     tags=["Macro"])
app.include_router(countries.router,  prefix="/api/countries", tags=["Countries"])
app.include_router(ai_analyst.router, prefix="/api/ai",        tags=["AI Analyst"])
app.include_router(billing.router,    prefix="/api/billing",   tags=["Billing"])
app.include_router(markets.router,    prefix="/api/markets",   tags=["Markets"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "env": settings.APP_ENV,
        "docs": "/docs",
    }
