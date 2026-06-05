"""
MANSA Terminal — Seed Knowledge Base
Insère des résumés analytiques FMI/BM pour les 10 pays africains prioritaires.

Ces documents alimentent le RAG de l'AI Analyst (get_relevant_context) sans
nécessiter d'embeddings vectoriels — la recherche est faite par country_id + year.

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/seed_knowledge.py
    python scripts/seed_knowledge.py --dry-run
"""
import argparse
import os
import sys
from datetime import datetime

import psycopg2
from psycopg2.extras import execute_values

DATABASE_URL = os.environ.get("DATABASE_URL_SYNC", "")

# ── Documents analytiques ──────────────────────────────────────────────────
# Format : (country_id, title, doc_type, year, source_url, content)
KNOWLEDGE_DOCUMENTS = [

    # ── Nigeria (NGA) ──────────────────────────────────────────────────────
    ("NGA", "Nigeria Article IV — FMI 2024", "article_iv", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/02/nigeria",
     """NIGERIA — Synthèse macro-fiscale 2024 (FMI Article IV)

PIB & Croissance :
- Croissance PIB réel : 3,3 % (2024e), portée par les services et l'agriculture.
  Le secteur pétrolier reste en contraction (-2,1 %) malgré la réforme des subventions.
- PIB nominal : ~600 Mrd USD (estimé). PIB/habitant : ~2 600 USD (PPA : ~6 200 USD).
- Inflation IPC : 33,2 % (2024), liée à la dépréciation du naira et aux hausses de prix alimentaires.

Secteur fiscal :
- Recettes pétrolières : 5,2 % du PIB (contre 8 % en 2019) — base fiscale insuffisante.
- Déficit budgétaire fédéral : -5,4 % du PIB (2024e), financé par la CBN et les eurobonds.
- Dette publique totale : 38,7 % du PIB — service de la dette > 90 % des recettes fédérales.
- DSCR critique : le Nigeria consacre plus de 40 % de ses revenus au service de la dette.

Secteur externe :
- Compte courant : -0,8 % du PIB (amélioration vs -3,0 % en 2022 grâce aux exportations).
- Réserves de change : ~33 Mrd USD (couvre 4,5 mois d'importations).
- Naira : flottement géré depuis juin 2023 — NGN ≈ 1 500-1 600/USD (marché officiel).
- IDE entrants : 1,2 % du PIB, concentration dans le pétrole.

Réformes clés (2023-24) :
- Suppression des subventions carburant (économies : ~3 % du PIB/an).
- Unification des taux de change (marché officiel + parallèle fusionnés).
- Hausse du taux directeur CBN à 26,75 % pour ancrer les anticipations.

Risques principaux :
- ⚠️ Volatilité naira et inflation persistante (risque stagflation).
- ⚠️ Financement monétaire du déficit (CBN Ways & Means avances).
- ⚠️ Transition énergétique : Nigeria très exposé à la démande mondiale de pétrole.
"""),

    # ── Afrique du Sud (ZAF) ──────────────────────────────────────────────
    ("ZAF", "South Africa Article IV — FMI 2024", "article_iv", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/south-africa",
     """AFRIQUE DU SUD — Synthèse macro-fiscale 2024 (FMI Article IV)

PIB & Croissance :
- Croissance PIB réel : 1,1 % (2024e) — sous-performance structurelle.
  Délestages électriques (load shedding) ont coûté ~2 % de PIB/an depuis 2019.
- PIB nominal : ~380 Mrd USD. PIB/habitant : ~6 400 USD.
- Inflation : 4,9 % (2024) — dans la cible SARB (3-6 %).

Secteur fiscal :
- Déficit budgétaire consolidé : -4,9 % du PIB (2024/25).
- Dette publique : 75,3 % du PIB — trajectoire préoccupante mais stable.
- Masse salariale publique : >11 % du PIB — rigidité budgétaire majeure.
- Support aux SOEs (Eskom, SAA, Transnet) : pression additionnelle ~1-2 % du PIB.

Secteur externe :
- Compte courant : -1,6 % du PIB.
- Réserves : ~60 Mrd USD (5,5 mois d'importations).
- ZAR : monnaie flottante, sensible aux flux de portefeuille et aux matières premières.

Défis structurels :
- Chômage : 33 % (taux officiel) — jeunesse 60 % chômage.
- Inégalités : Gini ~0,63 (parmi les plus élevés mondialement).
- Infrastructure : déficit énergétique (Eskom), portuaire (Transnet) et ferroviaire.

Perspectives :
- Résolution des délestages (Eskom stabilisation) : potentiel +1,5 % de PIB additionnel.
- Programme ANC 2024 : focus investissement privé et partenariats PPP.
- ⚠️ Risque: dérapage fiscal si les réformes SOEs n'avancent pas assez vite.
"""),

    # ── Kenya (KEN) ───────────────────────────────────────────────────────
    ("KEN", "Kenya Article IV — FMI 2024", "article_iv", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/kenya",
     """KENYA — Synthèse macro-fiscale 2024 (FMI Article IV)

PIB & Croissance :
- Croissance PIB réel : 5,4 % (2024e) — une des plus dynamiques d'Afrique de l'Est.
- PIB nominal : ~115 Mrd USD. PIB/habitant : ~2 100 USD.
- Inflation : 5,1 % (2024) — nette décélération vs 9,5 % en 2022.

Secteur fiscal :
- Déficit budgétaire : -4,3 % du PIB (programme FMI ECF/EFF actif).
- Recettes fiscales : 16,1 % du PIB — effort de mobilisation en cours.
- Dette publique : 68,5 % du PIB — restructuration proactive des eurobonds 2024.
- Refinancement eurobond 2 Mrd USD (2024) : réalisé avec succès via nouvel emprunt.

Secteur externe :
- Compte courant : -3,8 % du PIB.
- Tourisme : contribution croissante (4 % du PIB), moteur de devises.
- Réserves : 7,2 Mrd USD (3,8 mois d'importations — en dessous du seuil prudentiel).
- KES : dépréciation de 25 % en 2023, stabilisation en 2024.

Atouts :
- Hub technologique panafricain (Nairobi Silicon Savannah).
- Énergie renouvelable : 90 % de l'électricité produite (géothermie + hydro).
- Système bancaire solide (M-Pesa, NCBA, KCB).

Risques :
- ⚠️ Tensions sociales liées aux hausses de taxes (manifestations 2024).
- ⚠️ Vulnérabilité climatique : sécheresses et inondations récurrentes.
- ⚠️ Besoin de financement externe élevé sur 2024-2026.
"""),

    # ── Égypte (EGY) ──────────────────────────────────────────────────────
    ("EGY", "Egypt Article IV — FMI 2024", "article_iv", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/egypt",
     """ÉGYPTE — Synthèse macro-fiscale 2024 (FMI Article IV)

PIB & Croissance :
- Croissance PIB réel : 3,8 % (2024e) — reprise post-dévaluation.
- PIB nominal : ~396 Mrd USD. PIB/habitant : ~3 600 USD.
- Inflation : 32,5 % (2024) — choc dévaluation EGP mars 2024 (-40 %).

Secteur fiscal :
- Déficit primaire transformé en surplus : +1,5 % du PIB (objectif FMI).
- Dette publique : 88,5 % du PIB — trajectoire descendante sous programme FMI.
- Programme FMI EFF 8 Mrd USD (2024) + deal UAE investissement 35 Mrd USD (Ras El Hekma).

Secteur externe :
- Canal de Suez : revenus ~9,4 Mrd USD/an (impacté par crise mer Rouge -25 % en 2024).
- Tourisme : ~13 Mrd USD/an (2024e) — secteur résilient.
- Réserves : ~46 Mrd USD (après dévaluation et apports UAE).
- EGP : flottement libre depuis mars 2024 (≈ 48-50 EGP/USD).

Réformes :
- Unification taux de change + hausse taux CBE à 27,25 %.
- Réduction subventions énergie (gaz naturel, électricité).
- Recettes Suez Canal en baisse structurelle : diversification urgente.

Risques :
- ⚠️ Inflation sociale élevée : impact sur ménages à faibles revenus.
- ⚠️ Crise mer Rouge : perte de revenus du canal de Suez durable.
- ⚠️ Dépendance au tourisme et aux envois de fonds (expositions exogènes).
"""),

    # ── Ghana (GHA) ───────────────────────────────────────────────────────
    ("GHA", "Ghana Post-IMF Program Review 2024", "policy_report", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/ghana",
     """GHANA — Synthèse macro-fiscale 2024 (Post-programme FMI ECF)

Contexte :
- Défaut partiel sur dette extérieure en 2022 (eurobonds + créanciers bilatéraux).
- Programme FMI ECF 3 Mrd USD (2023-2026) — on track fin 2024.

PIB & Croissance :
- Croissance : 5,7 % (2024e) — rebond pétrole et or (hausse cours).
- PIB nominal : ~72 Mrd USD. PIB/habitant : ~2 200 USD.
- Inflation : 22,1 % (2024) — pic 54 % en décembre 2022, nette décélération.

Restructuration de la dette :
- Dette intérieure restructurée : haircut 30-50 % sur détenteurs domestiques (2023).
- Accord avec créanciers officiels bilatéraux (Club de Paris + Chine) : 2024.
- Eurobonds (13 Mrd USD) : accord avec comité créanciers Q3 2024.

Secteur fiscal :
- Déficit primaire : -0,5 % du PIB (objectif FMI : surplus primaire +0,5 % d'ici 2025).
- Recettes : 16,8 % du PIB (amélioration vs 13,6 % en 2022).
- GHS/USD : ≈ 15-16 GHS/USD (stabilisation post-dévaluation de 45 % en 2022).

Perspectives :
- Retour aux marchés obligataires internationaux prévu 2025-2026.
- ✅ Leçons : Ghana premier pays à conclure restructuration dans le cadre G20.
- ⚠️ Risque: dépendance exportations (or, pétrole, cacao) — volatilité prix.
"""),

    # ── Maroc (MAR) ───────────────────────────────────────────────────────
    ("MAR", "Morocco Article IV — FMI 2024", "article_iv", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/morocco",
     """MAROC — Synthèse macro-fiscale 2024 (FMI Article IV)

PIB & Croissance :
- Croissance : 3,2 % (2024e) — reprise post-séisme d'Al Haouz (sept. 2023).
- PIB nominal : ~145 Mrd USD. PIB/habitant : ~3 800 USD.
- Inflation : 2,9 % (2024) — nette décélération, retour à la normale.

Secteur fiscal :
- Déficit budgétaire : -4,5 % du PIB (reconstruction post-séisme +0,8 %).
- Dette publique : 69,8 % du PIB — maîtrisée, financement diversifié.
- Programme Nouvelle Charte de l'Investissement : 50 Mrd USD sur 2022-2026.

Secteur externe :
- Compte courant : -2,1 % du PIB.
- IDE : 3,2 % du PIB — destination privilégiée pour nearshoring européen.
- Réserves : ~37 Mrd USD (6,2 mois d'importations — confortables).
- MAD : quasi-ancrage EUR (80 %) / USD (20 %) — stabilité nominale.

Atouts stratégiques :
- Hub industriel : automobile (Renault, Stellantis), aéronautique, offshoring.
- Phosphates : OCP = 30 % des réserves mondiales, position dominante mondiale.
- Énergie verte : objectif 52 % renouvelables 2030, exportation H2 vert vers UE.
- CAN 2025 + Coupe du Monde 2030 : infrastructure et tourisme.

Risques :
- ⚠️ Stress hydrique : disponibilité eau en baisse, irrigation agricole menacée.
- ⚠️ Chômage structurel jeunes (30 %).
"""),

    # ── Sénégal (SEN) ─────────────────────────────────────────────────────
    ("SEN", "Senegal Oil & Gas Macro Outlook 2024", "policy_report", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/senegal",
     """SÉNÉGAL — Synthèse macro-fiscale 2024 (Lancement pétrole & gaz)

Contexte historique :
- Première production de pétrole (champ Sangomar) : juin 2024.
- Première production de gaz (Greater Tortue Ahmeyim GTA) : 2025e.
- Transition politique : élections mars 2024, nouveau gouvernement Diomaye Faye-Sonko.

PIB & Croissance :
- Croissance : 8,8 % (2024e) — bond lié aux recettes hydrocarbures.
  Hors hydrocarbures : 5,2 % — dynamisme sectoriel maintenu.
- PIB nominal : ~30 Mrd USD. PIB/habitant : ~1 700 USD.
- Inflation : 3,2 % (2024) — stabilité XOF (arrimage EUR via BCEAO).

Secteur fiscal (UEMOA) :
- Déficit UEMOA : -4,8 % du PIB (vs critère convergence -3 %).
- Critère UEMOA non respecté depuis 2020 — clause dérogatoire accordée.
- Recettes hydrocarbures : +2 % PIB/an à partir de 2025 (estimation).
- Dette publique : 76,1 % du PIB — à surveiller (critère UEMOA = 70 %).

Secteur externe :
- Compte courant : -10,2 % du PIB (2023) — amélioration attendue avec les exportations.
- XOF : 1 EUR = 655,957 XOF (taux fixe — zone franc CFA).
- Réserves BCEAO mutualisées : 6,0 mois d'importations (zone UEMOA).

Défis :
- ⚠️ Syndrome hollandais : pression sur les secteurs non-hydrocarbures.
- ⚠️ Gouvernance fonds souverain (FONSIS) : transparence essentielle.
- ⚠️ Redistribution sociale : l'impact pétrole doit réduire la pauvreté (46 % pop.).
"""),

    # ── Côte d'Ivoire (CIV) ───────────────────────────────────────────────
    ("CIV", "Côte d'Ivoire Article IV — FMI 2024", "article_iv", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/cote-divoire",
     """CÔTE D'IVOIRE — Synthèse macro-fiscale 2024 (FMI Article IV)

Moteur économique de l'UEMOA :
- 1er PIB de l'UEMOA, ~40 % du PIB de la zone UEMOA.
- Croissance : 6,8 % (2024e) — locomotive régionale depuis 2012.
- PIB nominal : ~80 Mrd USD. PIB/habitant : ~2 700 USD.
- Inflation : 3,1 % (2024) — dans les clous BCEAO (cible <3 %).

Secteur fiscal :
- Déficit : -4,1 % du PIB (consolidation vers objectif UEMOA -3 %).
- Recettes fiscales : 14,3 % du PIB (sous la moyenne SSA).
- Plan National de Développement (PND 2021-2025) : 59 000 Mrd FCFA.
- Dette publique : 57,5 % du PIB — soutenable selon FMI.

Secteur externe :
- Cacao : 1er exportateur mondial (40 % production globale). Prix cacao 2024 : record historique >10 000 USD/tonne.
- Compte courant : -3,5 % du PIB.
- Réserves BCEAO (mutualisées zone UEMOA) : confortables (6 mois imports).

Secteur financier :
- BRVM (Bourse Régionale) : Abidjan hub financier UEMOA.
- Secteur bancaire sain : ratio Tier 1 moyen >12 %.

Risques :
- ⚠️ Concentration exportations sur cacao (volatilité prix).
- ⚠️ Crise sécuritaire au Sahel : menace migratoire et économique au nord.
- ⚠️ Pression dette : eurobonds importants à rembourser 2025-2027.
"""),

    # ── Cameroun (CMR) ────────────────────────────────────────────────────
    ("CMR", "Cameroon CEMAC Fiscal Assessment 2024", "policy_report", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/cameroon",
     """CAMEROUN — Synthèse macro-fiscale 2024 (Zone CEMAC)

Position dans la CEMAC :
- 1er PIB de la CEMAC (~45 % du PIB de la zone).
- Pétrole en déclin : production -8 %/an depuis 2014.

PIB & Croissance :
- Croissance : 4,1 % (2024e) — services et agro-industrie compensent le pétrole.
- PIB nominal : ~45 Mrd USD. PIB/habitant : ~1 600 USD.
- Inflation : 7,3 % (2024) — au-dessus cible BEAC (3 %).

Secteur fiscal :
- Déficit : -2,1 % du PIB (meilleure gestion post-programme FMI 2021-2024).
- Recettes pétrolières : 3,2 % du PIB (en baisse structurelle).
- Recettes hors pétrole : effort de mobilisation via élargissement assiette.
- Programme FMI ECF 689 M USD (2021-2024) : complété avec succès.

Secteur externe :
- XAF = parité fixe avec EUR (1 EUR = 655,957 XAF).
- Réserves BEAC (mutualisées CEMAC) : 4,8 mois d'importations.
- IDE : secteur pétrolier en déclin, diversification vers agro-industrie.

Risques :
- ⚠️ Crise anglophone (2017-présent) : impact Ouest et Nord-Ouest (-15 % PIB régional).
- ⚠️ Sécurité : menaces Boko Haram (Extrême-Nord), ADF (Est).
- ⚠️ Post-pétrole : transition fiscale à accélérer (< 10 ans de réserves prouvées).
"""),

    # ── Éthiopie (ETH) ────────────────────────────────────────────────────
    ("ETH", "Ethiopia Debt Restructuring & Macro 2024", "policy_report", 2024,
     "https://www.imf.org/en/Publications/CR/Issues/2024/ethiopia",
     """ÉTHIOPIE — Synthèse macro-fiscale 2024 (Restructuration dette + Post-Tigray)

Contexte :
- Conflit Tigray (2020-2022) : coût ~28 Mrd USD selon Banque Mondiale.
- Restructuration dette en cours (G20 Common Framework).
- Libéralisation économique sous PM Abiy Ahmed (Prix Nobel Paix 2019).

PIB & Croissance :
- Croissance : 7,2 % (2024e) — 2ème économie africaine en termes de croissance.
- PIB nominal : ~175 Mrd USD (PPA) / ~120 Mrd USD (courant).
  2ème population africaine (125 M habitants).
- Inflation : 28,3 % (2024) — dévaluation ETB accélère la hausse des prix.

Secteur fiscal :
- Déficit : -3,1 % du PIB.
- Recettes : 9,8 % du PIB — très faibles (marge de mobilisation importante).
- Service dette externe : >30 % des recettes export — situation critique.

Réforme de change (juillet 2024) :
- ETB : passage à taux de change flottant, dépréciation initiale -30 %.
- FMI : accord 3,4 Mrd USD ECF+EFF (2024) conditionné à la réforme.

Secteur externe :
- Exportations : café (40 % des recettes devises), fleurs, or, sesame.
- Déficit de la balance des paiements chronique.
- Projet Grand Renaissance Dam (GERD) : tensions avec Égypte/Soudan.

Risques :
- ⚠️ Fragilité politique : tensions ethniques post-Tigray.
- ⚠️ Insécurité alimentaire : 20 M personnes en besoin d'aide (2024).
- ⚠️ Restructuration dette : accord G20 Common Framework pas encore finalisé.
"""),
]


