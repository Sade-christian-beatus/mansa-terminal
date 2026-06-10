"""
MANSA Terminal — Pipeline RAG (Knowledge Base)
Indexe les documents macro-économiques africains dans la knowledge_documents table.

Phase 1 : Seed avec des résumés synthétiques par pays (texte structuré).
Phase 2 : Téléchargement des Article IV du FMI (PDF → extraction texte).

Sans pgvector activé, la recherche reste par country_id (suffisant pour MVP).
Avec pgvector : ajouter la colonne embedding et la requête par similarité cosine.
"""
import logging
import os
import textwrap
from datetime import datetime, timezone

from dagster import asset, AssetExecutionContext, RetryPolicy

logger = logging.getLogger(__name__)

# ── Résumés synthétiques par pays (seed initial) ────────────────────────────
# Format : {country_id: [{title, year, doc_type, content}]}
SEED_DOCUMENTS = {
    "NGA": [
        {
            "title": "Nigeria — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Nigeria — Profil Macro-Fiscal 2024

                ## Économie
                Le Nigeria est la plus grande économie d'Afrique avec un PIB nominal d'environ 477 Mds USD en 2024.
                La croissance du PIB réel atteint 3,1%, portée par les services (50% du PIB) et l'agriculture (24%).
                Le secteur pétrolier représente encore 90% des recettes d'exportation malgré la diversification en cours.

                ## Inflation et politique monétaire
                L'inflation IPC a atteint 32,5% fin 2024 (la plus élevée depuis 28 ans).
                La Banque Centrale du Nigeria (CBN) a relevé son taux directeur à 27,5% pour ancrer les anticipations.
                La réforme du taux de change de 2023 (unification du taux officiel et parallèle) a entraîné une dévaluation du naira de ~70%.

                ## Finances publiques
                Le déficit budgétaire est estimé à -4,6% du PIB en 2024.
                Le service de la dette consomme environ 96% des recettes fiscales fédérales.
                La dette publique totale (interne + externe) est d'environ 46% du PIB.

                ## Secteur externe
                Le compte courant est passé en déficit (-0,4% PIB) suite à la baisse de la production pétrolière.
                Les réserves de change sont à 33 Mds USD, soit environ 5 mois d'importations.
                Les IDE entrants restent limités à 0,3% du PIB malgré les réformes structurelles.

                ## Risques et perspectives
                ⚠️ Insécurité alimentaire dans le Nord-Est (Boko Haram, conflit)
                ⚠️ Chômage élevé (5,3% officiel, mais sous-emploi massif)
                ⚠️ Dépendance aux recettes pétrolières (volatilité du prix du brut)
                Perspectives positives : réforme des subventions carburant, digitalisation économique (Fintech hub d'Afrique)

                ## Points clés pour l'investisseur
                - Marché de 220M consommateurs → potentiel de croissance domestique
                - Risque change élevé (naira volatil)
                - Secteur bancaire : GTB, Zenith Bank, Access Bank sont bien capitalisés
                - À surveiller : NNPCL privatisation, fiscalité non-pétrolière
            """).strip(),
        }
    ],
    "ZAF": [
        {
            "title": "Afrique du Sud — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Afrique du Sud — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~400 Mds USD. Croissance anémique : 1,1% en 2024, pénalisée par les délestages électriques (loadshedding).
                La fin des coupures en 2024 ouvre une fenêtre de reprise.

                ## Finances publiques
                Déficit budgétaire : -5,0% du PIB. Dette publique : 75% du PIB (en hausse).
                Notation souveraine : Ba2/BB- (Moody's/S&P). Risque d'abaissement si les réformes SOE tardent.

                ## Inflation et politique monétaire
                Inflation IPC : 4,6% (dans la cible SARB 3-6%).
                SARB a amorcé un cycle de baisse des taux en 2024 (taux repo à 8%).

                ## Points clés pour l'investisseur
                - JSE = bourse la plus profonde d'Afrique (800+ Mds USD capitalisation)
                - Risque politique : gouvernement d'unité nationale (ANC + DA) post-élections 2024
                - Rand : devise flottante liquide, sensible au risque global
                - Eskom : privatisation partielle en cours, risque résiduel
            """).strip(),
        }
    ],
    "KEN": [
        {
            "title": "Kenya — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Kenya — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~120 Mds USD. Croissance : 5,0% (hub régional d'Afrique de l'Est).
                Secteurs moteurs : services financiers (Fintech/M-Pesa), tourisme, horticulture.

                ## Finances publiques
                Déficit budgétaire : -5,7% du PIB. Dette publique : 72% du PIB.
                Pression fiscale : manifestations de juin 2024 contre les hausses d'impôts.

                ## Points clés pour l'investisseur
                - M-Pesa (Safaricom) : écosystème fintech le plus avancé d'Afrique
                - Eurobond : Kenya a refinancé son eurobond 2024 de 2 Mds USD
                - NSE : capitalisation ~25 Mds USD
                - Risque politique : opposition active, instabilité potentielle
            """).strip(),
        }
    ],
    "EGY": [
        {
            "title": "Égypte — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Égypte — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~397 Mds USD. Croissance : 3,8% (accélération post-réformes FMI).
                Secteurs : tourisme, Canal de Suez (recettes en baisse suite tensions Mer Rouge), hydrocarbures.

                ## Finances publiques
                Déficit budgétaire : -8,0% du PIB. Dette publique : 95% du PIB.
                Programme FMI en cours (8 Mds USD, 2024-2026). Exigences : flottaison du EGP, consolidation fiscale.

                ## Politique monétaire
                Inflation IPC : 28,0% (en baisse depuis le pic de 40% en 2023).
                CBE : taux directeur à 27,25% (un des plus élevés au monde).
                Dévaluation du EGP de ~60% en mars 2024 (unification taux officiel/marché).

                ## Points clés pour l'investisseur
                - Recettes Canal de Suez -50% suite Houthis/tensions Mer Rouge
                - EGX30 : rebond fort post-dévaluation (+40% en 2024 en EGP)
                - Forte dépendance aux transferts GCC et tourisme
                ⚠️ Risque géopolitique : proximité Gaza, tensions régionales
            """).strip(),
        }
    ],
    "SEN": [
        {
            "title": "Sénégal — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Sénégal — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~32 Mds USD. Croissance estimée à 7,1% (démarrage production pétrolière et gazière).
                Transition vers pays producteur d'hydrocarbures (Sangomar = 1er champ pétrolier, GTA = gaz).

                ## Finances publiques
                Déficit initial révisé à -7,5% du PIB (audit FMI post-élections révèle déficit supérieur aux annonces).
                Dette publique : 76% du PIB (en hausse vs 70% annoncé).

                ## Zone UEMOA
                Membre de l'UEMOA (XOF, BCEAO). Taux directeur BCEAO : 3,5%.
                Critère déficit ≤3% du PIB non respecté en 2024.

                ## Points clés pour l'investisseur
                - Dividende pétrolier attendu : 4-6% points de croissance additionnels 2025-2030
                - Risque : gouvernance post-transition, redistribution des revenus pétroliers
                - BRVM : Sonatel = valeur phare (filiale Orange)
                - Eurobond : Sénégal émetteur régulier sur marchés internationaux
            """).strip(),
        }
    ],
    "CIV": [
        {
            "title": "Côte d'Ivoire — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Côte d'Ivoire — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~78 Mds USD. Croissance : 6,2% (l'une des plus dynamiques d'Afrique sub-saharienne).
                Premier producteur mondial de cacao (45% du marché mondial).

                ## Finances publiques
                Déficit budgétaire : -4,3% du PIB. Dette publique : 60% du PIB.
                Consolidation progressive engagée vers le critère UEMOA de 3%.

                ## Zone UEMOA
                Première économie de l'UEMOA (38% du PIB de la zone).
                BRVM (Abidjan) = première bourse de la zone UEMOA.

                ## Points clés pour l'investisseur
                - Risque cacao : prix volatils (record 2024), dépendance à 28% du PIB
                - Stabilité politique depuis 2011 (élections 2025 = risque à surveiller)
                - Émetteur eurobond régulier, spread UEMOA serré
                - Corridor Abidjan-Dakar = plus actif d'Afrique de l'Ouest
            """).strip(),
        }
    ],
    "MAR": [
        {
            "title": "Maroc — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Maroc — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~147 Mds USD. Croissance : 3,2% (séquelles sécheresse 2023 et séisme Al Haouz).
                Diversification réussie : phosphates (OCP = 1er exportateur mondial), automobile, tourisme.

                ## Finances publiques
                Déficit budgétaire : -4,4% du PIB. Dette publique : 70% du PIB.
                Programme de reconstruction post-séisme : 12 Mds USD sur 5 ans.

                ## Politique monétaire
                Inflation IPC : 3,9% (normalisée après pic 2023).
                Bank Al-Maghrib (BAM) : taux directeur à 2,75% (baisse en cours).

                ## Points clés pour l'investisseur
                - Hub logistique : Tanger Med = 1er port d'Afrique (9M TEU)
                - Investissement dans les énergies renouvelables (Noor, MASEN)
                - Candidature Coupe du Monde 2030 : investissements infrastructures
                - MASI (Casablanca) : 2ème bourse d'Afrique par capitalisation
            """).strip(),
        }
    ],
    "ETH": [
        {
            "title": "Éthiopie — Revue de l'économie 2024",
            "year": 2024,
            "doc_type": "MANSA_SUMMARY",
            "content": textwrap.dedent("""
                # Éthiopie — Profil Macro-Fiscal 2024

                ## Économie
                PIB nominal ~176 Mds USD (PPA). Croissance : 6,4% malgré les défis sécuritaires.
                2ème économie d'Afrique subsaharienne en PPA. Population : 130M habitants.
                Secteur agricole : 35% du PIB (café = principale export).

                ## Situation de la dette
                Éthiopie en restructuration de dette (G20 Cadre Commun, 2024).
                Dette extérieure : ~28 Mds USD. Accord avec créanciers bilatéraux attendu.

                ## Risques
                ⚠️ Conflit Tigré : cessez-le-feu 2022, mais reconstruction longue
                ⚠️ Inflation : 25% (pression alimentaire, dévaluation birr)
                ⚠️ Accès à la mer : sans littoral depuis indépendance Érythrée 1993

                ## Points clés pour l'investisseur
                - Addis-Abeba : hub continental (siège UA, UNECA)
                - Ethiopian Airlines : compagnie la plus rentable d'Afrique
                - Grand Barrage Renaissance (GERD) : enjeu géopolitique Nil
            """).strip(),
        }
    ],
}


@asset(
    name="knowledge_base_seed",
    description="Seed initial de la knowledge base RAG avec des résumés macro par pays",
    retry_policy=RetryPolicy(max_retries=2, delay=10),
    group_name="rag",
)
def knowledge_base_seed(context: AssetExecutionContext):
    """
    Insère les documents de la knowledge base MANSA dans la table knowledge_documents.
    Utilise un UPSERT pour ne pas dupliquer si re-lancé.
    """
    import sys
    import os

    # Ajouter le path de l'API au sys.path pour importer les modèles
    api_path = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "api")
    if api_path not in sys.path:
        sys.path.insert(0, api_path)

    try:
        from app.core.database import sync_engine
        from app.models.models import KnowledgeDocument
        from sqlalchemy.orm import Session
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        total_inserted = 0
        total_skipped = 0

        with Session(sync_engine) as session:
            for country_id, docs in SEED_DOCUMENTS.items():
                for doc_data in docs:
                    # Vérifier si le document existe déjà
                    existing = session.query(KnowledgeDocument).filter_by(
                        country_id=country_id,
                        title=doc_data["title"],
                        year=doc_data["year"],
                    ).first()

                    if existing:
                        total_skipped += 1
                        context.log.info(f"Skip (déjà présent): {doc_data['title']}")
                        continue

                    doc = KnowledgeDocument(
                        title=doc_data["title"],
                        doc_type=doc_data["doc_type"],
                        country_id=country_id,
                        content=doc_data["content"],
                        year=doc_data["year"],
                    )
                    session.add(doc)
                    total_inserted += 1
                    context.log.info(f"Inséré: {country_id} — {doc_data['title']}")

            session.commit()

        context.log.info(
            f"RAG Seed terminé : {total_inserted} insérés, {total_skipped} ignorés (doublons)"
        )
        return {"inserted": total_inserted, "skipped": total_skipped}

    except ImportError as e:
        context.log.warning(
            f"Impossible d'importer les modèles DB ({e}). "
            "Vérifiez que DATABASE_URL est configuré et que l'API est dans le PYTHONPATH."
        )
        return {"inserted": 0, "skipped": 0, "error": str(e)}
    except Exception as e:
        context.log.error(f"Erreur lors du seed RAG: {e}")
        raise
