"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { GitCompareArrows, Plus, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import api from "@/lib/api";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface Country { id: string; name_en: string; flag_emoji: string }
interface IndicatorPoint { period: string; value: number; unit?: string }
interface MacroResponse {
  country_id: string
  country_name: string
  indicators: Record<string, IndicatorPoint[]>
}

// Indicateurs disponibles dans la comparaison
const COMPARE_INDICATORS: Record<string, string> = {
  NGDP_RPCH:    "Croissance PIB réel (%)",
  PCPIPCH:      "Inflation IPC (%)",
  GGXCNL_NGDP: "Solde budgétaire (% PIB)",
  GGXWDG_NGDP: "Dette publique (% PIB)",
  BCA_NGDPD:   "Compte courant (% PIB)",
  LUR:          "Chômage (%)",
};

const COLORS = ["#0ea5a0", "#f59e0b", "#6366f1", "#ec4899"];

// ──────────────────────────────────────────────────────────────
// Hooks
// ──────────────────────────────────────────────────────────────
function useCountries() {
  return useQuery<Country[]>({
    queryKey: ["countries-list"],
    queryFn: async () => {
      const r = await api.get("/countries");
      return r.data?.countries ?? r.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

function useCountryMacro(countryId: string | null, indicator: string) {
  return useQuery<MacroResponse>({
    queryKey: ["macro-compare", countryId, indicator],
    queryFn: async () => {
      const r = await api.get(`/macro/${countryId}`, { params: { indicators: indicator } });
      return r.data;
    },
    enabled: !!countryId,
    staleTime: 15 * 60 * 1000,
  });
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────
function CountrySelector({
  value,
  onChange,
  onRemove,
  countries,
  color,
  index,
}: {
  value: string | null
  onChange: (id: string) => void
  onRemove: () => void
  countries: Country[]
  color: string
  index: number
}) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
      <select
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--text-primary)" }}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Pays {index + 1} --</option>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {c.flag_emoji} {c.name_en}
          </option>
        ))}
      </select>
      <button onClick={onRemove} className="text-xs p-1 rounded hover:opacity-70 flex-shrink-0" style={{ color: "var(--text-muted)" }}>
        <X size={14} />
      </button>
    </div>
  );
}

