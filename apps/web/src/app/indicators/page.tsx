"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Search, Filter, TrendingUp, TrendingDown, Download,
  Globe2, Activity, Minus, RefreshCw, ChevronDown,
} from "lucide-react";
import { macroApi } from "@/lib/api";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";

/* ── Catalogue indicateurs macro ── */
const INDICATORS = [
  { code: "NGDP_RPCH",    label: "Croissance du PIB réel",    unit: "%",    description: "Variation annuelle du PIB en volume (prix constants). Source : FMI WEO." },
  { code: "PCPIPCH",      label: "Inflation (IPC)",           unit: "%",    description: "Variation annuelle de l'indice des prix à la consommation. Source : FMI WEO." },
  { code: "GGXCNL_NGDP", label: "Solde budgétaire",          unit: "% PIB",description: "Solde global des administrations publiques en % du PIB. Source : FMI WEO." },
  { code: "GGXWDG_NGDP", label: "Dette publique",            unit: "% PIB",description: "Dette brute des administrations publiques en % du PIB. Source : FMI WEO." },
  { code: "BCA_NGDPD",   label: "Compte courant",             unit: "% PIB",description: "Solde du compte courant de la balance des paiements en % du PIB. Source : FMI WEO." },
  { code: "NGDPDPC",     label: "PIB par habitant",           unit: "USD",  description: "PIB nominal par habitant en dollars américains courants. Source : FMI WEO." },
  { code: "LUR",         label: "Taux de chômage",            unit: "%",    description: "Part de la population active sans emploi. Source : FMI WEO / ILO." },
];

const REGIONS = ["Toutes", "West Africa", "East Africa", "North Africa", "Central Africa", "Southern Africa"];

interface CountrySummary {
  id: string;
  iso2: string;
  name_en: string;
  name_fr: string | null;
  region: string | null;
  flag_emoji: string | null;
  coverage_tier: number;
}

interface IndicatorPoint {
  period: string;
  value: number;
  unit: string | null;
  source: string;
}

interface CountryMacro {
  country_id: string;
  country_name: string;
  indicators: Record<string, IndicatorPoint[]>;
}

/* ── Tooltip Recharts custom ── */
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="rounded-xl border px-3 py-2 text-sm shadow-xl"
         style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}>
      <p className="font-semibold">{label}</p>
      <p style={{ color: "var(--mansa-green)" }}>{v?.toFixed(2)} {unit}</p>
    </div>
  );
}

/* ── KPI card résumé ── */
function KpiCard({ label, value, unit, trend }: { label: string; value: number | null; unit: string; trend?: number }) {
  const Ic = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const color = trend == null ? "var(--text-muted)" : trend > 0 ? "#10B981" : "#EF4444";
  return (
    <div className="mansa-card rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value != null ? value.toFixed(1) : "—"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{unit}</span>
      </div>
      {trend != null && (
        <div className="flex items-center gap-1 mt-1 text-xs" style={{ color }}>
          <Ic size={11} />
          {trend > 0 ? "+" : ""}{trend.toFixed(1)} pts vs préc.
        </div>
      )}
    </div>
  );
}

