"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { X, ChevronRight, Sparkles, ArrowRight } from "lucide-react";

import { forecastApi, type BatchForecastResult, type ForecastResult } from "@/lib/api";
import { getCentralBank, getStatsInstitute } from "@/lib/national-sources";
import { sparklineSeries } from "@/lib/sparklines";
import {
  MANSA_GOLD, INDICATOR_BY_CODE, INDICATOR_CATALOG, formatValue, valueColor,
  computeBadge, regionalAverage, type CountryDatum,
} from "./data";
import { Flag, PerfBadge, Sparkline, SPARK_GREEN, SPARK_RED } from "./ui";

const TREND_CODES = ["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP"] as const;
const SNAPSHOT_CODES = ["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP", "BCA_NGDPD"] as const;

type Tab = "overview" | "charts" | "indicators" | "sources";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview",   label: "Aperçu"      },
  { key: "charts",     label: "Graphiques"  },
  { key: "indicators", label: "Indicateurs" },
  { key: "sources",    label: "Sources"     },
];

interface ChartPoint { year: number; hist: number | null; fcst: number | null; }

function buildSeries(res: ForecastResult | { error: string } | undefined): ChartPoint[] {
  if (!res || "error" in res) return [];
  const pts: ChartPoint[] = res.historical.map((h) => ({ year: h.year, hist: h.value, fcst: null }));
  const last = res.historical[res.historical.length - 1];
  if (last) {
    const join = pts.find((p) => p.year === last.year);
    if (join) join.fcst = last.value;
  }
  res.forecast.forEach((f) => pts.push({ year: f.year, hist: null, fcst: f.value }));
  return pts.sort((a, b) => a.year - b.year);
}

