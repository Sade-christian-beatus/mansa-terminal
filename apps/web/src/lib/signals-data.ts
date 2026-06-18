/**
 * Signaux haute fréquence — types et mapping des données réelles (pur, testable).
 *
 *   /alerts/macro  → signaux économiques (inflation, dette, déficit…)
 *   /acled/events  → signaux de conflit (UCDP/ACLED)
 * Sévérité API (critical/high/medium) → tiers UI (high/medium/low).
 */

export interface Signal {
  id: string;
  country: string;
  flag: string;
  type: "economic" | "conflict" | "climate" | "maritime" | "nightlights";
  severity: "high" | "medium" | "low";
  title: string;
  desc: string;
  source: string;
  indicator: string;
  value: string;
  change: number;
  date: string;
  sparkline?: number[];
  region: string;
}

export const API_SEVERITY: Record<string, Signal["severity"]> = {
  critical: "high", high: "medium", medium: "low", low: "low",
};

export interface MacroAlert {
  id: string; country_name: string; flag: string;
  indicator_label: string; value: number; unit: string;
  severity: string; message: string; period: string;
}

export interface ConflictEvent {
  country_id: string; name: string; flag: string; region: string;
  events_2024: number; fatalities_2024: number; trend: string;
  risk_level: string; notes?: string;
}

export function alertToSignal(a: MacroAlert): Signal {
  return {
    id: `macro-${a.id}`, country: a.country_name, flag: a.flag || "🌍",
    type: "economic", severity: API_SEVERITY[a.severity] ?? "low",
    title: `${a.indicator_label} — ${a.country_name}`, region: "",
    desc: a.message, source: "IMF WEO / MANSA DB",
    indicator: a.indicator_label,
    value: `${a.value}${a.unit ? " " + a.unit : ""}`,
    change: 0, date: a.period,
  };
}

export function eventToSignal(e: ConflictEvent): Signal {
  const change = e.trend === "increasing" ? 1 : e.trend === "decreasing" ? -1 : 0;
  return {
    id: `acled-${e.country_id}`, country: e.name, flag: e.flag || "🌍",
    type: "conflict", severity: API_SEVERITY[e.risk_level] ?? "low",
    title: `Conflit armé — ${e.name}`, region: e.region || "",
    desc: e.notes || `${e.events_2024.toLocaleString("fr")} événements violents, ${e.fatalities_2024.toLocaleString("fr")} décès (2024).`,
    source: "UCDP / ACLED", indicator: "Événements violents",
    value: `${e.events_2024.toLocaleString("fr")} évén.`,
    change, date: "2024",
  };
}
