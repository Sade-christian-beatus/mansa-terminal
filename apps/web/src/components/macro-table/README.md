# Macroeconomic Table — Documentation technique

Module institutionnel d'analyse macroéconomique des 54 pays africains, inspiré des
terminaux Bloomberg / IMF Data / Trading Economics. Remplace le tableau macro du
dashboard (`/`).

## Architecture

```
components/macro-table/
├── data.ts                 # Types, catalogue d'indicateurs catégorisé, dataset
│                           # de repli (FMI WEO 2024), badges, helpers (rang,
│                           # moyenne régionale, formatage, coloration).
├── ui.tsx                  # Primitives partagées : Flag (flagcdn), PerfBadge.
├── MacroTable.tsx          # Orchestrateur : toolbar (recherche/région/année/
│                           # export), tableau multi-catégories triable, badges,
│                           # sélection comparaison, ouverture détail/AI Brief.
├── CountryDetailDrawer.tsx # Panneau latéral : KPIs + 4 mini-graphiques
│                           # historique (navy) + prévision (or) via forecastApi.
├── CompareView.tsx         # Comparaison 2–10 pays : radar normalisé, courbes
│                           # superposées, tableau (valeurs + moy. Afrique + rang),
│                           # export PNG du radar.
├── AIBriefModal.tsx        # Résumé exécutif streamé (Claude via streamAIQuery).
└── README.md               # Ce fichier.
```

## Flux de données

1. `MacroTable` interroge `GET /api/macro/table?year=&region=` (React Query, cache 30 min).
2. Réponse réelle (FMI WEO + Banque Mondiale WDI depuis PostgreSQL) → affichée.
   Si la base n'est pas peuplée → repli sur `FALLBACK_DATA` (valeurs FMI WEO 2024).
3. Le **catalogue d'indicateurs pilote les colonnes** : seuls les indicateurs
   ayant au moins une valeur sont rendus (les catégories vides sont masquées).
4. Détail pays / comparaison utilisent `forecastApi` (`/forecast/...`) pour les
   séries historiques + prévisions réelles.
5. AI Brief utilise le streaming SSE `/api/ai/query`.

## Backend

`apps/api/app/routers/macro.py` → `GET /macro/table`
> ⚠️ Déclaré **avant** `/{country_id}` pour ne pas être capturé par le param de chemin.

Retourne :
```json
{
  "year": 2024,
  "indicators_present": ["NGDPD", "NGDP_RPCH", ...],
  "countries": [{ "id": "NGA", "name": "...", "region": "...", "values": { "NGDPD": 477, ... } }],
  "is_live": true
}
```

## Catalogue d'indicateurs

28 indicateurs réels (codes FMI WEO / Banque Mondiale WDI) répartis en 8 catégories :
Économie réelle, Inflation & Prix, Finances publiques, Dette, Secteur extérieur,
Secteur financier, Social, Climat & ESG. Chaque définition porte : unité, format,
sens favorable (`high`/`low`/`neutral`) et bornes de coloration.

> Indicateurs hors périmètre data actuel (notations souveraines, ND-GAIN, taux
> directeur, réserves de change…) : **masqués** tant qu'aucune source n'est branchée
> côté pipeline. Aucune valeur n'est fabriquée.

## Badge de performance

Score composite 0–100 calculé sur croissance, inflation, dette publique et compte
courant (chaque sous-score borné puis moyenné) → 🟢 Très favorable (≥65) /
🟡 Modéré (≥48) / 🟠 Surveillance (≥32) / 🔴 Risque élevé. Voir `computeBadge`.

## Export

`lib/export-utils.ts` : CSV, Excel (XLSX si SheetJS présent, sinon CSV),
PDF brandé MANSA, et `exportSVGtoPNG` (capture des graphiques Recharts).

## Performance

React Query (cache + dédup), `useMemo` sur filtrage/tri/agrégats, rendu paginé
(15 lignes + expansion), colonnes pilotées par les indicateurs présents. Le module
reste fluide avec 54 pays × 28 indicateurs.

## Palette

Bleu nuit `#1F3A5F` (en-têtes, historique) · Or `#C9A227` (accents, prévisions,
sélection). Les fonds restent sur les variables de thème (`--card-bg`, etc.) pour
compatibilité mode clair/sombre.

## Évolutions (phase 2)

- Heatmap continentale interactive dédiée au module
- Branchement de sources réelles pour Risk/ESG/Financier (pipeline Dagster)
- Export PNG du tableau complet (via html-to-image)
- Sélecteur de fréquence (mensuel/trimestriel) quand les séries seront disponibles
