/**
 * MEAI — MANSA Economic Activity Index (logique de calcul, pure et testable).
 *
 * Indice composite 0–100 calculé sur les données réelles de /macro/table.
 * Chaque indicateur est normalisé min-max sur l'ensemble des pays, avec une
 * direction (croissance/compte courant = haut meilleur ; inflation/dette = bas
 * meilleur). Le score d'un pays = somme pondérée des 6 composantes ; une
 * composante sans indicateur disponible vaut 50 (neutre).
 */

export interface MeaiComponent {
  subject: string;
  weight: number;
  color: string;
  indicators: string[];
}

export const MEAI_COMPONENTS: MeaiComponent[] = [
  { subject: "Croissance",  weight: 0.25, color: "#10B981", indicators: ["NGDP_RPCH"] },
  { subject: "Stabilité",   weight: 0.20, color: "#3B82F6", indicators: ["PCPIPCH", "GGXWDG_NGDP"] },
  { subject: "Commerce",    weight: 0.20, color: "#8B5CF6", indicators: ["BCA_NGDPD"] },
  { subject: "Marchés",     weight: 0.15, color: "#F59E0B", indicators: ["ENDA_XDC_USD_RATE"] },
  { subject: "Gouvernance", weight: 0.10, color: "#EF4444", indicators: [] },
  { subject: "Résilience",  weight: 0.10, color: "#00D4AA", indicators: ["FX_RESERVES"] },
];

export const MEAI_DIRECTIONS: Record<string, "up" | "down"> = {
  NGDP_RPCH: "up", PCPIPCH: "down", GGXWDG_NGDP: "down",
  BCA_NGDPD: "up", ENDA_XDC_USD_RATE: "down", FX_RESERVES: "up",
};

export type TableCountry = {
  id: string;
  name: string;
  region: string | null;
  values: Record<string, number>;
};

export interface MeaiResult {
  perCountry: Map<string, { score: number; comps: number[] }>;
  componentScores: number[];
  global: number;
}

export function computeMeai(countries: TableCountry[]): MeaiResult {
  const stats: Record<string, { min: number; max: number }> = {};
  for (const code of Object.keys(MEAI_DIRECTIONS)) {
    const vals = countries
      .map((c) => c.values[code])
      .filter((v): v is number => typeof v === "number");
    if (vals.length) stats[code] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  const norm = (code: string, v: number): number | null => {
    const s = stats[code];
    if (!s) return null;
    const t = s.max === s.min ? 0.5 : (v - s.min) / (s.max - s.min);
    return (MEAI_DIRECTIONS[code] === "up" ? t : 1 - t) * 100;
  };

  const perCountry = new Map<string, { score: number; comps: number[] }>();
  const compSums = MEAI_COMPONENTS.map(() => 0);
  for (const c of countries) {
    const comps = MEAI_COMPONENTS.map((comp) => {
      const subs = comp.indicators
        .map((code) => { const v = c.values[code]; return typeof v === "number" ? norm(code, v) : null; })
        .filter((x): x is number => x !== null);
      return subs.length ? subs.reduce((a, b) => a + b, 0) / subs.length : 50;
    });
    const score = comps.reduce((acc, s, i) => acc + s * MEAI_COMPONENTS[i].weight, 0);
    perCountry.set(c.id, { score, comps });
    comps.forEach((s, i) => { compSums[i] += s; });
  }
  const n = countries.length || 1;
  const componentScores = compSums.map((sum) => sum / n);
  const allScores = [...perCountry.values()].map((p) => p.score);
  const global = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 50;
  return { perCountry, componentScores, global };
}