function KpiCard({
  country,
  color,
  latestValue,
  trend,
  unit,
}: {
  country: Country | undefined
  color: string
  latestValue: number | null
  trend: "up" | "down" | "stable" | null
  unit: string
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "var(--text-muted)";

  return (
    <div className="p-4 rounded-xl border flex flex-col gap-2" style={{ borderColor: color + "40", background: "var(--bg-card)" }}>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {country ? `${country.flag_emoji} ${country.name_en}` : "—"}
        </span>
      </div>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-2xl font-bold" style={{ color }}>
          {latestValue !== null ? latestValue.toFixed(1) : "N/A"}
        </span>
        <span className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{unit}</span>
        {trend && (
          <span className="ml-auto">
            <TrendIcon size={16} color={trendColor} />
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [selectedCountries, setSelectedCountries] = useState<(string | null)[]>([null, null]);
  const [indicator, setIndicator] = useState<string>("NGDP_RPCH");

  const { data: countries = [], isLoading: loadingCountries } = useCountries();

  // Fetch macro data for each selected country
  const macroQueries = [0, 1, 2, 3].map((i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useCountryMacro(selectedCountries[i] ?? null, indicator)
  );

  // Build unified chart data (X = period years)
  const chartData = useMemo(() => {
    const periodsSet = new Set<string>();
    macroQueries.forEach(({ data }) => {
      if (!data) return;
      (data.indicators[indicator] ?? []).forEach((p) => periodsSet.add(p.period));
    });
    const periods = Array.from(periodsSet).sort();

    return periods.map((period) => {
      const row: Record<string, string | number | null> = { period };
      macroQueries.forEach(({ data }, i) => {
        if (!data) return;
        const point = (data.indicators[indicator] ?? []).find((p) => p.period === period);
        row[`country_${i}`] = point?.value ?? null;
      });
      return row;
    });
  }, [macroQueries, indicator]);

  function addCountry() {
    if (selectedCountries.length < 4) {
      setSelectedCountries([...selectedCountries, null]);
    }
  }

  function removeCountry(idx: number) {
    const next = selectedCountries.filter((_, i) => i !== idx);
    setSelectedCountries(next.length >= 2 ? next : [...next, null].slice(0, 2));
  }

  function setCountry(idx: number, id: string) {
    const next = [...selectedCountries];
    next[idx] = id || null;
    setSelectedCountries(next);
  }

  const indicatorUnit = COMPARE_INDICATORS[indicator]?.match(/\(([^)]+)\)/)?.[1] ?? "%";

  // Derive latest values & trends for KPI cards
  const kpiData = selectedCountries.map((cid, i) => {
    const data = macroQueries[i]?.data;
    const series = data?.indicators[indicator] ?? [];
    const sorted = [...series].sort((a, b) => b.period.localeCompare(a.period));
    const latest = sorted[0]?.value ?? null;
    const prev = sorted[1]?.value ?? null;
    const trend =
      latest === null || prev === null ? null
      : latest > prev + 0.1 ? "up"
      : latest < prev - 0.1 ? "down"
      : "stable";
    return { latest: latest as number | null, trend: trend as "up" | "down" | "stable" | null };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitCompareArrows size={22} style={{ color: "var(--mansa-green)" }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Comparaison multi-pays
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Analysez jusqu'à 4 pays côte à côte sur les indicateurs macro-fiscaux
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Indicateur selector */}
        <div className="p-4 rounded-xl border" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
            Indicateur
          </label>
          <select
            className="w-full bg-transparent text-sm outline-none font-medium"
            style={{ color: "var(--text-primary)" }}
            value={indicator}
            onChange={(e) => setIndicator(e.target.value)}
          >
            {Object.entries(COMPARE_INDICATORS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        {/* Country selectors */}
        <div className="space-y-2">
          {selectedCountries.map((cid, i) => (
            <CountrySelector
              key={i}
              value={cid}
              onChange={(id) => setCountry(i, id)}
              onRemove={() => removeCountry(i)}
              countries={countries}
              color={COLORS[i]}
              index={i}
            />
          ))}
          {selectedCountries.length < 4 && (
            <button
              onClick={addCountry}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-dashed w-full justify-center transition-opacity hover:opacity-70"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              <Plus size={13} /> Ajouter un pays
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {selectedCountries.map((cid, i) => (
          <KpiCard
            key={i}
            country={countries.find((c) => c.id === cid)}
            color={COLORS[i]}
            latestValue={kpiData[i].latest}
            trend={kpiData[i].trend}
            unit={indicatorUnit}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="p-5 rounded-2xl border" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          {COMPARE_INDICATORS[indicator]} — Évolution historique
        </h2>
        {chartData.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
            {loadingCountries || macroQueries.some((q) => q.isLoading)
              ? "Chargement des données…"
              : "Sélectionnez au moins un pays pour afficher le graphique"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {selectedCountries.map((cid, i) => {
                if (!cid) return null;
                const country = countries.find((c) => c.id === cid);
                return (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`country_${i}`}
                    name={country ? `${country.flag_emoji} ${country.name_en}` : `Pays ${i + 1}`}
                    stroke={COLORS[i]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Comparison table */}
      {selectedCountries.some((c) => !!c) && chartData.length > 0 && (
        <div className="p-5 rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
            Tableau comparatif (5 dernières années)
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--bg-border)" }}>
                  Année
                </th>
                {selectedCountries.map((cid, i) => {
                  if (!cid) return null;
                  const country = countries.find((c) => c.id === cid);
                  return (
                    <th key={i} className="text-right py-2 px-3 font-semibold"
                      style={{ color: COLORS[i], borderBottom: "1px solid var(--bg-border)" }}>
                      {country?.flag_emoji} {country?.name_en ?? `Pays ${i + 1}`}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {chartData.slice(-5).reverse().map((row) => (
                <tr key={row.period as string} className="hover:opacity-80 transition-opacity">
                  <td className="py-2 pr-4 font-mono text-xs" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--bg-border)" }}>
                    {row.period}
                  </td>
                  {selectedCountries.map((cid, i) => {
                    if (!cid) return null;
                    const val = row[`country_${i}`] as number | null;
                    return (
                      <td key={i} className="text-right py-2 px-3 font-mono"
                        style={{ color: val !== null ? "var(--text-primary)" : "var(--text-muted)", borderBottom: "1px solid var(--bg-border)" }}>
                        {val !== null ? val.toFixed(2) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