export default function IndicatorsPage() {
  const [selectedInd,    setSelectedInd]    = useState(INDICATORS[0].code);
  const [selectedCountry,setSelectedCountry]= useState<string | null>(null);
  const [region,         setRegion]         = useState("Toutes");
  const [search,         setSearch]         = useState("");
  const [chartType,      setChartType]      = useState<"line" | "bar">("area");
  const [exportOpen,     setExportOpen]     = useState(false);

  const indMeta = INDICATORS.find((i) => i.code === selectedInd)!;

  /* ── Pays disponibles ── */
  const { data: countries = [], isLoading: countriesLoading } = useQuery<CountrySummary[]>({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const filteredCountries = useMemo(() =>
    countries.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        c.name_en.toLowerCase().includes(q) ||
        (c.name_fr ?? "").toLowerCase().includes(q);
      const matchRegion = region === "Toutes" || c.region === region;
      return matchSearch && matchRegion;
    }), [countries, search, region]
  );

  /* ── Données du pays sélectionné ── */
  const activeCountry = selectedCountry ?? filteredCountries[0]?.id ?? null;

  const { data: countryMacro, isLoading: macroLoading, refetch } = useQuery<CountryMacro>({
    queryKey: ["country-macro", activeCountry, selectedInd],
    queryFn: () => macroApi.getCountryMacro(activeCountry!, {
      indicators: selectedInd,
      from_year: 2010,
      to_year: 2025,
    }),
    enabled: !!activeCountry,
    staleTime: 1000 * 60 * 15,
  });

  const series: IndicatorPoint[] = countryMacro?.indicators[selectedInd] ?? [];
  const chartData = series.map((p) => ({ year: p.period, value: p.value }));

  /* ── KPIs résumé ── */
  const latestValue = series.length > 0 ? series[series.length - 1].value : null;
  const prevValue   = series.length > 1 ? series[series.length - 2].value : null;
  const trend       = latestValue != null && prevValue != null ? latestValue - prevValue : undefined;
  const avgValue    = series.length > 0 ? series.reduce((s, p) => s + p.value, 0) / series.length : null;
  const maxValue    = series.length > 0 ? Math.max(...series.map((p) => p.value)) : null;
  const minValue    = series.length > 0 ? Math.min(...series.map((p) => p.value)) : null;

  const activeCountryMeta = countries.find((c) => c.id === activeCountry);

  const handleExportData = async (): Promise<ExportRow[]> =>
    series.map((p) => ({
      country: activeCountry ?? "",
      indicator: selectedInd,
      indicator_name: indMeta.label,
      period: p.period,
      value: p.value,
      unit: p.unit ?? indMeta.unit,
      source: p.source,
    }));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <BarChart3 size={22} style={{ color: "var(--mansa-green)" }} />
            Indicateurs macroéconomiques
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {countries.length} pays · IMF WEO · World Bank WDI · Séries 2010–2025
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border transition-colors mansa-btn-ghost">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Download size={12} /> Exporter
          </button>
        </div>
      </div>

      {/* ── Sélecteur indicateur ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {INDICATORS.map((ind) => (
          <button
            key={ind.code}
            onClick={() => setSelectedInd(ind.code)}
            className="px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left"
            style={selectedInd === ind.code
              ? { background: "color-mix(in srgb, var(--mansa-green) 12%, var(--card-bg))", borderColor: "color-mix(in srgb, var(--mansa-green) 40%, transparent)", color: "var(--mansa-green)" }
              : { background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }
            }
          >
            {ind.label}
          </button>
        ))}
      </div>

      {/* ── Description indicateur ── */}
      <div className="rounded-xl px-4 py-3 border flex items-start gap-3"
           style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <Activity size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--mansa-green)" }} />
        <div>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{indMeta.label}</span>
          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>({indMeta.unit})</span>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{indMeta.description}</p>
        </div>
      </div>

      {/* ── Layout principal 3 colonnes ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* ── Colonne gauche : liste pays ── */}
        <div className="col-span-3 mansa-card rounded-2xl overflow-hidden" style={{ maxHeight: "70vh" }}>
          {/* Filtres */}
          <div className="px-3 pt-3 pb-2 border-b space-y-2" style={{ borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 border"
                 style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <Search size={12} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="bg-transparent text-xs focus:outline-none w-full"
                style={{ color: "var(--text-secondary)" }}
              />
            </div>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full text-xs rounded-lg px-2.5 py-1.5 border appearance-none focus:outline-none cursor-pointer"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
              >
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            </div>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 90px)" }}>
            {countriesLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg skeleton" />
                ))}
              </div>
            ) : (
              filteredCountries.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCountry(c.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-all text-left border-b"
                  style={{
                    borderColor: "var(--bg-border)",
                    background: activeCountry === c.id
                      ? "color-mix(in srgb, var(--mansa-green) 8%, var(--card-bg))"
                      : "",
                    borderLeft: activeCountry === c.id ? "2px solid var(--mansa-green)" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (activeCountry !== c.id) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"; }}
                  onMouseLeave={(e) => { if (activeCountry !== c.id) (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <span className="text-base">{c.flag_emoji ?? "🌍"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: activeCountry === c.id ? "var(--mansa-green)" : "var(--text-primary)" }}>
                      {c.name_fr ?? c.name_en}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{c.region ?? "Afrique"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Colonne droite : graphique + stats ── */}
        <div className="col-span-9 space-y-4">

          {/* KPIs résumé */}
          {activeCountryMeta && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeCountryMeta.flag_emoji ?? "🌍"}</span>
                <div>
                  <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    {activeCountryMeta.name_fr ?? activeCountryMeta.name_en}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{activeCountryMeta.region}</p>
                </div>
              </div>
              <div className="flex-1" />
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Dernière valeur" value={latestValue} unit={indMeta.unit} trend={trend} />
                <KpiCard label="Moyenne période" value={avgValue} unit={indMeta.unit} />
                <KpiCard label="Maximum" value={maxValue} unit={indMeta.unit} />
                <KpiCard label="Minimum" value={minValue} unit={indMeta.unit} />
              </div>
            </div>
          )}

          {/* Graphique */}
          <div className="mansa-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {indMeta.label} — {activeCountryMeta?.name_fr ?? activeCountryMeta?.name_en ?? "—"}
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Séries 2010–2025 · {series[0]?.source ?? "IMF WEO"}</p>
              </div>
              <div className="flex gap-1">
                {(["area", "bar"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartType(t as any)}
                    className="px-2.5 py-1 text-xs rounded-lg border transition-colors"
                    style={chartType === t
                      ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                      : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }
                    }
                  >
                    {t === "area" ? "Courbe" : "Barres"}
                  </button>
                ))}
              </div>
            </div>

            {macroLoading ? (
              <div className="h-64 skeleton rounded-xl" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-xl"
                   style={{ background: "var(--bg-border)" }}>
                <div className="text-center">
                  <Globe2 size={32} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Aucune donnée disponible pour cet indicateur.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                    Lancez le pipeline Dagster pour importer les données IMF WEO.
                  </p>
                </div>
              </div>
            ) : chartType === "area" ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="indGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip content={<CustomTooltip unit={indMeta.unit} />} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="value" stroke="#00D4AA" strokeWidth={2} fill="url(#indGrad)" dot={{ r: 3, fill: "#00D4AA" }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip content={<CustomTooltip unit={indMeta.unit} />} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                  <Bar dataKey="value" fill="#00D4AA" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tableau des valeurs */}
          {chartData.length > 0 && (
            <div className="mansa-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Données tabulaires · {indMeta.label}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--bg-border)" }}>
                      {["Année", "Valeur", "Unité", "Source", "Tendance"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {series.slice().reverse().map((point, i, arr) => {
                      const prevV = arr[i + 1]?.value;
                      const diff = prevV != null ? point.value - prevV : null;
                      return (
                        <tr key={point.period} className="border-b transition-colors"
                            style={{ borderColor: "var(--bg-border)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                          <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{point.period}</td>
                          <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                            {point.value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{point.unit ?? indMeta.unit}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                              {point.source}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {diff != null && (
                              <span className="flex items-center gap-1 text-xs"
                                    style={{ color: diff > 0 ? "#10B981" : diff < 0 ? "#EF4444" : "var(--text-muted)" }}>
                                {diff > 0 ? <TrendingUp size={10} /> : diff < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                                {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExportData}
        defaultFilename={`mansa-${selectedInd}-${activeCountry ?? "africa"}`}
        title="Exporter les données"
        subtitle={`${indMeta.label} · ${activeCountryMeta?.name_fr ?? activeCountryMeta?.name_en ?? "Pays sélectionné"}`}
      />
    </div>
  );
}
