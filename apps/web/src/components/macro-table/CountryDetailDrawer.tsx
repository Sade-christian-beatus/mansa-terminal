"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { forecastApi, type ForecastResult } from "@/lib/api";
import {
  MANSA_NAVY, MANSA_GOLD, INDICATOR_BY_CODE, INDICATOR_CATALOG, formatValue, valueColor,
  computeBadge, type CountryDatum,
} from "./data";
import { getCentralBank, getStatsInstitute } from "@/lib/national-sources";
import { Flag, PerfBadge } from "./ui";

const DETAIL_INDICATORS = ["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP", "BCA_NGDPD"];

type DrawerTab = "overview" | "charts" | "indicators" | "sources";
const TABS: { key: DrawerTab; label: string }[] = [
  { key: "overview",    label: "Aperçu"       },
  { key: "charts",      label: "Graphiques"   },
  { key: "indicators",  label: "Indicateurs"  },
  { key: "sources",     label: "Sources"      },
];

interface ChartPoint { year: number; hist: number | null; fcst: number | null; }

function buildSeries(res: ForecastResult | { error: string } | undefined): ChartPoint[] {
  if (!res || "error" in res) return [];
  const pts: ChartPoint[] = res.historical.map((h) => ({ year: h.year, hist: h.value, fcst: null }));
  // Point de jonction : dernier historique = départ de la prévision
  const last = res.historical[res.historical.length - 1];
  if (last) {
    const join = pts.find((p) => p.year === last.year);
    if (join) join.fcst = last.value;
  }
  res.forecast.forEach((f) => pts.push({ year: f.year, hist: null, fcst: f.value }));
  return pts.sort((a, b) => a.year - b.year);
}

function MiniChart({ code, series }: { code: string; series: ChartPoint[] }) {
  const def = INDICATOR_BY_CODE[code];
  const lastHistYear = useMemo(
    () => series.filter((p) => p.hist != null).slice(-1)[0]?.year,
    [series],
  );
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--bg-border)", background: "var(--card-bg)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{def?.label ?? code}</span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{def?.unit}</span>
      </div>
      {series.length === 0 ? (
        <div className="h-[120px] flex items-center justify-center text-[11px]" style={{ color: "var(--text-muted)" }}>
          Pas de série historique disponible
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: "var(--text-muted)" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={36} />
            <Tooltip
              contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--text-primary)" }}
              formatter={(v: number) => [def ? formatValue(def, v) : v, ""]}
            />
            {lastHistYear != null && (
              <ReferenceLine x={lastHistYear} stroke={MANSA_GOLD} strokeDasharray="2 2" strokeOpacity={0.5} />
            )}
            <Line type="monotone" dataKey="hist" stroke={MANSA_NAVY} strokeWidth={2} dot={false} connectNulls name="Historique" />
            <Line type="monotone" dataKey="fcst" stroke={MANSA_GOLD} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls name="Prévision" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function KPI({ code, value }: { code: string; value: number | undefined }) {
  const def = INDICATOR_BY_CODE[code];
  if (!def) return null;
  const color = valueColor(def, value);
  const Icon = def.better === "high" ? TrendingUp : def.better === "low" ? TrendingDown : Minus;
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--bg-border)", background: "var(--card-bg)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} style={{ color }} />
        <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{def.short}</span>
      </div>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {formatValue(def, value)}<span className="text-[10px] font-normal ml-0.5" style={{ color: "var(--text-muted)" }}>{def.unit}</span>
      </div>
    </div>
  );
}

