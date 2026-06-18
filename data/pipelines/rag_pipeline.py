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
    # ── Pays Tier 2 — Fiches synthétiques (46 pays restants) ─────────────────
    "DZA": [{"title": "Algérie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Algérie\n## Économie\nPIB ~240 Mds USD. Croissance 3.6%. Économie rentière (hydrocarbures = 85% exports, 40% PIB).\n## Finances publiques\nDéficit -5.8% PIB. Dette 60% PIB. Fonds de régulation des recettes (FRR) épuisé.\n## Politique monétaire\nInflation 9.2%. Dinar administré (DZD).\n## Points investisseur\n- 2ème réserves gaz Afrique (après Nigeria)\n- Marché 45M hab. mais accès IDE restrictif\n- Bourse Alger (COSOB) embryonnaire\n- À surveiller : transition énergétique, emploi jeunes"}],
    "TZA": [{"title": "Tanzanie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Tanzanie\n## Économie\nPIB ~85 Mds USD. Croissance 5.4%. Tourisme (Serengeti, Zanzibar), or, café.\n## Finances publiques\nDéficit -3.0% PIB. Dette 42% PIB. Conformité critères EAC.\n## Points investisseur\n- Hub gazier : réserves LNG Mtwara (projet Total/Shell)\n- Infrastructure : port Dar es Salaam, SGR (chemin de fer)\n- Stabilité politique sous Samia Suluhu Hassan\n- DSE (Dar es Salaam Stock Exchange) : 30+ émetteurs"}],
    "UGA": [{"title": "Ouganda — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Ouganda\n## Économie\nPIB ~55 Mds USD (PPA). Croissance 6.1%. Agriculture (café, thé), pêche, pétrole à venir.\n## Finances publiques\nDéficit -4.4% PIB. Dette 50% PIB.\n## Points investisseur\n- EACOP (oléoduc Ouganda-Tanzanie) : 3.5 Mds USD investissements\n- Pétrole du bassin du lac Albert (20 000 bpj attendus 2025)\n- USE (Uganda Securities Exchange) : 17 émetteurs\n- Risque : loi anti-LGBTQ+ → sanctions occidentales"}],
    "MOZ": [{"title": "Mozambique — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Mozambique\n## Économie\nPIB ~20 Mds USD. Croissance 5.5%. LNG Rovuma = transformateur (TotalEnergies, ENI, ExxonMobil).\n## Finances publiques\nDéficit -5.0% PIB. Dette 100% PIB (impact emprunts thon 2016).\n## Points investisseur\n- LNG Coral Sul (FLNG) : production active depuis 2022\n- LNG Rovuma Area 1 (TotalEnergies) : force majeure levée partiellement\n- Risque : insurrection jihadiste Cabo Delgado\n- Metical (MZN) : volatil"}],
    "ZMB": [{"title": "Zambie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Zambie\n## Économie\nPIB ~30 Mds USD. Croissance 4.8%. Cuivre = 70-80% exports (2ème producteur Afrique).\n## Finances publiques\nDéficit -7.6% PIB. Dette 137% PIB. Restructuration G20 Cadre Commun (accord 2023).\n## Points investisseur\n- Copper Belt : Copperbelt Energy, First Quantum, Glencore\n- Cobalt (sous-produit cuivre) : demande batteries EV\n- ZMW (kwacha) : rebond post-restructuration\n- LuSE (Lusaka SE) : capitalisation modeste"}],
    "RWA": [{"title": "Rwanda — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Rwanda\n## Économie\nPIB ~14 Mds USD. Croissance 7.0%. Services (60% PIB), tourisme (gorilles), tech hub.\n## Finances publiques\nDéficit -6.0% PIB. Dette 68% PIB. Aide international importante.\n## Points investisseur\n- Kigali = Singapore africain (doing business, gouvernance)\n- Rwanda Stock Exchange (RSE) : marché en développement\n- Hub aviation : RwandAir, Kigali International Airport expansion\n- Risque : proximité RDC, intervention M23"}],
    "TUN": [{"title": "Tunisie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Tunisie\n## Économie\nPIB ~47 Mds USD. Croissance 1.8%. Tourisme, phosphates, textile, huile d'olive.\n## Finances publiques\nDéficit -7.7% PIB. Dette 80% PIB. Négociations FMI bloquées.\n## Politique monétaire\nInflation 9.3%. Dinar (TND) sous pression.\n## Points investisseur\n- Crise politique : Saied concentre les pouvoirs\n- Fuite des cerveaux accélérée\n- BVMT (Bourse de Tunis) : 80 émetteurs\n- Phosphates (OCP concurrent) : Groupe Chimique Tunisien"}],
    "LBY": [{"title": "Libye — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Libye\n## Économie\nPIB ~50 Mds USD. Croissance 4.0%. Pétrole = 98% exports (réserves 9ème monde).\n## Situation politique\nDivision persistante : GNU (Tripoli) vs GNS (Benghazi). Production pétrolière ~1.2 Mbpj.\n## Points investisseur\n- Production stabilisée malgré tensions (NOC gérant nationalement)\n- Fonds souverain libyen (LIA) : 67 Mds USD actifs bloqués\n- Risque politique extrêmement élevé\n- Pas de bourse opérationnelle"}],
    "AGO": [{"title": "Angola — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Angola\n## Économie\nPIB ~90 Mds USD. Croissance 2.4%. Pétrole = 95% exports (1.1 Mbpj, 3ème Afrique).\n## Finances publiques\nDéficit -1.0% PIB. Dette 73% PIB. Kwanza (AOA) : flottement géré.\n## Points investisseur\n- Sonangol (NOC) en cours de réforme\n- Corridor ferroviaire Benguela : minéraux vers l'est\n- Bourse BODIVA (Luanda) : lancement 2019, croissance lente\n- Réserves 30 Mds USD (5 mois imports)"}],
    "CMR": [{"title": "Cameroun — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Cameroun\n## Économie\nPIB ~47 Mds USD. Croissance 4.1%. Cacao (4ème mondial), pétrole, bois, coton.\n## Finances publiques\nDéficit -2.5% PIB. Dette 48% PIB. Zone CEMAC — XAF/BEAC.\n## Points investisseur\n- Double conflit : anglophone NW/SW + ISWAP Extrême-Nord\n- Barrage de Lom Pangar : énergie hydroélectrique\n- Port de Douala : hub CEMAC\n- Doual'art, hub créatif émergent"}],
    "MLI": [{"title": "Mali — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Mali\n## Économie\nPIB ~22 Mds USD. Croissance 4.0%. Or (3ème Afrique), coton, agriculture.\n## Finances publiques\nDéficit -3.5% PIB. Dette 50% PIB. Zone UEMOA.\n## Points investisseur\n- Junte militaire + Wagner depuis 2021 → sanctions CEDEAO levées partiellement\n- Mines d'or : Barrick, Endeavour Mining opèrent malgré crise\n- BSIC, Bank of Africa : système bancaire fragile\n- Alliance Sahel (Burkina-Niger-Mali) hors CEDEAO"}],
    "BFA": [{"title": "Burkina Faso — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Burkina Faso\n## Économie\nPIB ~20 Mds USD. Croissance 2.5%. Or (1er export), coton, sésame.\n## Finances publiques\nDéficit -4.5% PIB. Dette 54% PIB. Zone UEMOA.\n## Points investisseur\n- Situation sécuritaire : pire du Sahel (60% territoire hors contrôle État)\n- Mines d'or opèrent sous forte pression sécuritaire\n- Junte Traore : posture anti-France, ouverture Wagner/Russie\n- BSIC, Coris Bank : résilience relative"}],
    "NER": [{"title": "Niger — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Niger\n## Économie\nPIB ~17 Mds USD. Croissance 12.3% (uranium + pétrole Agadem). Uranium = 5% world supply.\n## Finances publiques\nDéficit -6.8% PIB. Sanctions CEDEAO levées.\n## Points investisseur\n- Orano (uranium, Arlit) : 2ème producteur africain\n- Pétrole Agadem : oléoduc vers Cotonou (1.1 Mds USD)\n- Coup juillet 2023 : départ forces françaises/US\n- Zone UEMOA — XAF malgré tensions"}],
    "BEN": [{"title": "Bénin — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Bénin\n## Économie\nPIB ~22 Mds USD. Croissance 6.4%. Coton (1er Afrique de l'Ouest), réexports, pétrole offshore.\n## Finances publiques\nDéficit -4.7% PIB. Dette 54% PIB. Zone UEMOA.\n## Points investisseur\n- Port de Cotonou : débouché Niger, Burkina, Mali malgré crises\n- Pétrole offshore (bassin sédimentaire) : exploration active\n- BVMAC + BRVM : émetteur régulier Eurobond UEMOA\n- Stabilité politique : Talon réélu 2021"}],
    "TGO": [{"title": "Togo — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Togo\n## Économie\nPIB ~10 Mds USD. Croissance 6.0%. Phosphates (4ème mondial), ciment, réexports.\n## Finances publiques\nDéficit -3.8% PIB. Dette 69% PIB. Zone UEMOA.\n## Points investisseur\n- Port de Lomé : seul port en eau profonde Golfe de Guinée\n- OCP (Maroc) concurrent phosphates\n- Transition politique : Faure Gnassingbé (55 ans au pouvoir famille)\n- Hub hub financier sous-régional naissant"}],
    "GIN": [{"title": "Guinée — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Guinée\n## Économie\nPIB ~22 Mds USD. Croissance 6.5%. Bauxite (1er mondial, 25% world supply), or, diamants.\n## Finances publiques\nDéficit -3.3% PIB. Dette 35% PIB.\n## Points investisseur\n- CBG, SMB-Winning, Guinea Alumina : bauxite vers Chine\n- Barrage Souapiti : énergie hydroélectrique\n- Coup 2021 : Doumbouya, transition politique\n- Franc guinéen (GNF) : dévaluation chronique"}],
    "COD": [{"title": "RD Congo — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# République Démocratique du Congo\n## Économie\nPIB ~65 Mds USD. Croissance 6.3%. Cobalte (70% mondial), cuivre, coltan, or.\n## Finances publiques\nDéficit -1.0% PIB. Dette 15% PIB (faible).\n## Points investisseur\n- Glencore, Ivanhoe (Kamoa-Kakula = 2ème mine cuivre monde)\n- Cobalt = batterie EV : position géostratégique unique\n- Conflit Est-RDC : M23/RDF empêche exploitation Kivu\n- CDF (franc congolais) : très volatile"}],
    "COG": [{"title": "Congo Brazzaville — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Congo (Brazzaville)\n## Économie\nPIB ~15 Mds USD. Croissance 4.1%. Pétrole = 80% exports. Zone CEMAC.\n## Finances publiques\nDéficit -0.3% PIB. Dette 89% PIB (post-restructuration Chine).\n## Points investisseur\n- Total Energies : principal opérateur offshore\n- Dette restructurée avec Chine (2021-2025)\n- Sassou Nguesso : 40 ans au pouvoir\n- BVMAC (Bourse régionale CEMAC, Libreville) : marché embryonnaire"}],
    "GAB": [{"title": "Gabon — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Gabon\n## Économie\nPIB ~20 Mds USD. Croissance 2.5%. Pétrole (90% exports, déclin), manganèse (2ème mondial), bois.\n## Finances publiques\nDéficit -1.8% PIB. Dette 75% PIB. Zone CEMAC.\n## Points investisseur\n- Coup août 2023 (Brice Oligui) : transition en cours\n- Comilog (filiale Eramet) : manganèse\n- Réserves biologiques (13% territoire)\n- Obligation BVMAC indexée forêt tropicale"}],
    "TCD": [{"title": "Tchad — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Tchad\n## Économie\nPIB ~13 Mds USD. Croissance 3.0%. Pétrole (Doba Basin, SHT), coton, élevage.\n## Finances publiques\nDéficit -1.0% PIB. Dette 45% PIB. Zone CEMAC.\n## Points investisseur\n- Oléoduc Tchad-Cameroun (ExxonMobil/Glencore) : déclin production\n- Transition politique sous Mahamat Déby Itno\n- Frontalier Soudan : afflux réfugiés (1M+)\n- N'Djamena : hub humanitaire mais investissement privé limité"}],
    "CAF": [{"title": "Centrafrique — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# République Centrafricaine\n## Économie\nPIB ~2.5 Mds USD. Croissance 1.5%. Diamants, or, bois, café.\n## Finances publiques\nDéficit -5.0% PIB. Dette 60% PIB. Zone CEMAC.\n## Points investisseur\n- Pays parmi les plus pauvres (IDH 188/189)\n- Présence Wagner massive : exploitation minière artisanale\n- Sanctions Kimberley Process (diamants de sang levées partiellement)\n- Stabilité très précaire hors Bangui"}],
    "GNQ": [{"title": "Guinée Équatoriale — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Guinée Équatoriale\n## Économie\nPIB ~12 Mds USD. Croissance -2.0%. Pétrole (déclin), LNG (Punta Europa = 3ème terminal GNL Afrique).\n## Finances publiques\nDéficit -6.5% PIB. Dette 47% PIB. Zone CEMAC.\n## Points investisseur\n- Marathon Oil, Noble Energy : opérateurs historiques\n- Punta Europa LNG : contrats long terme Asie\n- Obiang Nguema : 44 ans au pouvoir\n- IDH très faible malgré richesse pétrolière"}],
    "MUS": [{"title": "Maurice — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Maurice (Île Maurice)\n## Économie\nPIB ~14 Mds USD. Croissance 5.6%. Services financiers (40% PIB), tourisme, textile.\n## Finances publiques\nDéficit -4.0% PIB. Dette 85% PIB.\n## Points investisseur\n- Juridiction préférée pour investir en Afrique subsaharienne (traités fiscaux)\n- SEM (Stock Exchange of Mauritius) : 130+ émetteurs\n- Fintech hub en développement\n- Rupee mauricienne (MUR) : stable mais déficit courant élevé"}],
    "BWA": [{"title": "Botswana — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Botswana\n## Économie\nPIB ~20 Mds USD. Croissance 3.5%. Diamants (25% PIB, 80% exports) — Debswana (De Beers/État).\n## Finances publiques\nDéficit -1.5% PIB. Dette 19% PIB (faible). Fonds souverain Pula Fund.\n## Points investisseur\n- Transition: De Beers renégocie accord avec État (51% désiré)\n- BSE (Botswana Stock Exchange) : marché développé pour la région\n- Pula (BWP) : l'une des devises les plus stables d'Afrique\n- Risque : concentration sur diamants, diversification urgente"}],
    "NAM": [{"title": "Namibie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Namibie\n## Économie\nPIB ~12 Mds USD. Croissance 3.6%. Uranium (4ème mondial), diamants, pêche, pétrole offshore.\n## Finances publiques\nDéficit -5.2% PIB. Dette 68% PIB.\n## Points investisseur\n- Pétrole offshore Graff/Venus (TotalEnergies) : découverte majeure 2022-2023\n- Green hydrogen Hyphen project (10 Mds USD)\n- NSX (Namibia Stock Exchange) : double cotation JSE\n- Dollar namibien (NAD) : paritaire ZAR"}],
    "ZWE": [{"title": "Zimbabwe — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Zimbabwe\n## Économie\nPIB ~30 Mds USD. Croissance 3.0%. Tabac, platine, lithium, or.\n## Situation monétaire\nInflation 165% (ZiG — Zimbabwe Gold — lancé 2024 pour remplacer ZWL).\n## Points investisseur\n- Lithium : réserves importantes (Arcadia, Bikita) → batteries EV\n- Platine : 2ème réserves mondiales\n- Hyperinflation chronique : risque devise majeur\n- ZSE (Zimbabwe Stock Exchange) : dollarisé USD depuis 2009"}],
    "MDG": [{"title": "Madagascar — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Madagascar\n## Économie\nPIB $15 Mds USD. Croissance 4.8%. Vanille (80% mondial), nickel-cobalt (Ambatovy), ilménite.\n## Finances publiques\nDéficit -4.8% PIB. Dette 57% PIB.\n## Points investisseur\n- Ambatovy (Sherritt Int.) : nickel + cobalt → batteries\n- Vanille : marché volatil (cyclones, prix)\n- Bourse BMOI (naissante)\n- Ariary (MGA) : dépréciation tendancielle"}],
    "MWI": [{"title": "Malawi — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Malawi\n## Économie\nPIB $7 Mds USD. Croissance 1.8%. Tabac (55% exports), thé, sucre.\n## Finances publiques\nDéficit -7.0% PIB. Dette 92% PIB. Très dépendant aide externe.\n## Points investisseur\n- Dévaluation kwacha (MWK) -40% en 2023 (programme FMI)\n- Pas de débouché maritime (enclavé) — dépend ports Mozambique/Tanzanie\n- MSE (Malawi Stock Exchange) : très petit\n- Risque cyclone/inondations (Freddy 2023)"}],
    "SLE": [{"title": "Sierra Leone — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Sierra Leone\n## Économie\nPIB $5.5 Mds USD. Croissance 3.5%. Rutile (1er mondial), diamants, bauxite, fer.\n## Finances publiques\nDéficit -8.3% PIB. Dette 82% PIB. Programme FMI actif.\n## Points investisseur\n- Sierra Rutile (Iluka Resources) : rutile titanifère\n- Marampa iron ore : relance extraction\n- Leone (SLE) : très instable\n- Post-Ebola + COVID : fragilité système santé persistante"}],
    "LBR": [{"title": "Liberia — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Liberia\n## Économie\nPIB $4.5 Mds USD (USD officiel). Croissance 4.5%. Caoutchouc (Firestone), minerai de fer, or.\n## Finances publiques\nDéficit -5.0% PIB. Dette 60% PIB.\n## Points investisseur\n- Dollar libérien (LRD) + USD en circulation\n- Minerai fer : Arcelor Mittal (Liberia Operations)\n- Pavillon de complaisance maritime : 2ème registre mondial\n- Boakai élu 2023 : transition pacifique (positif)"}],
    "GHA": [{"title": "Ghana — Fiche macro 2024 (étendue)", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Ghana\n## Économie\nPIB ~80 Mds USD. Croissance 3.1%. Or, pétrole (Jubilee), cacao (2ème mondial).\n## Finances publiques\nDéficit -4.6% PIB. Dette 83% PIB. Restructuration dette 2023 (G20 Cadre Commun).\n## Politique monétaire\nInflation 22.3% (pic 54% janv. 2023 → normalisé). Taux directeur BOG 30%.\n## Points investisseur\n- DVLA (Jubilee, TEN, Sankofa) : 160 000 bpj pétrole offshore\n- Réforme dette : accord créanciers bilatéraux 2023, eurobond restructuré\n- GSE Composite : rebond post-crise\n- Cedi (GHS) : rebond partiel après chute 2022"}],
    "GMB": [{"title": "Gambie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Gambie\n## Économie\nPIB $2.7 Mds USD. Croissance 5.8%. Tourisme, arachides, pêche, transferts diaspora.\n## Finances publiques\nDéficit -3.9% PIB. Dette 80% PIB.\n## Points investisseur\n- Transferts migrants = 26% PIB (record régional)\n- Petit marché (2.7M hab.) mais hub re-export régional\n- Dalasi (GMD) : relativement stable\n- Post-Jammeh : démocratisation mais fragilité institutionnelle"}],
    "GNB": [{"title": "Guinée-Bissau — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Guinée-Bissau\n## Économie\nPIB $1.6 Mds USD. Croissance 4.2%. Noix de cajou (95% exports, 10% mondial).\n## Finances publiques\nDéficit -3.5% PIB. Dette 78% PIB. Zone UEMOA.\n## Points investisseur\n- Économie mono-produit (cajou) : extrême vulnérabilité prix\n- Instabilité politique endémique (9 coups d'État depuis 1974)\n- Phosphates de Farim : inexploités mais réserves importantes\n- XOF : stabilité monétaire via BCEAO"}],
    "CPV": [{"title": "Cap-Vert — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Cap-Vert\n## Économie\nPIB $2.8 Mds USD. Croissance 4.5%. Tourisme (70% recettes devises), pêche, transferts.\n## Finances publiques\nDéficit -2.8% PIB. Dette 140% PIB (quasi-souverain malgré notation stable).\n## Points investisseur\n- Escudo cap-verdien (CVE) : ancré EUR (parité fixe)\n- Destination touristique sûre et stable\n- Câbles sous-marins : hub connectivité Atlantique\n- BVC (Bourse de Valeurs de Cap-Vert) : marché naissant"}],
    "DJI": [{"title": "Djibouti — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Djibouti\n## Économie\nPIB $4.3 Mds USD. Croissance 7.1%. Services portuaires (95% imports Éthiopie transitent ici).\n## Finances publiques\nDéficit -1.5% PIB. Dette 73% PIB (endettement Chine majeur).\n## Points investisseur\n- Port de Doraleh : hub stratégique Corne de l'Afrique + Rouge\n- Bases militaires : USA, France, Chine, Japon, Italie\n- Franc djiboutien (DJF) : ancré USD\n- Risque : dépendance totale à l'Éthiopie"}],
    "SOM": [{"title": "Somalie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Somalie\n## Économie\nPIB ~12 Mds USD (PPA, estimé). Transferts diaspora = 1.4 Mds USD/an. Bétail, pêche, sucre.\n## Situation\nPas de banque centrale fonctionnelle. Dollar somalien (SOS) sans valeur réelle — USD utilisé.\n## Points investisseur\n- Découvertes pétrolières offshore (BP, ExxonMobil — gelées sécurité)\n- Somaliland (autoproclamé) : plus stable, Port Berbera\n- Al-Shabaab contrôle zones rurales\n- Reconstruire : opportunité massive mais risque maximal"}],
    "ERI": [{"title": "Érythrée — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Érythrée\n## Économie\nPIB $7 Mds USD (PPA, estimé). Données très limitées. Or (Bisha — Zijin Mining), zinc, cuivre.\n## Points investisseur\n- Économie la plus fermée d'Afrique (pire que Corée du Nord selon Freedom House)\n- Sanctions ONU partielles levées\n- Port de Massawa/Assab : potentiel élevé si ouverture\n- Nakfa (ERN) : non convertible"}],
    "BDI": [{"title": "Burundi — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Burundi\n## Économie\nPIB $3.5 Mds USD. Croissance 2.2%. Café, thé, or artisanal.\n## Finances publiques\nDéficit -5.0% PIB. Dette 70% PIB. IDH = 185/189.\n## Points investisseur\n- Nickel de Musongati : réserves significatives, inexploitées\n- Exclusion du Partenariat de l'EAC (partielle)\n- Franc burundais (BIF) : très volatil\n- Risque: post-crise 2015, fragilité persistante"}],
    "COM": [{"title": "Comores — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Comores\n## Économie\nPIB $1.3 Mds USD. Croissance 3.1%. Ylang-ylang (80% mondial), vanille, clous de girofle.\n## Finances publiques\nDéficit -2.5% PIB. Dette 37% PIB.\n## Points investisseur\n- Franc comorien (KMF) : ancré EUR (parité fixe via France)\n- Transferts diaspora = 25% PIB\n- Instabilité politique chronique (22 coups d'État depuis 1975)\n- Pêche : eaux poissonneuses sous-exploitées"}],
    "STP": [{"title": "São Tomé-et-Príncipe — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# São Tomé-et-Príncipe\n## Économie\nPIB $0.5 Mds USD. Croissance 2.5%. Tourisme, cacao premium, pêche.\n## Finances publiques\nDéficit -3.0% PIB. Dette 104% PIB.\n## Points investisseur\n- Dobra (STN) : ancré EUR\n- Pétrole offshore JDZ (Joint Development Zone avec Nigeria) : exploration\n- Hub touristique niche (natura, gastronomie)\n- Marché ultra-marginal pour investissement direct"}],
    "SYC": [{"title": "Seychelles — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Seychelles\n## Économie\nPIB $2.1 Mds USD. Croissance 5.0%. Tourisme (60% PIB), thon, services financiers.\n## Finances publiques\nDéficit -1.5% PIB. Dette 65% PIB (restructurée 2021).\n## Points investisseur\n- Rupee seychelloise (SCR) : flottante géré\n- Blue bonds (obligations bleues) : innovation financement marin\n- MERJ Exchange : plateforme bourse + crypto\n- Premier pays africain à émettre des obligations ESG souveraines"}],
    "SWZ": [{"title": "Eswatini — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Eswatini (Swaziland)\n## Économie\nPIB $4.5 Mds USD. Croissance 2.0%. Sucre, bois, textiles (AGOA).\n## Finances publiques\nDéficit -2.8% PIB. Dette 52% PIB.\n## Points investisseur\n- Lilangeni (SZL) : parité fixe ZAR\n- Dépendance Southern African Customs Union (SACU)\n- Monarchie absolue (Mswati III) : instabilité sociale 2021\n- Accès AGOA : exports textiles USA"}],
    "LSO": [{"title": "Lesotho — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Lesotho\n## Économie\nPIB $2.9 Mds USD. Croissance 1.8%. Diamants (Letšeng = 1ère mine ciel ouvert qualité), eau, textiles.\n## Finances publiques\nDéficit -5.5% PIB. Dette 65% PIB.\n## Points investisseur\n- LHWP (Lesotho Highlands Water Project) : vente eau à l'Afrique du Sud\n- Loti (LSL) : parité fixe ZAR\n- Gem Diamonds : Letšeng mine (diamants >100 carats récurrents)\n- Enclave totale dans l'Afrique du Sud → dépendance totale"}],
    "MRT": [{"title": "Mauritanie — Fiche macro 2024", "year": 2024, "doc_type": "MANSA_SUMMARY", "content": "# Mauritanie\n## Économie\nPIB $10 Mds USD. Croissance 3.9%. Minerai de fer (SNIM, 1er Afrique francophone), poisson, or, gaz.\n## Finances publiques\nDéficit -1.0% PIB. Dette 60% PIB.\n## Points investisseur\n- GTA (Grand Tortue Ahmeyim) : LNG offshore partagé avec Sénégal (BP)\n- SNIM : minerai de fer de qualité, Cansado terminal\n- Ouguiya (MRU) : réforme monétaire 2018\n- Pont de l'unité : connexion Sénégal renforcée"}],
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
