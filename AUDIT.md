# Audit de plateforme — MANSA Terminal

_Revue de fond réalisée le 2026-06-18. Base Supabase inspectée en lecture._

## 1. Synthèse

Plateforme saine et fonctionnelle : monorepo Next.js 14 + FastAPI + Supabase,
data pipelines `scripts/` orchestrés par GitHub Actions. Données cœur (FMI,
Banque Mondiale, conflits) **à jour**. Cette revue a porté sur la propreté du
code, la cohérence linguistique, la faisabilité mobile, la fraîcheur des données,
la gestion des ingestions et l'ajout des données nationales du Burkina (INSD).

## 2. Fichiers morts supprimés

| Fichier | Raison |
|---|---|
| `apps/api/app/routers/indicators.py` | vide, non importé |
| `apps/api/app/routers/observations.py` | vide, non importé |
| `apps/api/app/schemas.py` + `app/schemas/` | vides, schémas définis inline dans les routers |
| `apps/api/requirements.old.txt` | sauvegarde obsolète |
| `docker` (racine) | fichier 0 octet parasite |

Aucune **page web orpheline** : `/notifications`, `/profile`, `/onboarding`,
`/settings/dictionary` sont atteignables via TopBar/flux (hors Sidebar mais utilisées).

> ℹ️ `data/pipelines/*` (Dagster) est **conservé** (référencé par `CLAUDE.md` et
> `docker-compose`) mais **redondant** avec `scripts/` qui porte l'ingestion réelle
> (CI). À rationaliser ultérieurement (choisir un seul orchestrateur).

## 3. Langues

L'application est **systématiquement en français** ; un scan large n'a révélé
aucune fuite d'anglais dans l'UI. Corrigé : le `<title>` et la `description`
HTML (`layout.tsx`) étaient en anglais → passés en français.

- Le système bilingue FR/EN (`lib/translations.ts` + `lib/lang-store.ts`, helper
  `t()`) **existe** mais reste **partiel** : la plupart des pages codent le
  français en dur, le locale `en` n'est pas couvert au-delà de la navigation.
- **Recommandation (suivi)** : compléter l'i18n page par page si l'anglais doit
  être réellement proposé, sinon retirer le sélecteur EN pour éviter une demi-mesure.

## 4. Application mobile

Le front est responsive mais n'avait aucune configuration mobile. **Livré : une
PWA installable** (cf. `manifest.ts`, `public/sw.js`, icônes `public/icons/`,
métadonnées `layout.tsx`). L'app est désormais installable sur Android/iOS/desktop
avec un mode hors-ligne basique.

- **App native** (Capacitor / React Native) : faisable car l'API REST est propre
  et découplée, mais non nécessaire à ce stade — la PWA couvre l'essentiel du
  besoin « application mobile » à coût minimal.

## 5. Fraîcheur des données

Base **active**, 42 002 points, 54 pays, dernière ingestion **2026-06-17**.

| Source | Points | Dernière période | Dernier run | Statut |
|---|--:|---|---|---|
| FMI WEO | 24 857 | 2031 (proj.) | 2026-06-15 | ✅ à jour |
| Banque Mondiale WDI | 15 385 | 2025 | 2026-06-17 | ✅ à jour |
| UCDP (conflits) | 1 760 | 2025 | 2026-06-17 | ✅ à jour |
| ILO · FAO · Climate Watch (`extra`) | 0 | — | — | ⚠️ jamais peuplé |
| UN Comtrade | 0 | — | — | ⚠️ clé manquante |
| EIA · NASA VIIRS | 0 | — | — | ⚠️ clés / non exécuté |
| ODFA / Knoema (INSD) | 0 | — | — | ❌ bloqué Cloudflare |
| **INSD Burkina (annuaires)** | **+43 858 prêts** | 2024 | — | 🟡 extrait & commité, ingestion CI (cf. §7) |

**Recommandations** :
- Investiguer les sources à 0 point (clés API `EIA_API_KEY`,
  `COMTRADE_SUBSCRIPTION_KEY` à fournir ; vérifier `ingest_extra.py`).
- L'ingestion ODFA reste bloquée sur IP datacenter → l'extraction PDF INSD
  (nouveau pipeline) la remplace avantageusement pour le Burkina.

## 6. Gestion des ingestions

Documentée dans **`docs/INGESTION.md`** : table cible unique `macro_indicators`
(upsert idempotent sur `country_id, indicator_code, period, source`), scripts
`scripts/*`, orchestration `.github/workflows/data-ingest.yml` (hebdo / mensuel /
manuel), secrets requis, et procédure d'ajout d'une source nationale.

## 7. Données nationales du Burkina (INSD)

Pipeline **livré** (cf. `docs/INGESTION.md` §cas pratique) :
- `scripts/extract_burkina_insd.py` — extraction géométrique (pdfplumber) des 5
  annuaires → **43 834 points · 4 708 indicateurs · 1985-2024**, plus
  `insd_burkina_keyfigures.csv` (24 chiffres clés vérifiés). CSV commités dans
  `data/burkina_insd/`.
- `scripts/ingest_burkina_insd.py` + option `burkina` dans `data-ingest.yml`.
- Catalogue UI BFA (`lib/national-sources.ts`) → la page `/countries/BFA` affiche
  les chiffres clés INSD une fois ingérés.

> ⚠️ **Écriture live en attente d'accès en écriture.** Le serveur MCP Supabase de
> cette session est en **lecture seule** (INSERT et migrations refusés) et aucune
> `DATABASE_URL_SYNC` n'est disponible localement. L'ingestion réelle se fait
> donc via la **CI** (déclencher `data-ingest.yml` → `source: burkina`, le secret
> `DATABASE_URL_SYNC` y est présent) **ou** en local avec la variable d'env. Tout
> est prêt ; il ne manque que l'exécution dans un contexte disposant des droits.
