"""
MANSA Terminal — Router AI Analyst
Interface Claude API avec RAG sur la knowledge base MANSA
Streaming SSE vers le frontend
"""
import time
import json
from datetime import datetime, timezone
from typing import Annotated, AsyncIterator
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import anthropic

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_active_subscription
from app.core.limiter import limiter
from app.models.models import User, Subscription, AIQuery, KnowledgeDocument, MacroIndicator

router = APIRouter()
client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

# Pays africains pour extraction automatique
AFRICAN_COUNTRIES = {
    "nigeria": "NGA", "south africa": "ZAF",
    "kenya": "KEN", "ghana": "GHA", "egypt": "EGY", "morocco": "MAR",
    "senegal": "SEN", "sénégal": "SEN", "côte d'ivoire": "CIV",
    "ivory coast": "CIV", "cameroon": "CMR", "cameroun": "CMR",
    "ethiopia": "ETH", "éthiopie": "ETH", "tanzania": "TZA",
    "rwanda": "RWA", "uganda": "UGA", "zambia": "ZMB", "angola": "AGO",
    "mozambique": "MOZ", "togo": "TGO", "mali": "MLI", "niger": "NER",
    "burkina faso": "BFA", "benin": "BEN", "bénin": "BEN",
    "waemu": "WAEMU", "uemoa": "WAEMU", "cemac": "CEMAC",
    "west africa": "WAFR", "afrique de l'ouest": "WAFR",
    "east africa": "EAFR", "afrique de l'est": "EAFR",
}

