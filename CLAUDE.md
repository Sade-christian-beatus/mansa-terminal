# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MANSA Terminal is Africa's AI-Powered Macro-Fiscal Intelligence Platform — a full-stack monorepo providing real-time macroeconomic data and AI-powered analysis for 54 African countries.

**Stack:** Next.js 14 (TypeScript) · FastAPI (Python) · PostgreSQL 16 + TimescaleDB · Redis · Dagster · Anthropic Claude API

---

## Commands

### Frontend (`apps/web`)
```bash
cd apps/web
npm run dev        # Dev server on :3000
npm run build      # Production build
npm run lint       # ESLint
npm run type-check # tsc --noEmit
```

### Backend (`apps/api`)
```bash
cd apps/api
python -m uvicorn app.main:app --reload   # Dev server on :8000 (Swagger: /docs)
pytest tests/ -v --tb=short               # All tests
pytest tests/ -m unit                     # Unit tests only
pytest tests/ -m integration              # Integration tests only
alembic upgrade head                      # Apply migrations
alembic revision --autogenerate -m "desc" # Generate migration
alembic downgrade -1                      # Rollback one
```

### Data Pipelines (`data/pipelines`)
```bash
cd data/pipelines
dagster dev                                        # Dagster UI on :3001
dagster job execute -j daily_data_refresh
dagster job execute -j weekly_data_refresh
dagster job execute -j monthly_data_refresh
dagster job execute -j full_historical_refresh
```

### Docker (all services)
```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker compose -f infra/docker/docker-compose.dev.yml logs -f api
docker compose -f infra/docker/docker-compose.dev.yml down
```

---

## Architecture

### Repository Layout
```
apps/web/          Next.js 14 frontend
apps/api/          FastAPI backend
data/pipelines/    Dagster ETL orchestration
infra/docker/      Docker Compose + DB init SQL
.github/workflows/ CI (test → build → push to GHCR)
```

### Frontend (`apps/web/src/`)
- **App Router pages:** `/` (dashboard), `/ai` (AI chat), `/countries`, `/markets`, `/climate`, `/auth/login`, `/auth/register`
- **State:** Zustand (global) + TanStack React Query (server cache)
- **API client:** Axios wrapper in `lib/api.ts` injects JWT auth headers
- **Visualization:** Recharts for time-series charts, D3 for Africa heatmaps
- **next.config.js** proxies `/api/*` to the FastAPI backend

### Backend (`apps/api/app/`)
- **Routers:**
  - `auth.py` — JWT login/register/refresh (`/api/auth/*`)
  - `macro.py` — Country indicators + Africa heatmap (`/api/macro/*`)
  - `countries.py` — Country metadata (`/api/countries/*`)
  - `ai_analyst.py` — Claude streaming SSE (`POST /api/ai/analyze`)
  - `billing.py` — Stripe subscriptions (`/api/billing/*`)
  - `health.py` — Liveness check (`GET /health`)
- **DB models** (`models/models.py`): `User`, `Country`, `MacroIndicator` (time-series), `Subscription`, `AIQuery`, `KnowledgeDocument`
- **Auth:** JWT HS256 with refresh tokens via `core/security.py`; `Depends()` guards in `core/dependencies.py`
- **AI:** Anthropic SDK with streaming + RAG context injected before Claude call

### Data Pipelines (`data/pipelines/`)
- **Assets:** `imf_weo_all_indicators` → `imf_weo_to_database`, `worldbank_wdi_indicators`
- **Schedules:** daily @ 05:00 UTC (FX), weekly Mon @ 06:00 UTC, monthly 1st @ 07:00 UTC
- **Sensors:** staleness checks — triggers refresh if data >48h old
- **Sources:** IMF WEO (`imf.org/external/datamapper/api/v1`), World Bank WDI (`api.worldbank.org/v2`) — both unauthenticated

### Database
- TimescaleDB hypertables defined in `infra/docker/init-db.sql` for time-series `MacroIndicator` data
- Always use Alembic for schema changes — never raw DDL
- Two `DATABASE_URL` vars required: `DATABASE_URL` (asyncpg, used by FastAPI) and `DATABASE_URL_SYNC` (psycopg2, used by Alembic)

---

## Key Environment Variables

```
ANTHROPIC_API_KEY        Required for AI analyst
SECRET_KEY               App secret (32+ chars)
JWT_SECRET_KEY           JWT signing key (32+ chars)
DATABASE_URL             postgresql+asyncpg://...
DATABASE_URL_SYNC        postgresql://...
REDIS_URL                redis://localhost:6379/0
STRIPE_SECRET_KEY        Phase 2 billing
STRIPE_WEBHOOK_SECRET    Phase 2 billing
```

Copy `.env.example` to `.env` in `apps/api/` before starting the backend.

---

## Development Setup

1. Run `setup.ps1` (Windows) or `setup.sh` (Mac/Linux) from the project root
2. `docker compose -f infra/docker/docker-compose.dev.yml up -d` — starts PostgreSQL, Redis, API, Dagster
3. Or run services individually using the commands above

CI runs on every push/PR: pytest (with live PostgreSQL) + Next.js build + type-check + lint. Docker images are pushed to GHCR on `main` only.
