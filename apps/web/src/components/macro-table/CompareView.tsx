"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { X, ImageDown } from "lucide-react";

import { forecastApi } from "@/lib/api";
import { exportSVGtoPNG } from "@/lib/export-utils";
import {
  INDICATOR_BY_CODE, INDICATOR_CATALOG, formatValue, computeBadge,
  regionalAverage, africanRank, type CountryDatum,
} from "./data";
import { Flag, PerfBadge } from "./ui";

const SERIES_COLORS = ["#1F3A5F", "#C9A227", "#0E7490", "#BE123C", "#7C3AED", "#15803D", "#B45309", "#EF4444", "#0891B2", "#9333EA"];

const RADAR_AXES = [
  { key: "growth", label: "Croissance",       norm: (v: Record<string, number>) => clamp((v.NGDP_RPCH ?? 0) / 10 * 100) },
  { key: "price",  label: "Stabilité prix",   norm: (v: Record<string, number>) => clamp((20 - (v.PCPIPCH ?? 20)) / 20 * 100) },
  { key: "debt",   label: "Soutenab. dette",  norm: (v: Record<string, number>) => clamp((120 - (v.GGXWDG_NGDP ?? 120)) / 120 * 100) },
  { key: "ext",    label: "Équilibre externe",norm: (v: Record<string, number>) => clamp(((v.BCA_NGDPD ?? -15) + 15) / 20 * 100) },
  { key: "score",  label: "Score global",     norm: (v: Record<string, number>) => computeBadge(v).score },
];

function clamp(x: number) { return Math.max(0, Math.min(100, x)); }

export function CompareView({
  countries, allData, onClose,
}: { countries: CountryDatum[]; allData: CountryDatum[]; onClose: () => void }) {
  const [lineIndicator, setLineIndicator] = useState("NGDP_RPCH");
  const radarRef = useRef<HTMLDivElement>(null);

  // Indicateurs présents parmi les pays sélectionnés
  const presentCodes = useMemo(() => {
    const set = new Set<string>();
    countries.forEach((c) => Object.keys(c.values).forEach((k) => set.add(k)));
    return INDICATOR_CATALOG.filter((d) => set.has(d.code));
  }, [countries]);

  // Données radar : un objet par axe, une clé par pays
  const radarData = useMemo(() =>
    RADAR_AXES.map((axis) => {
      const point: Record<string, number | string> = { axis: axis.label };
      countries.forEach((c) => { point[c.id] = Math.round(axis.norm(c.values)); });
      return point;
    }), [countries]);

  // Séries temporelles superposées (historique réel par pays)
  const { data: lineSeries, isLoading: lineLoading } = useQuery({
    queryKey: ["compare-line", countries.map((c) => c.id).join(","), lineIndicator],
    queryFn: async () => {
      const results = await Promise.all(
        countries.map((c) =>
          forecastApi.getIndicator(c.id, lineIndicator, { horizon: 0 })
            .then((r) => ({ id: c.id, historical: r.historical }))
            .catch(() => ({ id: c.id, historical: [] as { year: number; value: number }[] })),
        ),
      );
      // Fusionner par année
      const byYear: Record<number, Record<string, number>> = {};
      results.forEach((r) => r.historical.forEach((h) => {
        byYear[h.year] = byYear[h.year] || {};
        byYear[h.year][r.id] = h.value;
      }));
      return Object.entries(byYear)
        .map(([year, vals]) => ({ year: Number(year), ...vals }))
        .sort((a, b) => a.year - b.year);
    },
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const lineDef = INDICATOR_BY_CODE[lineIndicator];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl animate-fade-in"
        style={{ background: "var(--card-bg)", border: "1px solid var(--bg-border)" }}
      >
        {/* En-tête */}
        <div className="sticky top-0 z-10 px-5 py-4 border-b flex items-center justify-between" style={{ background: "#1F3A5F", borderColor: "rgba(255,255,255,0.1)" }}>
          <div>
            <h2 className="text-lg font-bold text-white">Comparaison multi-pays</h2>
            <p className="text-xs text-white/60">{countries.length} pays · valeurs actuelles, moyennes régionales & rang africain</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/80" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Sélection pays */}
          <div className="flex flex-wrap gap-2">
            {countries.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "var(--bg-border)", background: "var(--input-bg)" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                <Flag iso3={c.id} w={20} h={14} />
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <PerfBadge badge={computeBadge(c.values)} />
              </div>
            ))}
          </div>

          {/* Radar + Courbes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Radar */}
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--bg-border)" }} ref={radarRef}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Profil comparatif (0–100, ↑ = mieux)</h3>
                <button onClick={() => exportSVGtoPNG(radarRef.current?.querySelector("svg") ?? null, "mansa_comparaison_radar")}
                  title="Exporter en PNG" className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded" style={{ color: "var(--text-muted)" }}>
                  <ImageDown size={13} /> PNG
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke="var(--bg-border)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  {countries.map((c, i) => (
                    <Radar key={c.id} name={c.name} dataKey={c.id}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]} fillOpacity={0.12} strokeWidth={2} />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Courbes superposées */}
            <div className="rounded-xl border p-4" style={{ borderColor: "var(--bg-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Évolution historique</h3>
                <select value={lineIndicator} onChange={(e) => setLineIndicator(e.target.value)}
                  className="text-[11px] rounded-lg px-2 py-1 border" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                  {presentCodes.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}
                </select>
              </div>
              {lineLoading ? (
                <div className="h-[300px] rounded-lg skeleton" />
              ) : (lineSeries && lineSeries.length > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineSeries} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={36} />
                    <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v: number) => lineDef ? formatValue(lineDef, v) : v} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {countries.map((c, i) => (
                      <Line key={c.id} type="monotone" dataKey={c.id} name={c.name}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Pas de série historique disponible pour cet indicateur
                </div>
              )}
            </div>
          </div>

          {/* Tableau comparatif */}
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--bg-border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--sidebar-bg)" }}>
                  <th className="px-3 py-2.5 text-left font-semibold" style={{ color: "var(--text-muted)" }}>Indicateur</th>
                  {countries.map((c) => (
                    <th key={c.id} className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--text-primary)" }}>
                      <div className="flex items-center justify-end gap-1.5"><Flag iso3={c.id} w={18} h={12} />{c.id}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold" style={{ color: "var(--text-muted)" }}>Moy. Afrique</th>
                </tr>
              </thead>
              <tbody>
                {presentCodes.map((def, idx) => {
                  const avg = regionalAverage(allData, def.code);
                  return (
                    <tr key={def.code} style={{ borderTop: "1px solid var(--bg-border)", background: idx % 2 ? "color-mix(in srgb, var(--sidebar-bg) 30%, transparent)" : "transparent" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--text-secondary)" }}>
                        {def.label} <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>({def.unit})</span>
                      </td>
                      {countries.map((c) => {
                        const v = c.values[def.code];
                        const rk = africanRank(allData, def.code, c.id, def.better);
                        return (
                          <td key={c.id} className="px-3 py-2 text-right font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
                            {formatValue(def, v)}
                            {rk && def.better !== "neutral" && (
                              <span className="block text-[9px] font-normal" style={{ color: "var(--text-muted)" }}>#{rk.rank}/{rk.total}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--text-muted)" }}>{avg != null ? formatValue(def, avg) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Rang calculé sur l'ensemble des pays africains disposant de la donnée. Sources : FMI WEO · Banque Mondiale WDI.
          </p>
        </div>
      </div>
    </div>
  );
}