def seed_knowledge(conn, dry_run: bool = False) -> int:
    """Insère les documents analytiques dans knowledge_documents (UPSERT)."""
    cur = conn.cursor()
    inserted = 0

    for country_id, title, doc_type, year, source_url, content in KNOWLEDGE_DOCUMENTS:
        if dry_run:
            print(f"  [DRY-RUN] {country_id} — {title[:60]}...")
            inserted += 1
            continue

        cur.execute("""
            INSERT INTO knowledge_documents
                (id, country_id, title, doc_type, year, source_url, content, created_at)
            VALUES
                (gen_random_uuid(), %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT DO NOTHING
        """, (country_id, title, doc_type, year, source_url, content))

        if cur.rowcount > 0:
            inserted += 1
            print(f"  ✓ {country_id} — {title[:60]}")
        else:
            print(f"  ~ {country_id} — déjà présent (skip)")

    if not dry_run:
        conn.commit()

    cur.close()
    return inserted


def main():
    parser = argparse.ArgumentParser(
        description="Seed la knowledge base MANSA avec des documents analytiques FMI/BM"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Afficher ce qui serait inséré sans écrire en DB")
    args = parser.parse_args()

    if not DATABASE_URL and not args.dry_run:
        print("ERROR: DATABASE_URL_SYNC manquant. Exporter la variable puis relancer.")
        sys.exit(1)

    print(f"{'[DRY-RUN] ' if args.dry_run else ''}Seed knowledge base — "
          f"{len(KNOWLEDGE_DOCUMENTS)} documents pour {len(set(d[0] for d in KNOWLEDGE_DOCUMENTS))} pays")

    if args.dry_run:
        count = seed_knowledge(None, dry_run=True)
    else:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            count = seed_knowledge(conn, dry_run=False)
        finally:
            conn.close()

    print(f"\n{'Simulé' if args.dry_run else 'Inséré'} : {count}/{len(KNOWLEDGE_DOCUMENTS)} documents")


if __name__ == "__main__":
    main()