SYSTEM_PROMPT = """Tu es MANSA Analyst, un analyste macro-fiscal senior spécialisé en Afrique subsaharienne et francophone, développé par MANSA Terminal.

Ton expertise couvre :
- Les frameworks analytiques du FMI (Article IV, WEO, DSA — Debt Sustainability Analysis)
- Les cadres de la Banque Mondiale (CPIA, PFM, WDI)
- La réglementation OHADA (droit des affaires en Afrique francophone)
- Les critères de convergence de l'UEMOA (zone XOF, 8 pays)
- La zone CEMAC (zone XAF, 6 pays d'Afrique centrale)
- La politique monétaire de la BCEAO et de la BEAC
- Les marchés financiers africains (BRVM, JSE, NSE, GSE)
- La finance climatique et les NDC africains

## Inventaire des données MANSA (141 indicateurs, 54 pays africains)

**Secteur réel (15)** — FMI WEO · Banque Mondiale WDI (annuel, décalage 6-12 mois)
Croissance PIB réel (NGDP_RPCH), PIB courant USD (NGDPD), PIB PPA (PPPGDP), PIB/habitant USD (NGDPDPC), PIB/habitant PPA (PPPPC), Déflateur PIB (NGDP_D), Inflation IPC (PCPIPCH), Prix fin d'année (PCPIEPCH), Inflation hors alimentation/énergie (PCPIX_PCT), Masse monétaire M2 (FM_LIPY), Taux de chômage (LUR), Chômage jeunes (LUR_YOUTH), Emploi informel (INF_EMPLOY_PCT), Population (LP), Croissance démographique (LPG)

**Fiscal & dette (15)** — FMI WEO · PEFA · GFS (annuel, décalage 6-18 mois)
Recettes totales %PIB (GGR_NGDP), Recettes fiscales %PIB (GGRT_NGDP), Pression fiscale (TAX_GDP), Dépenses totales %PIB (GGX_NGDP), Dépenses capital %PIB (GGXCG_NGDP), Solde budgétaire %PIB (GGXCNL_NGDP), Solde primaire %PIB (GGXONLB_NGDP), Dette publique %PIB (GGXWDG_NGDP), Dette extérieure publique (EXTD_PUB_GDP), Service de la dette %recettes (DS_REV), Intérêts %PIB (GGXWDN_NGDP), Intérêts %recettes (INT_REV), Financement monétaire %PIB (MON_FIN_GDP), Transferts sociaux %PIB (SOC_TRANS_GDP), Subventions énergie %PIB (ENRG_SUBS_GDP)

**Externe (13)** — FMI BOP · BM WDI · SWIFT (mensuel-trimestriel, décalage 3-9 mois)
Compte courant %PIB (BCA_NGDPD), Balance commerciale %PIB (TB_GDP), Exportations biens %PIB (BX_GSR_GNFS_CD), Importations biens %PIB (BM_GSR_GNFS_CD), IDE entrants %PIB (BX_KLT_DINV_WD_GD_ZS), IDE sortants %PIB (BM_KLT_DINV_WD_GD_ZS), Réserves mois d'importations (RI_IMP_M), Réserves change USD (RI_USD), Dette extérieure totale %PIB (EXTD_TOTAL_GDP), Service dette extérieure %exports (DS_EXP), Envois de fonds %PIB (REM_GDP), Taux de change USD (EXCH_USD), Volatilité change (EXCH_VOL)

**Financier (9)** — BM Global Findex · FMI FSI · banques centrales (annuel, décalage 12-18 mois)
Crédit secteur privé %PIB (FIN_PRIV_GDP), Crédit gouvernement %PIB (FIN_GOV_GDP), Accès services financiers %adultes (FINDEX_ACC), Mobile money %adultes (FINDEX_MOB), Ratio capital banques (CAR_PCT), Créances douteuses NPL (NPL_PCT), Marge taux d'intérêt (RATE_SPREAD), Capitalisation boursière %PIB (MKT_CAP_GDP), Volume trading annuel (MKT_VOL_USD)

**Mines & ressources (5)** — EITI · BM · sources nationales (annuel, décalage 6-18 mois)
Rentes ressources naturelles %PIB (NR_RENTS_GDP), Rentes pétrolières %PIB (OIL_RENTS_GDP), Rentes minières %PIB (MIN_RENTS_GDP), Recettes extractives %recettes (EXTRACTIVE_REV), Exportations matières premières %exports (COMM_EXP_PCT)

**Climat & énergie (7)** — CCPI · SE4ALL · WRI CAIT · BM (annuel, décalage 12-24 mois)
Émissions CO2/habitant (CO2_PC), Intensité carbone PIB (CO2_GDP), Accès électricité %population (ELEC_ACC), Accès rural électricité (ELEC_RURAL), Renouvelables %mix (REN_PCT), Pertes distribution électrique (ELEC_LOSS), Financement climatique USD (CLIM_FIN_USD)

**Social (6)** — PNUD · BM LSMS · UNICEF (annuel, décalage 12-24 mois)
Indice développement humain (HDI), Indice Gini (GINI), Taux pauvreté $2.15/j (POV_215), Mortalité infantile ‰ (IMR), Espérance de vie (LE), Taux alphabétisation adultes (LIT_ADULT)

**Secteur privé (4)** — BM Doing Business · WEF · Banque Mondiale (annuel, décalage 12-18 mois)
Classement facilité affaires (DB_RANK), Délai création entreprise jours (DB_START), Indice compétitivité global (GCI), Indice innovation (GII)

**Commerce (5)** — OMC · CNUCED · TRALAC (annuel, décalage 6-12 mois)
Exportations intrarégionales %exports (INTRA_EXP), Commerce intra-africain %PIB (INTRA_TRADE_GDP), Indice facilitation commerce (TFI), Droits tarifaires moyens (TARIFF_AVG), Complexité économique (ECI)

## Principes de tes analyses
1. RIGUEUR : Cite toujours tes sources (MANSA Data, FMI, Banque Mondiale, banques centrales)
2. CONTEXTE : Compare avec les pairs régionaux et les moyennes SSA (Sub-Saharan Africa)
3. NUANCE : Signale les limites des données et les incertitudes
4. ACTIONNABLE : Inclus des implications concrètes pour les investisseurs institutionnels
5. LANGUE : Réponds dans la même langue que la question (français ou anglais)

Format de réponse :
- Utilise des titres markdown pour structurer
- Inclus des données chiffrées avec leur millésime
- Signale avec ⚠️ les risques importants
- Termine par une section "Points clés pour l'investisseur"
"""


class QueryRequest(BaseModel):
    question: str
    language: str = "fr"  # fr ou en


def extract_countries(text: str) -> list[str]:
    """Extrait les codes pays africains mentionnés dans le texte"""
    text_lower = text.lower()
    found = []
    for name, code in AFRICAN_COUNTRIES.items():
        if name in text_lower and code not in found:
            found.append(code)
    return found


