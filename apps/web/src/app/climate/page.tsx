"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Leaf, Zap, Wind, TrendingUp, Download,
  Droplets, Flame, CloudRain, TreePine, AlertTriangle,
} from "lucide-react";
import { climateApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";

/* ─── Types ────────────────────────────────────────────────── */
interface CountryClimate {
  country_id: string;
  name: string;
  flag: string;
  indicators: {
    CO2_PC?: number;
    ELEC_ACC?: number;
    REN_PCT?: number;
    CLIM_FIN_USD?: number;
  };
}
interface ClimateSummary {
  continent_averages: {
    co2_per_capita: number;
    electricity_access: number;
    renewables_share: number;
    total_climate_finance_m_usd: number;
  };
  leaders: {
    cleanest_energy:  { country: string; value: number; flag: string };
    best_elec_access: { country: string; value: number; flag: string };
    lowest_co2_pc:    { country: string; value: number; flag: string };
  };
}

/* ─── Données EM-DAT simulées (seront remplacées par API) ── */
const EMDAT_DISASTERS = [
  { country: "Kenya",         flag: "🇰🇪", type: "flood",    deaths: 59,   affected: 27_000, year: 2025, impact: "Mombasa & Nairobi inondées" },
  { country: "Éthiopie",      flag: "🇪🇹", type: "drought",  deaths: 0,    affected: 8_200_000, year: 2024, impact: "Sécheresse Corne Afrique" },
  { country: "Somalie",       flag: "🇸🇴", type: "drought",  deaths: 0,    affected: 6_500_000, year: 2024, impact: "Cycle sécheresses récurrentes" },
  { country: "Mozambique",    flag: "🇲🇿", type: "cyclone",  deaths: 183,  affected: 1_100_000, year: 2023, impact: "Cyclone Freddy Cat 4" },
  { country: "Afrique du Sud",flag: "🇿🇦", type: "flood",    deaths: 435,  affected: 40_000, year: 2022, impact: "Inondations KwaZulu-Natal" },
  { country: "Nigéria",       flag: "🇳🇬", type: "flood",    deaths: 603,  affected: 2_500_000, year: 2022, impact: "Pires inondations depuis 10 ans" },
  { country: "Madagascar",    flag: "🇲🇬", type: "cyclone",  deaths: 120,  affected: 570_000, year: 2022, impact: "Cyclone Batsirai" },
  { country: "Libye",         flag: "🇱🇾", type: "flood",    deaths: 11_300, affected: 300_000, year: 2023, impact: "Tempête Daniel — Derna" },
];

const DISASTER_COLORS: Record<string, string> = {
  flood:   "#3B82F6",
  drought: "#F59E0B",
  cyclone: "#8B5CF6",
  epidemic:"#EF4444",
  wildfire:"#F97316",
};
const DISASTER_ICONS: Record<string, React.ElementType> = {
  flood:   Droplets,
  drought: Flame,
  cyclone: CloudRain,
  epidemic:AlertTriangle,
  wildfire:Flame,
};

/* ─── WRI Aqueduct water stress (simulé) ─────────────────── */
const WATER_STRESS = [
  { country: "Libye",          flag: "🇱🇾", score: 4.8, level: "Extrême",  color: "#EF4444" },
  { country: "Algérie",        flag: "🇩🇿", score: 4.2, level: "Très élevé",color: "#F97316" },
  { country: "Égypte",         flag: "🇪🇬", score: 4.1, level: "Très élevé",color: "#F97316" },
  { country: "Maroc",          flag: "🇲🇦", score: 3.6, level: "Élevé",     color: "#F59E0B" },
  { country: "Tunisie",        flag: "🇹🇳", score: 3.4, level: "Élevé",     color: "#F59E0B" },
  { country: "Mozambique",     flag: "🇲🇿", score: 3.8, level: "Élevé",     color: "#F59E0B" },
  { country: "Éthiopie",       flag: "🇪🇹", score: 2.9, level: "Moyen-haut",color: "#FCD34D" },
  { country: "Kenya",          flag: "🇰🇪", score: 2.6, level: "Moyen-haut",color: "#FCD34D" },
  { country: "Congo (RDC)",    flag: "🇨🇩", score: 0.4, level: "Faible",    color: "#10B981" },
  { country: "Gabon",          flag: "🇬🇦", score: 0.2, level: "Très faible",color: "#06B6D4" },
];

/* ─── EIA Energy mix (simulé) ────────────────────────────── */
const ENERGY_MIX_RADAR = [
  { subject: "Pétrole",  NGE: 82, MAR: 58, EGY: 75, ZAF: 12 },
  { subject: "Gaz",      NGE: 12, MAR: 30, EGY: 20, ZAF: 22 },
  { subject: "Charbon",  NGE: 1,  MAR: 5,  EGY: 1,  ZAF: 87 },
  { subject: "Hydro",    NGE: 1,  MAR: 4,  EGY: 3,  ZAF: 1  },
  { subject: "Solaire",  NGE: 2,  MAR: 2,  EGY: 0,  ZAF: 4  },
  { subject: "Biomasse", NGE: 2,  MAR: 1,  EGY: 1,  ZAF: 4  },
];

/* ─── Sous-composants ───────────────────────────────────── */
function KpiStat({
  icon: Icon, label, value, unit, color, sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ backgroundColor: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
        {value}<span className="text-sm ml-1" style={{ color: "var(--text-muted)" }}>{unit}</span>
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "var(--bg-border)" }}>
      <div className="h-full rounded-full transition-all duration-500"
           style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/* ─── Page principale ───────────────────────────────────── */
export default function ClimatePage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [activeTab,  setActiveTab]  = useState<"overview" | "disasters" | "water" | "energy">("overview");

  const { data: climateData, isLoading: climateLoading } = useQuery({
    queryKey: ["climate-indicators"],
    queryFn: () => climateApi.getIndicators(),
    staleTime: 1000 * 60 * 60,
  });
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["climate-summary"],
    queryFn: () => climateApi.getSummary(),
    staleTime: 1000 * 60 * 60,
  });

  const countries: CountryClimate[] = (climateData as any)?.data ?? [];
  const summary: ClimateSummary | null = (summaryData as any) ?? null;

  const co2Data = [...countries]
    .filter((c) => c.indicators.CO2_PC != null)
    .sort((a, b) => (b.indicators.CO2_PC ?? 0) - (a.indicators.CO2_PC ?? 0))
    .slice(0, 12)
    .map((c) => ({ name: c.country_id, value: c.indicators.CO2_PC!, flag: c.flag }));

  const renewablesSorted = [...countries]
    .filter((c) => c.indicators.REN_PCT != null)
    .sort((a, b) => (b.indicators.REN_PCT ?? 0) - (a.indicators.REN_PCT ?? 0));

  const electricityByRegion = [...countries]
    .filter((c) => c.indicators.ELEC_ACC != null)
    .sort((a, b) => (b.indicators.ELEC_ACC ?? 0) - (a.indicators.ELEC_ACC ?? 0));

  const totalDeaths   = EMDAT_DISASTERS.reduce((s, d) => s + d.deaths, 0);
  const totalAffected = EMDAT_DISASTERS.reduce((s, d) => s + d.affected, 0);

  const handleExport = async (_sources: string[], yFrom: number, yTo: number): Promise<ExportRow[]> => {
    const rows: ExportRow[] = [];
    // Données climate
    countries.forEach((c) => {
      rows.push({
        dataset: "Climate",
        country: c.country_id,
        name: c.name,
        co2_per_capita: c.indicators.CO2_PC ?? null,
        electricity_access_pct: c.indicators.ELEC_ACC ?? null,
        renewables_pct: c.indicators.REN_PCT ?? null,
        climate_finance_musd: c.indicators.CLIM_FIN_USD ?? null,
      });
    });
    // EM-DAT
    EMDAT_DISASTERS
      .filter((d) => d.year >= yFrom && d.year <= yTo)
      .forEach((d) => {
        rows.push({
          dataset: "EM-DAT Disasters",
          country: d.country,
          disaster_type: d.type,
          deaths: d.deaths,
          affected: d.affected,
          year: d.year,
          description: d.impact,
        });
      });
    // Water stress
    WATER_STRESS.forEach((w) => {
      rows.push({
        dataset: "WRI Aqueduct",
        country: w.country,
        water_stress_score: w.score,
        water_stress_level: w.level,
      });
    });
    return rows;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <Leaf size={22} className="text-emerald-400" />
            Climat & ESG
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            CO₂ · Électricité · Renouvelables · Catastrophes (EM-DAT) · Stress hydrique (WRI) · Énergie (EIA)
          </p>
        </div>
        <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-sm flex items-center gap-2">
          <Download size={14} /> Exporter
        </button>
      </div>

      {/* ── KPI continentaux ── */}
      {summaryLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mansa-card rounded-xl h-28 skeleton" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiStat icon={Wind}       label="CO₂ moyen / habitant"  value={summary.continent_averages.co2_per_capita.toFixed(2)}  unit="t"  color="#EF4444" sub="Moyenne Afrique vs 4.7t monde" />
          <KpiStat icon={Zap}        label="Accès électricité"      value={summary.continent_averages.electricity_access.toFixed(1)} unit="%" color="#F59E0B" sub="Population avec accès" />
          <KpiStat icon={Leaf}       label="Mix renouvelables"       value={summary.continent_averages.renewables_share.toFixed(1)} unit="%"  color="#10B981" sub="Part dans la production" />
          <KpiStat icon={TrendingUp} label="Finance climatique"      value={`$${(summary.continent_averages.total_climate_finance_m_usd / 1000).toFixed(1)}B`} unit="" color="#3B82F6" sub="Total reçu (réf. 2022)" />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--bg-border)" }}>
        {([
          { id: "overview",  label: "Vue générale",     icon: Leaf },
          { id: "disasters", label: "Catastrophes EM-DAT", icon: AlertTriangle },
          { id: "water",     label: "Stress hydrique",  icon: Droplets },
          { id: "energy",    label: "Mix énergétique",  icon: Zap },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={
              activeTab === id
                ? { borderBottomColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                : { borderBottomColor: "transparent", color: "var(--text-muted)" }
            }
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Vue générale ── */}
      {activeTab === "overview" && (
        <>
          {/* Leaders */}
          {summary && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: "Énergie la plus propre",     key: "cleanest_energy",  color: "#10B981", unit: "% renouvelables" },
                { title: "Meilleur accès électrique",  key: "best_elec_access", color: "#F59E0B", unit: "% population" },
                { title: "Empreinte CO₂ la plus basse",key: "lowest_co2_pc",    color: "#3B82F6", unit: "t CO₂/hab" },
              ].map(({ title, key, color, unit }) => {
                const leader = summary.leaders[key as keyof typeof summary.leaders];
                return (
                  <div key={key} className="mansa-card rounded-xl p-4 flex items-center gap-4">
                    <span className="text-3xl">{leader.flag}</span>
                    <div>
                      <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{title}</p>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{leader.country}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color }}>{leader.value.toFixed(1)} {unit}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {climateLoading ? (
            <div className="grid grid-cols-2 gap-6">
              {[1,2].map((i) => <div key={i} className="mansa-card rounded-xl h-72 skeleton" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CO2 */}
              <div className="mansa-card rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  Émissions CO₂ par habitant (tonnes)
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={co2Data} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "8px", fontSize: 12 }}
                      itemStyle={{ color: "var(--text-secondary)" }}
                      formatter={(v: number) => [`${v.toFixed(2)} t`, "CO₂/hab"]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {co2Data.map((e) => (
                        <Cell key={e.name} fill={e.value > 3 ? "#EF4444" : e.value > 1 ? "#F59E0B" : "#10B981"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Renouvelables */}
              <div className="mansa-card rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  Part des énergies renouvelables (%)
                </h3>
                <div className="space-y-2 overflow-y-auto max-h-[220px]">
                  {renewablesSorted.map((c) => (
                    <div key={c.country_id} className="flex items-center gap-3">
                      <span className="text-sm w-6">{c.flag}</span>
                      <span className="text-xs w-24 truncate" style={{ color: "var(--text-muted)" }}>{c.name}</span>
                      <ProgressBar value={c.indicators.REN_PCT ?? 0} color="#10B981" />
                      <span className="text-xs font-mono text-emerald-400 w-12 text-right">
                        {(c.indicators.REN_PCT ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Accès électricité */}
          {!climateLoading && (
            <div className="mansa-card rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                Accès à l&apos;électricité par pays (% population)
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
                {electricityByRegion.map((c) => (
                  <div key={c.country_id} className="flex items-center gap-2">
                    <span className="text-sm">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.name}</span>
                        <span className={`text-xs font-mono ml-2 flex-shrink-0 ${
                          (c.indicators.ELEC_ACC ?? 0) > 80 ? "text-emerald-400" :
                          (c.indicators.ELEC_ACC ?? 0) > 50 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {(c.indicators.ELEC_ACC ?? 0).toFixed(0)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={c.indicators.ELEC_ACC ?? 0}
                        color={(c.indicators.ELEC_ACC ?? 0) > 80 ? "#10B981" : (c.indicators.ELEC_ACC ?? 0) > 50 ? "#F59E0B" : "#EF4444"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Catastrophes EM-DAT ── */}
      {activeTab === "disasters" && (
        <div className="space-y-5">
          {/* KPIs EM-DAT */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Événements recensés", value: EMDAT_DISASTERS.length, color: "#F59E0B" },
              { label: "Décès totaux",         value: totalDeaths.toLocaleString("fr-FR"), color: "#EF4444" },
              { label: "Personnes affectées",  value: `${(totalAffected / 1_000_000).toFixed(1)}M`,   color: "#F97316" },
              { label: "Pays concernés",       value: new Set(EMDAT_DISASTERS.map((d) => d.country)).size, color: "#3B82F6" },
            ].map((k) => (
              <div key={k.label} className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Légende types */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(DISASTER_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            ))}
          </div>

          {/* Tableau catastrophes */}
          <div className="mansa-card rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_3fr] gap-4 px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
                 style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
              <span>Pays</span><span>Type</span><span>Décès</span><span>Affectés</span><span>Description</span>
            </div>
            {EMDAT_DISASTERS.map((d, i) => {
              const DisIcon = DISASTER_ICONS[d.type] ?? AlertTriangle;
              const color   = DISASTER_COLORS[d.type] ?? "#6B7280";
              return (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_3fr] gap-4 px-4 py-3 items-center border-b text-sm transition-colors hover:opacity-90"
                  style={{ borderColor: "var(--bg-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{d.flag}</span>
                    <div>
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>{d.country}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.year}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DisIcon size={13} style={{ color }} />
                    <span className="text-xs capitalize" style={{ color }}>{d.type}</span>
                  </div>
                  <span className="font-mono text-sm" style={{ color: d.deaths > 100 ? "#EF4444" : "var(--text-secondary)" }}>
                    {d.deaths > 0 ? d.deaths.toLocaleString("fr-FR") : "—"}
                  </span>
                  <span className="font-mono text-sm text-amber-400">
                    {d.affected >= 1_000_000
                      ? `${(d.affected / 1_000_000).toFixed(1)}M`
                      : d.affected >= 1_000
                      ? `${(d.affected / 1_000).toFixed(0)}K`
                      : d.affected}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{d.impact}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Source : EM-DAT International Disaster Database — CRED / UCLouvain · Mise à jour : juin 2025
          </p>
        </div>
      )}

      {/* ── Tab: Stress hydrique ── */}
      {activeTab === "water" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Pays stress extrême",      value: WATER_STRESS.filter((w) => w.score >= 4).length,   color: "#EF4444" },
              { label: "Pays stress élevé",         value: WATER_STRESS.filter((w) => w.score >= 3 && w.score < 4).length, color: "#F97316" },
              { label: "Score moyen Afrique (5)",   value: (WATER_STRESS.reduce((s, w) => s + w.score, 0) / WATER_STRESS.length).toFixed(1), color: "#F59E0B" },
            ].map((k) => (
              <div key={k.label} className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="mansa-card rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Droplets size={15} className="text-blue-400" />
              Score de stress hydrique WRI Aqueduct (0–5)
            </h3>
            <div className="space-y-3">
              {WATER_STRESS.sort((a, b) => b.score - a.score).map((w) => (
                <div key={w.country} className="flex items-center gap-3">
                  <span className="text-lg w-7">{w.flag}</span>
                  <span className="text-sm w-32 truncate" style={{ color: "var(--text-secondary)" }}>{w.country}</span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(w.score / 5) * 100}%`, background: w.color }} />
                    </div>
                  </div>
                  <span className="text-xs font-mono w-8 text-right" style={{ color: w.color }}>{w.score}</span>
                  <span className="text-xs w-28 text-right" style={{ color: "var(--text-muted)" }}>{w.level}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mansa-card rounded-xl p-4 border-l-4" style={{ borderLeftColor: "#F59E0B" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-400 mb-1">Alerte stress hydrique Maghreb</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  La Libye, l&apos;Algérie et l&apos;Égypte présentent un stress hydrique extrême (score &gt; 4/5).
                  Les projections climatiques indiquent une aggravation de 10–20% d&apos;ici 2050 dans ces régions.
                  Source : WRI Aqueduct Water Risk Atlas v4.0 (2023).
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Source : WRI Aqueduct Water Risk Atlas v4.0 · World Resources Institute · 2023
          </p>
        </div>
      )}

      {/* ── Tab: Mix énergétique ── */}
      {activeTab === "energy" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-6">
            {/* Radar EIA */}
            <div className="mansa-card rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Mix énergétique comparé (EIA)
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Nigeria · Maroc · Égypte · Afrique du Sud
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={ENERGY_MIX_RADAR}>
                  <PolarGrid stroke="var(--bg-border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                  <Radar name="Nigeria"       dataKey="NGE" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
                  <Radar name="Maroc"         dataKey="MAR" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} />
                  <Radar name="Égypte"        dataKey="EGY" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
                  <Radar name="Afrique du Sud" dataKey="ZAF" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
                  <Tooltip
                    contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: "var(--text-secondary)" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {[
                  { label: "Nigeria",        color: "#10B981" },
                  { label: "Maroc",          color: "#3B82F6" },
                  { label: "Égypte",         color: "#F59E0B" },
                  { label: "Afrique du Sud", color: "#EF4444" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Production pétrolière top africains */}
            <div className="mansa-card rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Production pétrolière (EIA) — Mb/jour
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Principaux producteurs africains · 2024
              </p>
              <div className="space-y-3">
                {[
                  { country: "Nigeria",      flag: "🇳🇬", prod: 1.44 },
                  { country: "Libye",        flag: "🇱🇾", prod: 1.18 },
                  { country: "Algérie",      flag: "🇩🇿", prod: 1.09 },
                  { country: "Angola",       flag: "🇦🇴", prod: 1.12 },
                  { country: "Égypte",       flag: "🇪🇬", prod: 0.57 },
                  { country: "Congo (RDC)",  flag: "🇨🇩", prod: 0.26 },
                  { country: "Gabon",        flag: "🇬🇦", prod: 0.22 },
                  { country: "Ghana",        flag: "🇬🇭", prod: 0.13 },
                ].map((c) => (
                  <div key={c.country} className="flex items-center gap-3">
                    <span>{c.flag}</span>
                    <span className="text-xs w-28" style={{ color: "var(--text-secondary)" }}>{c.country}</span>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(c.prod / 1.5) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-amber-400 w-12 text-right">{c.prod}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GFW déforestation */}
          <div className="mansa-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TreePine size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Déforestation — Global Forest Watch (GFW)
              </h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { country: "Congo (RDC)",  flag: "🇨🇩", loss_ha: 1_490_000, trend: "↑", color: "#EF4444" },
                { country: "Angola",       flag: "🇦🇴", loss_ha: 620_000,   trend: "→", color: "#F59E0B" },
                { country: "Mozambique",   flag: "🇲🇿", loss_ha: 480_000,   trend: "↑", color: "#EF4444" },
                { country: "Cameroun",     flag: "🇨🇲", loss_ha: 290_000,   trend: "→", color: "#F59E0B" },
                { country: "Côte d'Ivoire",flag: "🇨🇮", loss_ha: 185_000,   trend: "↓", color: "#10B981" },
                { country: "Ghana",        flag: "🇬🇭", loss_ha: 132_000,   trend: "↓", color: "#10B981" },
                { country: "Madagascar",   flag: "🇲🇬", loss_ha: 102_000,   trend: "→", color: "#F59E0B" },
                { country: "Éthiopie",     flag: "🇪🇹", loss_ha: 87_000,    trend: "↑", color: "#EF4444" },
              ].map((g) => (
                <div key={g.country} className="mansa-card rounded-xl p-3 border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span>{g.flag}</span>
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{g.country}</span>
                  </div>
                  <p className="text-lg font-bold font-mono" style={{ color: g.color }}>
                    {(g.loss_ha / 1_000).toFixed(0)}K ha
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Perte forêt 2023 {g.trend}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sources : EIA International Energy Statistics · GFW Global Forest Watch · Hansen/UMD/Google/USGS/NASA
          </p>
        </div>
      )}

      {/* ── Footer sources ── */}
      <p className="text-xs pb-4" style={{ color: "var(--text-muted)" }}>
        Sources : Banque Mondiale WDI · IEA · IRENA · Climate Policy Initiative · EM-DAT CRED ·
        WRI Aqueduct · EIA International · Global Forest Watch · NASA VIIRS · MANSA Terminal
      </p>

      {/* ── Export Modal ── */}
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExport}
        defaultFilename="mansa-climate-esg"
        title="Exporter les données Climat & ESG"
        subtitle="CO₂ · Électricité · EM-DAT Catastrophes · Stress hydrique · Énergie EIA"
        preSelectedSources={["World_Bank_WDI", "EMDAT_CRED", "EIA_International", "NASA_VIIRS"]}
      />
    </div>
  );
}
