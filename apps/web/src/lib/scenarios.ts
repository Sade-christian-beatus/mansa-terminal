/**
 * Simulation de scénarios macro (élasticités simplifiées FMI/BM, pures & testables).
 *
 * Chaque fonction renvoie les deltas appliqués aux baselines d'un pays.
 * Modèle indicatif — non substituable à une analyse DSA formelle.
 */

export type CountryBase = {
  name: string; flag: string; region: string;
  growth: number; inflation: number; debt: number;
  oil_exporter: boolean; agri_pct: number; ext_debt_usd: number;
};

export interface ScenarioDelta {
  growthDelta: number;
  inflationDelta: number;
  debtDelta: number;
}

/** Normalise le zéro négatif (-0 → 0) pour éviter qu'il fuite dans l'UI / les exports. */
const z = (n: number): number => (n === 0 ? 0 : n);

/** Choc pétrolier : params.oil_pct = variation du prix du baril (%). */
export function oilShockCompute(country: CountryBase, params: Record<string, number>): ScenarioDelta {
  const shock = params.oil_pct / 100;
  const growthDelta = country.oil_exporter
    ? shock * 0.3
    : -shock * 0.1 * (1 - country.agri_pct / 100);
  const inflationDelta = country.oil_exporter ? -0.5 : shock * 1.5;
  return { growthDelta: z(growthDelta), inflationDelta: z(inflationDelta), debtDelta: 0 };
}

/** Hausse taux Fed : params.bps = hausse en points de base. */
export function fedRateCompute(country: CountryBase, params: Record<string, number>): ScenarioDelta {
  const shock = params.bps / 100;
  const growthDelta = -0.2 * shock - (country.ext_debt_usd / 100) * 0.05 * shock;
  const inflationDelta = 0.3 * shock;
  const debtDelta = (country.ext_debt_usd / 100) * shock * 2;
  return { growthDelta: z(growthDelta), inflationDelta: z(inflationDelta), debtDelta: z(debtDelta) };
}

/** Sécheresse Sahel : params.agri_loss_pct = perte agricole (%). */
export function droughtSahelCompute(country: CountryBase, params: Record<string, number>): ScenarioDelta {
  const shock = (params.agri_loss_pct / 100) * (country.agri_pct / 100);
  const growthDelta = -shock * 2.5;
  const inflationDelta = shock * 8;
  const debtDelta = shock * 5;
  return { growthDelta: z(growthDelta), inflationDelta: z(inflationDelta), debtDelta: z(debtDelta) };
}