async def get_relevant_context(
    question: str,
    countries: list[str],
    db: AsyncSession,
) -> str:
    """
    RAG simplifié — récupère les documents pertinents de la knowledge base.
    En production, remplacer par une vraie recherche vectorielle pgvector.
    """
    context_parts = []

    # 1. Données macro récentes pour les pays mentionnés
    if countries and countries[0] not in ["WAEMU", "CEMAC", "WAFR", "EAFR"]:
        country_filter = [c for c in countries if len(c) == 3]
        if country_filter:
            result = await db.execute(
                select(MacroIndicator)
                .where(
                    MacroIndicator.country_id.in_(country_filter),
                    MacroIndicator.indicator_code.in_([
                        "NGDP_RPCH", "PCPIPCH", "GGXCNL_NGDP",
                        "GGXWDG_NGDP", "BCA_NGDPD", "NGDPDPC"
                    ]),
                    MacroIndicator.period >= "2022",
                )
                .order_by(MacroIndicator.country_id,
                          MacroIndicator.indicator_code,
                          MacroIndicator.period.desc())
                .limit(50)
            )
            indicators = result.scalars().all()

            if indicators:
                context_parts.append("## Données macro récentes (MANSA Database)\n")
                for ind in indicators:
                    context_parts.append(
                        f"- {ind.country_id} | {ind.indicator_code} | "
                        f"{ind.period}: {ind.value:.2f} ({ind.source})"
                    )

    # 2. Documents de la knowledge base (Article IV, rapports, etc.)
    if countries:
        docs_result = await db.execute(
            select(KnowledgeDocument)
            .where(KnowledgeDocument.country_id.in_(
                [c for c in countries if len(c) == 3]
            ))
            .order_by(KnowledgeDocument.year.desc())
            .limit(3)
        )
        docs = docs_result.scalars().all()
        for doc in docs:
            context_parts.append(
                f"\n## {doc.title} ({doc.year}) — {doc.doc_type}\n"
                f"{doc.content[:1500]}..."
            )

    return "\n".join(context_parts)


STARTER_MONTHLY_LIMIT = 50


@router.post("/query")
@limiter.limit("20/hour")
async def query_ai_analyst(
    request: Request,
    body: QueryRequest,
    sub: Annotated[Subscription, Depends(get_active_subscription)],
    db: AsyncSession = Depends(get_db),
):
    """
    Interroger le AI Analyst MANSA — réponse en streaming SSE.
    La réponse est streamée token par token vers le frontend.
    """
    # Vérifier le quota mensuel pour le plan Starter
    if sub.plan == "starter":
        first_of_month = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        count_result = await db.execute(
            select(func.count(AIQuery.id)).where(
                AIQuery.user_id == sub.user_id,
                AIQuery.created_at >= first_of_month,
            )
        )
        monthly_count = count_result.scalar() or 0
        if monthly_count >= STARTER_MONTHLY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Quota mensuel atteint ({STARTER_MONTHLY_LIMIT} requêtes/mois). "
                    "Passez au plan Professional pour un accès illimité."
                ),
            )

    start_time = time.time()
    countries = extract_countries(body.question)
    context = await get_relevant_context(body.question, countries, db)

    full_prompt = f"""
{f"## Contexte données MANSA{chr(10)}{context}{chr(10)}" if context else ""}
## Question
{body.question}
"""

    async def generate() -> AsyncIterator[str]:
        full_response = []
        input_tokens = 0
        output_tokens = 0

        try:
            async with client.messages.stream(
                model=settings.ANTHROPIC_MODEL_ID,
                max_tokens=settings.ANTHROPIC_MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": full_prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    full_response.append(text)
                    yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
                # get_final_message() doit être appelé dans le bloc async with
                message = await stream.get_final_message()
                input_tokens = message.usage.input_tokens
                output_tokens = message.usage.output_tokens

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            return

        # Sauvegarder la requête en base (dans un try séparé pour ne pas perdre le stream)
        duration_ms = int((time.time() - start_time) * 1000)
        query_id = ""
        try:
            ai_query = AIQuery(
                user_id=sub.user_id,
                question=body.question,
                response="".join(full_response),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                countries_mentioned=countries,
                duration_ms=duration_ms,
            )
            db.add(ai_query)
            await db.commit()
            query_id = str(ai_query.id)
        except Exception:
            pass  # La réponse a déjà été streamée — ne pas bloquer le signal done

        yield f"data: {json.dumps({'type': 'done', 'query_id': query_id})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Désactiver buffering nginx
        },
    )


@router.get("/history")
async def get_query_history(
    sub: Annotated[Subscription, Depends(get_active_subscription)],
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
):
    """Historique des requêtes de l'utilisateur"""
    result = await db.execute(
        select(AIQuery)
        .where(AIQuery.user_id == sub.user_id)
        .order_by(AIQuery.created_at.desc())
        .limit(limit)
    )
    queries = result.scalars().all()
    return [
        {
            "id": str(q.id),
            "question": q.question,
            "response_preview": q.response[:200] if q.response else None,
            "countries": q.countries_mentioned,
            "created_at": q.created_at.isoformat(),
            "tokens_used": (q.input_tokens or 0) + (q.output_tokens or 0),
        }
        for q in queries
    ]