function TrendChart({
  code, batch, africaAvg,
}: { code: string; batch: BatchForecastResult | undefined; africaAvg: number | null }) {
  const def = INDICATOR_BY_CODE[code];
  const series = useMemo(() => buildSeries(batch?.forecasts?.[code]), [batch, code]);
  const lastHistYear = useMemo(
    () => series.filter((p) => p.hist != null).slice(-1)[0]?.year,
    [series],
  );
  if (series.length === 0) {
    return (
      <div className="h-[150px] flex items-center justify-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        Pas de série historique disponible
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={series} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 9, fill: "var(--text-muted)" }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={32} />
        <Tooltip
          contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(v: number) => [def ? formatValue(def, v) : v, ""]}
        />
        {africaAvg != null && (
          <ReferenceLine y={africaAvg} stroke="var(--text-muted)" strokeDasharray="4 4" strokeOpacity={0.7}
            label={{ value: "Moy. Afrique", fontSize: 8, fill: "var(--text-muted)", position: "insideTopRight" }} />
        )}
        {lastHistYear != null && (
          <ReferenceLine x={lastHistYear} stroke={MANSA_GOLD} strokeDasharray="2 2" strokeOpacity={0.45} />
        )}
        <Line type="monotone" dataKey="hist" stroke="var(--mansa-green)" strokeWidth={2} dot={false} connectNulls name="Historique" />
        <Line type="monotone" dataKey="fcst" stroke={MANSA_GOLD} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls name="Prévision" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CountryInsightPanel({
  country, allData, open, onClose, onOpen, onBrief,
}: {
  country: CountryDatum | null;
  allData: CountryDatum[];
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  onBrief: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [trendCode, setTrendCode] = useState<string>("NGDP_RPCH");

  const { data: batch } = useQuery({
    queryKey: ["panel-forecast", country?.id],
    queryFn: () => forecastApi.getBatch(country!.id, { indicators: TREND_CODES.join(","), horizon: 5 }),
    enabled: !!country && open,
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // Onglet replié
  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="flex-shrink-0 w-10 rounded-2xl border flex flex-col items-center justify-center gap-3 self-stretch transition-colors hover:bg-[var(--bg-card-hover)]"
        style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
        title="Ouvrir le panneau pays"
      >
        <ChevronRight size={16} style={{ color: "var(--mansa-green)", transform: "rotate(180deg)" }} />
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          className="text-[11px] font-semibold tracking-wider uppercase" >
          <span style={{ color: "var(--text-muted)" }}>Country Insight</span>
        </span>
      </button>
    );
  }

  if (!country) {
    return (
      <aside className="flex-shrink-0 w-[360px] rounded-2xl border flex items-center justify-center self-stretch"
        style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <p className="text-xs px-6 text-center" style={{ color: "var(--text-muted)" }}>
          Sélectionnez un pays dans le tableau pour afficher son analyse détaillée.
        </p>
      </aside>
    );
  }

  const badge = computeBadge(country.values);
  const presentValues = INDICATOR_CATALOG.filter((d) => country.values[d.code] != null);
  const trendDef = INDICATOR_BY_CODE[trendCode];
  const africaAvg = regionalAverage(allData, trendCode);
  const centralBank = getCentralBank(country.id);
  const statsInstitute = getStatsInstitute(country.id);

  const SOURCES = [
    { name: "FMI — World Economic Outlook", vintage: "Avr. 2026", desc: "Croissance, PIB, solde budgétaire, compte courant." },
    { name: "Banque Mondiale — WDI", vintage: "Avr. 2026", desc: "Population, PIB/hab., dette extérieure, indicateurs sociaux." },
    statsInstitute && { name: statsInstitute.name, vintage: statsInstitute.abbrev, desc: statsInstitute.url ?? "Institut national de statistique." },
    centralBank && { name: centralBank.name, vintage: centralBank.abbrev, desc: centralBank.url ?? "Banque centrale — taux directeurs & réserves." },
    { name: "MANSA Intelligence", vintage: "2026", desc: "Score de performance composite (0–100), modèle propriétaire." },
  ].filter(Boolean) as { name: string; vintage: string; desc: string }[];

  return (
    <aside className="flex-shrink-0 w-[360px] rounded-2xl border flex flex-col self-stretch overflow-hidden sticky top-0 max-h-[calc(100vh-7rem)]"
      style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Flag iso3={country.id} w={28} h={20} />
          <div className="min-w-0">
            <div className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{country.name}</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{country.region}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-card-hover)]" style={{ color: "var(--text-muted)" }} aria-label="Replier">
          <X size={16} />
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-5 px-4 border-b flex-shrink-0" style={{ borderColor: "var(--bg-border)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="text-xs font-semibold py-2.5 transition-colors"
            style={{
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: `2px solid ${tab === t.key ? "var(--mansa-green)" : "transparent"}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {/* APERÇU */}
        {tab === "overview" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Instantané pays</span>
              <PerfBadge badge={badge} showLabel />
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              {SNAPSHOT_CODES.map((code) => {
                const def = INDICATOR_BY_CODE[code];
                const v = country.values[code];
                const color = valueColor(def, v);
                const spark = sparklineSeries(code, country.id, v).map((p) => p.value);
                return (
                  <div key={code} className="rounded-xl border p-2.5" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{def.short}</div>
                    <div className="text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.7 }}>{def.unit}</div>
                    <div className="flex items-end justify-between mt-2 gap-1">
                      <span className="font-mono text-lg font-semibold leading-none" style={{ color }}>{formatValue(def, v)}</span>
                      <Sparkline points={spark} color={def.better === "low" ? SPARK_RED : SPARK_GREEN} width={46} height={16} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-5">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Tendance long terme</span>
              <select value={trendCode} onChange={(e) => setTrendCode(e.target.value)}
                className="text-[11px] rounded-lg px-2 py-1 border appearance-none cursor-pointer"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                {TREND_CODES.map((c) => <option key={c} value={c}>{INDICATOR_BY_CODE[c].label}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1"><span className="w-3.5 h-0.5 inline-block" style={{ background: "var(--mansa-green)" }} />Historique</span>
              <span className="flex items-center gap-1"><span className="w-3.5 inline-block border-t-2 border-dashed" style={{ borderColor: MANSA_GOLD }} />Prévision</span>
              <span className="flex items-center gap-1"><span className="w-3.5 inline-block border-t-2 border-dashed" style={{ borderColor: "var(--text-muted)" }} />Moy. Afrique</span>
            </div>
            <div className="mt-2"><TrendChart code={trendCode} batch={batch} africaAvg={africaAvg} /></div>
          </>
        )}

        {/* GRAPHIQUES */}
        {tab === "charts" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Explorateur de tendances</span>
              <select value={trendCode} onChange={(e) => setTrendCode(e.target.value)}
                className="text-[11px] rounded-lg px-2 py-1 border appearance-none cursor-pointer"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                {TREND_CODES.map((c) => <option key={c} value={c}>{INDICATOR_BY_CODE[c].label}</option>)}
              </select>
            </div>
            <div className="rounded-xl border p-3 mt-3" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
              <TrendChart code={trendCode} batch={batch} africaAvg={africaAvg} />
            </div>
            <p className="text-[11px] leading-relaxed mt-3" style={{ color: "var(--text-muted)" }}>
              {country.name} — {trendDef.label.toLowerCase()} suivi sur les séries officielles FMI/Banque Mondiale,
              avec prévision MANSA à 5 ans. La référence pointillée indique la moyenne africaine actuelle.
            </p>
          </>
        )}

        {/* INDICATEURS */}
        {tab === "indicators" && (
          <>
            <div className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Indicateurs clés <span className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>({presentValues.length})</span>
            </div>
            {presentValues.map((def) => (
              <div key={def.code} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--bg-border)" }}>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{def.label}</span>
                <span className="font-mono text-xs font-semibold" style={{ color: valueColor(def, country.values[def.code]) }}>
                  {formatValue(def, country.values[def.code])}<span className="ml-1 font-normal" style={{ color: "var(--text-muted)" }}>{def.unit}</span>
                </span>
              </div>
            ))}
          </>
        )}

        {/* SOURCES */}
        {tab === "sources" && (
          <>
            <div className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Provenance des données</div>
            {SOURCES.map((src) => (
              <div key={src.name} className="rounded-xl border p-2.5 mb-2" style={{ borderColor: "var(--bg-border)", background: "var(--bg-card)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{src.name}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: MANSA_GOLD, color: "#0a1626" }}>{src.vintage}</span>
                </div>
                <div className="text-[11px] mt-1 break-words" style={{ color: "var(--text-muted)" }}>{src.desc}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pied : actions */}
      <div className="flex gap-2 p-3 border-t flex-shrink-0" style={{ borderColor: "var(--bg-border)" }}>
        <button onClick={onBrief} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-lg"
          style={{ background: "var(--mansa-green)", color: "var(--bg-primary)" }}>
          <Sparkles size={13} /> Brief IA
        </button>
        <Link href={`/countries/${country.id}`} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg border"
          style={{ borderColor: "var(--bg-border)", color: "var(--text-secondary)" }}>
          Profil pays <ArrowRight size={13} />
        </Link>
      </div>
    </aside>
  );
}