export function CountryDetailDrawer({ country, onClose }: { country: CountryDatum | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["macro-detail", country?.id],
    queryFn: () => forecastApi.getBatch(country!.id, { indicators: DETAIL_INDICATORS.join(","), horizon: 5 }),
    enabled: !!country,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  const [tab, setTab] = useState<DrawerTab>("overview");

  if (!country) return null;
  const badge = computeBadge(country.values);
  const centralBank = getCentralBank(country.id);
  const statsInstitute = getStatsInstitute(country.id);
  const presentValues = INDICATOR_CATALOG.filter((def) => country.values[def.code] != null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panneau */}
      <div
        className="relative w-full max-w-xl h-full overflow-y-auto shadow-2xl animate-slide-in-right"
        style={{ background: "var(--bg-primary, #0A0F1E)", borderLeft: "1px solid var(--bg-border)" }}
      >
        {/* En-tête institutionnel */}
        <div className="sticky top-0 z-10 px-5 py-4 border-b" style={{ background: MANSA_NAVY, borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Flag iso3={country.id} w={44} h={30} />
              <div>
                <h2 className="text-lg font-bold text-white">{country.name}</h2>
                <p className="text-xs text-white/60">{country.region}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/80" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <PerfBadge badge={badge} showLabel />
            <Link
              href={`/countries/${country.id}`}
              className="ml-auto text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium"
              style={{ background: MANSA_GOLD, color: MANSA_NAVY }}
            >
              Profil complet <ExternalLink size={11} />
            </Link>
          </div>

          {/* Onglets */}
          <div className="mt-3 flex items-center gap-1">
            {TABS.map((tb) => (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={tab === tb.key
                  ? { background: MANSA_GOLD, color: MANSA_NAVY }
                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* ── Aperçu ── */}
          {tab === "overview" && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Indicateurs clés
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DETAIL_INDICATORS.map((code) => <KPI key={code} code={code} value={country.values[code]} />)}
              </div>
              <div className="flex items-center justify-between mt-6 mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Tendance long terme — Croissance PIB
                </h3>
              </div>
              {isLoading
                ? <div className="h-[160px] rounded-xl skeleton" />
                : <MiniChart code="NGDP_RPCH" series={buildSeries(data?.forecasts?.["NGDP_RPCH"])} />}
            </>
          )}

          {/* ── Graphiques ── */}
          {tab === "charts" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Historique & prévisions
                </h3>
                <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: MANSA_NAVY }} /> Historique</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: MANSA_GOLD }} /> Prévision</span>
                </div>
              </div>
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DETAIL_INDICATORS.map((c) => <div key={c} className="h-[160px] rounded-xl skeleton" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DETAIL_INDICATORS.map((code) => (
                    <MiniChart key={code} code={code} series={buildSeries(data?.forecasts?.[code])} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Indicateurs ── */}
          {tab === "indicators" && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Tous les indicateurs ({presentValues.length})
              </h3>
              <div className="space-y-1">
                {presentValues.map((def) => (
                  <div key={def.code} className="flex items-center gap-3 py-1.5 border-b last:border-0" style={{ borderColor: "var(--bg-border)" }}>
                    <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{def.label}</span>
                    <span className="text-xs font-mono font-semibold" style={{ color: valueColor(def, country.values[def.code]) }}>
                      {formatValue(def, country.values[def.code])}
                    </span>
                    <span className="text-[10px] font-mono w-14 text-right" style={{ color: "var(--text-muted)" }}>{def.unit}</span>
                  </div>
                ))}
                {presentValues.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun indicateur disponible.</p>
                )}
              </div>
            </>
          )}

          {/* ── Sources ── */}
          {tab === "sources" && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Sources de données
              </h3>
              <ul className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <li>• FMI — World Economic Outlook (croissance, inflation, dette, solde, compte courant)</li>
                <li>• Banque Mondiale — World Development Indicators</li>
                {statsInstitute && (
                  <li>• {statsInstitute.name} ({statsInstitute.abbrev}){statsInstitute.url ? ` — ${statsInstitute.url}` : ""}</li>
                )}
                {centralBank && (
                  <li>• {centralBank.name} ({centralBank.abbrev}){centralBank.url ? ` — ${centralBank.url}` : ""}</li>
                )}
              </ul>
              <Link href={`/countries/${country.id}`}
                className="inline-flex items-center gap-1 mt-4 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--bg-border)" }}>
                Voir les sources nationales détaillées <ExternalLink size={11} />
              </Link>
              <p className="text-[10px] mt-4" style={{ color: "var(--text-muted)" }}>
                Prévisions générées par modèle statistique MANSA (ARIMA/lissage) sur la base des séries historiques officielles.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
