# Gestion des ingestions de données — MANSA Terminal

Ce document décrit **comment les données macro arrivent dans la base** et
**comment en ajouter**. Il complète `CLAUDE.md` (vue d'ensemble) et le code des
scripts dans `scripts/`.

---

## Vue d'ensemble

Toutes les séries chiffrées vivent dans une seule table : **`macro_indicators`**
(Postgres/Supabase). Chaque ligne = un point `(pays, indicateur, période, source)`.

```
country_id  indicator_code  indicator_name  value  unit  period  period_type  source  source_url  raw_data  timestamp
```

**Clé d'unicité / upsert** : `(country_id, indicator_code, period, source)`.
Tous les scripts font un `INSERT … ON CONFLICT … DO UPDATE`, donc **ré-exécuter
une ingestion est idempotent** (met à jour la valeur, ne duplique pas).

Chaque exécution journalise dans **`data_ingestion_logs`**
(`source, status, records_fetched, records_inserted, started_at, completed_at`).

---

## Sources et scripts

| Source | Script | Couverture | Statut (2026-06) |
|---|---|---|---|
| FMI WEO | `scripts/ingest_imf.py` | 54 pays, projections → 2031 | ✅ peuplé (~24 900 pts) |
| Banque Mondiale WDI | `scripts/ingest_wb.py` | 54 pays, macro + social | ✅ peuplé (~15 400 pts) |
| UCDP / conflits | `scripts/ingest_conflicts.py` (+ `data/pipelines`) | événements de conflit | ✅ peuplé (~1 760 pts) |
| ILO · FAO · Climate Watch | `scripts/ingest_extra.py` | emploi, agriculture, climat | ⚠️ à vérifier (0 pt en base) |
| UN Comtrade | `scripts/ingest_comtrade.py` | flux commerciaux bilatéraux | ⚠️ clé requise (sinon ~15 pays) |
| EIA énergie | `scripts/ingest_eia.py` | énergie internationale | ⚠️ `EIA_API_KEY` requise |
| NASA VIIRS | `scripts/ingest_nasa_viirs.py` | luminosité nocturne (proxy activité) | ⚠️ non peuplé |
| EM-DAT | `scripts/ingest_emdat.py` | catastrophes | manuel (fichier Excel local) |
| ODFA / Knoema (INSD) | `scripts/ingest_odfa.py` | sources nationales BFA | ❌ bloqué Cloudflare (403 sur IP datacenter) |
| **INSD Burkina (annuaires)** | `scripts/extract_burkina_insd.py` → `scripts/ingest_burkina_insd.py` | Burkina Faso, séries nationales | ✅ **nouveau** (voir ci-dessous) |

> Les sources marquées ⚠️/❌ sont câblées dans la CI mais n'ont pas (encore)
> produit de données — à investiguer (clés API manquantes, blocage réseau).

---

## Orchestration (CI)

`.github/workflows/data-ingest.yml` exécute les scripts :

- **Hebdo** — lundi 06:00 UTC : `imf`, `worldbank`, `extra`.
- **Mensuel** — 1er du mois 07:30 UTC : refresh complet (+ `comtrade`, `eia`,
  `nasa`, `burkina`).
- **Manuel** — `workflow_dispatch` avec choix de la `source`
  (`all | imf | worldbank | extra | comtrade | eia | nasa | odfa | burkina`) et
  un drapeau `dry_run`.

Secrets requis : `DATABASE_URL_SYNC` (obligatoire), `COMTRADE_SUBSCRIPTION_KEY`,
`EIA_API_KEY`, `NASA_EARTHDATA_TOKEN` (optionnels).

Lancer en local :
```bash
export DATABASE_URL_SYNC="postgresql://user:pass@host:5432/db"
pip install -r scripts/requirements.txt
python scripts/ingest_wb.py            # ex. Banque Mondiale
python scripts/ingest_burkina_insd.py  # ex. INSD Burkina (depuis le CSV commité)
```

---

## Cas pratique : ajouter une source **nationale** (ex. INSD Burkina Faso)

Les annuaires statistiques nationaux (PDF) sont la source officielle la plus
riche, mais non interrogeable par API. Le pipeline est **découplé en deux** :

1. **Extraction** (local, avec les PDF) — `scripts/extract_burkina_insd.py`
   - Utilise `pdfplumber` et reconstruit les colonnes par **position x des mots**
     (les tableaux sont sans bordures → l'espace sert à la fois de séparateur de
     milliers et de colonne).
   - Ne garde que les **tableaux séries-temporelles** (en-tête ≥ 3 années) avec
     un **appariement positionnel strict** (n valeurs == n années) → écarte les
     lignes éparses/désalignées plutôt que d'injecter des valeurs douteuses.
   - Produit un **CSV revu et commité** : `data/burkina_insd/insd_burkina.csv`
     (+ `insd_burkina_keyfigures.csv`, « chiffres clés » vérifiés à la main).
   ```bash
   pip install pdfplumber unidecode
   python scripts/extract_burkina_insd.py \
       --pdf-dir "/chemin/vers/les/annuaires" \
       --out data/burkina_insd/insd_burkina.csv
   ```

2. **Ingestion** (CI ou local) — `scripts/ingest_burkina_insd.py`
   - Lit les CSV commités et upsert dans `macro_indicators` avec `source = "INSD"`.
   - Aucun PDF requis en CI.

L'institut (INSD) est déjà catalogué côté API (`app/data/national_sources.py`)
et côté front (`apps/web/src/lib/national-sources.ts`). Comme `"INSD"` figure
dans `NATIONAL_SOURCE_TAGS`, l'endpoint `/api/macro/BFA/national-sources` expose
automatiquement ces séries dans la section « Sources nationales » de la page pays.

**Pour un autre pays** : reproduire le schéma (extraction → CSV → ingestion),
vérifier que l'institut figure bien dans les deux catalogues, et tagger la
`source` avec l'abréviation de l'institut (déjà dans `NATIONAL_SOURCE_TAGS`).

---

## Réversibilité

Une source est isolée par son tag `source`. Pour retirer entièrement un jeu :
```sql
DELETE FROM macro_indicators WHERE source = 'INSD';
```
