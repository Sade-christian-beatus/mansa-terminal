/**
 * Génération de séries pour sparklines (dashboard).
 *
 * Priorité aux séries historiques réelles de `demo-data.ts` (FMI WEO).
 * À défaut (pays/indicateur non couverts), produit une série synthétique
 * déterministe autour de la valeur courante — même esprit que la fonction
 * `generateStaticSeries` de la page détail pays — afin que chaque ligne /
 * carte ait toujours une mini-courbe en mode démo.
 */
import { getCountrySeries } from "@/lib/demo-data";

export interface SparkPoint { year: string; value: number; }

const YEARS = ["2018", "2019", "2020", "2021", "2022", "2023", "2024"];

/** Série synthétique déterministe autour de `value` (reproductible par code). */
function syntheticSeries(code: string, value: number): SparkPoint[] {
  const seed = code.charCodeAt(0) + (code.charCodeAt(1) || 0);
  return YEARS.map((year, i) => {
    const wave = Math.sin((i + 1) * 1.3 + seed * 0.3) * Math.abs(value || 1) * 0.12;
    const drift = (value / YEARS.length) * (i - YEARS.length + 1) * 0.06;
    const v = i === YEARS.length - 1 ? value : Math.round((value + drift + wave) * 100) / 100;
    return { year, value: v };
  });
}

/**
 * Série de sparkline pour un indicateur + pays.
 * @param currentValue valeur la plus récente (sert au repli synthétique)
 */
export function sparklineSeries(
  code: string,
  countryId: string,
  currentValue?: number | null,
): SparkPoint[] {
  const real = getCountrySeries(code, countryId);
  if (real.length >= 3) return real;
  if (currentValue == null || Number.isNaN(currentValue)) return [];
  return syntheticSeries(code, currentValue);
}

/**
 * Série moyenne continentale : moyenne, année par année, des séries de tous
 * les pays fournis. Utilisée par les cartes KPI (moyenne Afrique).
 */
export function averageSeries(
  code: string,
  countries: { id: string; values: Record<string, number> }[],
): SparkPoint[] {
  const byYear: Record<string, { sum: number; n: number }> = {};
  for (const c of countries) {
    const s = sparklineSeries(code, c.id, c.values[code]);
    for (const pt of s) {
      if (pt.value == null || Number.isNaN(pt.value)) continue;
      const acc = (byYear[pt.year] ??= { sum: 0, n: 0 });
      acc.sum += pt.value;
      acc.n += 1;
    }
  }
  return Object.entries(byYear)
    .map(([year, { sum, n }]) => ({ year, value: Math.round((sum / n) * 100) / 100 }))
    .sort((a, b) => a.year.localeCompare(b.year));
}
