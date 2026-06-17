"use client";

import { useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

import { averagePolicyRate } from "@/lib/national-sources";
import { averageSeries, sparklineSeries, type SparkPoint } from "@/lib/sparklines";
import { INDICATOR_BY_CODE, valueColor, type CountryDatum } from "./data";

const MANSA_GOLD = "#C9A227";

interface KpiDef {
  code: string;
  label: string;
  unit: string;
  better: "high" | "low" | "neutral";
  signed?: boolean;
  /** valeur continentale de repli si l'indicateur n'est pas dans le tableau */
  fallbackValue?: number;
  sourceNote?: string;
}

const KPIS: KpiDef[] = [
  { code: "NGDP_RPCH",   label: "Croissance PIB",   unit: "%",     better: "high", signed: true },
  { code: "PCPIPCH",     label: "Inflation (IPC)",  unit: "%",     better: "low"  },
  { code: "GGXWDG_NGDP", label: "Dette publique",   unit: "% PIB", better: "low"  },
  { code: "BCA_NGDPD",   label: "Compte courant",   unit: "% PIB", better: "high", signed: true },
  { code: "FX_RESERVES", label: "Réserves change",  unit: "mois",  better: "high", fallbackValue: 4.3, sourceNote: "estim. continentale" },
  { code: "INT_POLICY",  label: "Taux directeur",   unit: "%",     better: "low",  sourceNote: "moy. banques centrales" },
];

function kpiColor(def: KpiDef, value: number | null): string {
  if (value == null) return "var(--text-muted)";
  const cat = INDICATOR_BY_CODE[def.code];
  if (cat) return valueColor(cat, value);
  // Indicateurs hors catalogue (réserves, taux directeur)
  if (def.code === "FX_RESERVES") return value >= 4 ? "#10B981" : value >= 3 ? "#F59E0B" : "#EF4444";
  if (def.code === "INT_POLICY")  return value < 6 ? "#10B981" : value < 12 ? "#F59E0B" : "#EF4444";
  return "var(--text-primary)";
}

function KpiCard({ def, rows, active, onSelect }: {
  def: KpiDef; rows: CountryDatum[]; active: boolean; onSelect: () => void;
}) {
  const { value, delta, series } = useMemo(() => {
    const present = rows.some((r) => r.values[def.code] != null);
    if (present) {
      const vals = rows.map((r) => r.values[def.code]).filter((x): x is number => x != null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const s = averageSeries(def.code, rows);
      const d = s.length >= 2 ? s[s.length - 1].value - s[s.length - 2].value : null;
      return { value: avg, delta: d, series: s };
    }
    const fb = def.fallbackValue ?? (def.code === "INT_POLICY" ? averagePolicyRate() : null);
    const s: SparkPoint[] = fb != null ? sparklineSeries(def.code, "AFR", fb) : [];
    const d = s.length >= 2 ? s[s.length - 1].value - s[s.length - 2].value : null;
    return { value: fb, delta: d, series: s };
  }, [def, rows]);

  const color = kpiColor(def, value);
  const deltaPositive = (delta ?? 0) >= 0;
  // Une variation est "favorable" selon le sens de l'indicateur
  const deltaGood = def.better === "neutral" ? deltaPositive
    : def.better === "high" ? deltaPositive : !deltaPositive;
  const deltaColor = delta == null ? "var(--text-muted)" : deltaGood ? "#10B981" : "#EF4444";

  return (
    <button
      onClick={onSelect}
      className="text-left rounded-xl border p-3 transition-all hover:-translate-y-0.5"
      style={{
        background: active ? `color-mix(in srgb, ${MANSA_GOLD} 8%, var(--card-bg))` : "var(--card-bg)",
        borderColor: active ? MANSA_GOLD : "var(--bg-border)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{def.label}</span>
        {active && <span style={{ color: MANSA_GOLD }} className="text-[10px]">⇅</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xl font-bold font-mono leading-none" style={{ color }}>
            {value != null ? `${def.signed && value >= 0 ? "+" : ""}${value.toFixed(1)}` : "—"}
            <span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{def.unit}</span>
          </div>
          {delta != null ? (
            <div className="flex items-center gap-0.5 mt-1 text-[10px] font-mono" style={{ color: deltaColor }}>
              {deltaPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {deltaPositive ? "+" : ""}{delta.toFixed(1)}{def.unit === "mois" ? "" : "pp"}
            </div>
          ) : (
            <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{def.sourceNote ?? "Moy. Afrique"}</div>
          )}
        </div>
        <div className="w-20 h-9 flex-shrink-0">
          {series.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </button>
  );
}

export function KpiBand({ rows, sortKey, onSort }: {
  rows: CountryDatum[]; sortKey: string; onSort: (code: string) => void;
}) {
  return (
    <div className="px-5 py-4 border-b grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
         style={{ borderColor: "var(--bg-border)" }}>
      {KPIS.map((def) => (
        <KpiCard
          key={def.code}
          def={def}
          rows={rows}
          active={sortKey === def.code}
          onSelect={() => onSort(def.code)}
        />
      ))}
    </div>
  );
}
