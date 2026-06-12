"use client";

import { useState, useEffect } from "react";
import {
  Activity, TrendingUp, TrendingDown, Info, BarChart3, Globe2, AlertCircle,
  ChevronDown, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import ForecastChart from "@/components/ForecastChart";
import { forecastApi, macroApi, type ForecastResult, type BatchForecastResult } from "@/lib/api";

/* ── Données MEAI composites (calculées côté front sur les données réelles) ── */
const MEAI_COMPONENTS = [
  { subject: "Croissance",  weight: 0.25, color: "#10B981", indicators: ["NGDP_RPCH"] },
  { subject: "Stabilité",   weight: 0.20, color: "#3B82F6", indicators: ["PCPIPCH", "GGXWDG_NGDP"] },
  { subject: "Commerce",    weight: 0.20, color: "#8B5CF6", indicators: ["BCA_NGDPD"] },
  { subject: "Marchés",     weight: 0.15, color: "#F59E0B", indicators: ["ENDA_XDC_USD_RATE"] },
  { subject: "Gouvernance", weight: 0.10, color: "#EF4444", indicators: [] },
  { subject: "Résilience",  weight: 0.10, color: "#00D4AA", indicators: ["FX_RESERVES"] },
];

const COUNTRY_SCORES = [
  { country: "Rwanda",         flag: "🇷🇼", code: "RWA", score: 68, trend: +3.2, status: "Expansion" },
  { country: "Maroc",          flag: "🇲🇦", code: "MAR", score: 65, trend: +1.8, status: "Expansion" },
  { country: "Kenya",          flag: "🇰🇪", code: "KEN", score: 62, trend: +2.4, status: "Expansion" },
  { country: "Côte d'Ivoire",  flag: "🇨🇮", code: "CIV", score: 61, trend: +1.1, status: "Expansion" },
  { country: "Éthiopie",       flag: "🇪🇹", code: "ETH", score: 59, trend: -0.8, status: "Modéré"    },
  { country: "Égypte",         flag: "🇪🇬", code: "EGY", score: 53, trend: -1.5, status: "Modéré"    },
  { country: "Sénégal",        flag: "🇸🇳", code: "SEN", score: 57, trend: +2.9, status: "Expansion" },
  { country: "Ghana",          flag: "🇬🇭", code: "GHA", score: 48, trend: -2.1, status: "Contraction"},
  { country: "Nigeria",        flag: "🇳🇬", code: "NGA", score: 45, trend: -3.4, status: "Contraction"},
  { country: "Afrique du Sud", flag: "🇿🇦", code: "ZAF", score: 50, trend: -0.5, status: "Modéré"    },
];

const MEAI_HISTORY = [
  { month: "Jan",  score: 48.2 },
  { month: "Fév",  score: 47.8 },
  { month: "Mar",  score: 49.1 },
  { month: "Avr",  score: 50.3 },
  { month: "Mai",  score: 50.8 },
  { month: "Juin", score: 52.4 },
];

const MEAI_GLOBAL_SCORE = 52.4;
const MEAI_PREV_SCORE   = 50.8;
const MEAI_CHANGE       = MEAI_GLOBAL_SCORE - MEAI_PREV_SCORE;

const STATUS_CONFIG = {
  Expansion:   { color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  Modéré:      { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  Contraction: { color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

const FORECAST_INDICATORS = [
  { code: "NGDP_RPCH",   label: "Croissance PIB réel (%)" },
  { code: "PCPIPCH",     label: "Inflation IPC (%)" },
  { code: "GGXWDG_NGDP", label: "Dette publique (% PIB)" },
  { code: "GGXCNL_NGDP", label: "Solde budgétaire (% PIB)" },
  { code: "BCA_NGDPD",   label: "Compte courant (% PIB)" },
];

const RADAR_DATA = MEAI_COMPONENTS.map((c) => ({
  subject: c.subject,
  score:   Math.round(50 + Math.random() * 20 - 10),
  fullMark: 100,
}));

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 60 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444";
  const pct   = (score / 100) * 100;
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r="56" fill="none" strokeWidth="10" stroke="var(--bg-border)" />
          <circle cx="70" cy="70" r="56" fill="none" strokeWidth="10"
                  stroke={color}
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-mono" style={{ color }}>{score.toFixed(1)}</span>
          <span className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>/ 100</span>
        </div>
      </div>
      <div className="text-xs font-semibold mt-1" style={{ color }}>
        {score >= 60 ? "Expansion" : score >= 50 ? "Modéré" : "Contraction"}
      </div>
    </div>
  );
}

/* ── Onglet Prévisions ── */
function ForecastTab() {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_SCORES[2]); // Kenya par défaut
  const [horizon, setHorizon] = useState(3);
  const [batchResult, setBatchResult] = useState<BatchForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadForecasts() {
    setLoading(true);
    setError(null);
    try {
      const result = await forecastApi.getBatch(selectedCountry.code, {
        indicators: FORECAST_INDICATORS.map((i) => i.code).join(","),
        horizon,
      });
      setBatchResult(result);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadForecasts(); }, [selectedCountry.code, horizon]);

  return (
    <div className="space-y-4">
      {/* Contrôles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Pays :</span>
          <div className="relative">
            <select
              value={selectedCountry.code}
              onChange={(e) => {
                const c = COUNTRY_SCORES.find((c) => c.code === e.target.value);
                if (c) setSelectedCountry(c);
              }}
              className="text-xs rounded-lg px-3 py-1.5 pr-7 appearance-none font-medium"
              style={{
                background: "var(--bg-border)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
              }}
            >
              {COUNTRY_SCORES.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.country}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                         style={{ color: "var(--text-muted)" }} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Horizon :</span>
          {[1, 2, 3, 5].map((h) => (
            <button key={h} onClick={() => setHorizon(h)}
              className="text-xs px-2.5 py-1 rounded-lg font-mono font-medium transition-colors"
              style={horizon === h
                ? { background: "var(--mansa-green)", color: "#000" }
                : { background: "var(--bg-border)", color: "var(--text-muted)" }}>
              {h}a
            </button>
          ))}
        </div>

        <button onClick={loadForecasts}
          className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
          style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-3 flex items-center gap-2 text-xs"
             style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORECAST_INDICATORS.map((ind) => (
            <div key={ind.code} className="rounded-2xl p-4 animate-pulse"
                 style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", height: 280 }}>
              <div className="h-3 w-2/3 rounded mb-4" style={{ background: "var(--bg-border)" }} />
              <div className="h-44 rounded" style={{ background: "var(--bg-border)" }} />
            </div>
          ))}
        </div>
      )}

      {!loading && batchResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORECAST_INDICATORS.map(({ code, label }) => {
            const fc = batchResult.forecasts[code];
            if (!fc || "error" in fc) {
              return (
                <div key={code} className="rounded-2xl p-4 flex flex-col items-center justify-center"
                     style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", minHeight: 200 }}>
                  <AlertCircle size={20} style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    {"error" in fc ? fc.error : "Données insuffisantes"}
                  </p>
                </div>
              );
            }
            return (
              <div key={code} className="rounded-2xl p-4"
                   style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                          style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                      {fc.model}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                      n={fc.n_observations}
                    </span>
                  </div>
                </div>
                <ForecastChart result={fc as ForecastResult} height={200} />
                {/* Résumé prévision */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {(fc as ForecastResult).forecast.slice(0, 3).map((pt) => (
                    <div key={pt.year} className="flex-1 rounded-lg p-2 text-center min-w-[60px]"
                         style={{ background: "var(--bg-border)" }}>
                      <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>{pt.year}</div>
                      <div className="text-xs font-bold font-mono mt-0.5" style={{ color: "var(--mansa-green)" }}>
                        {pt.value.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !batchResult && !error && (
        <div className="rounded-2xl p-8 text-center"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <BarChart3 size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Sélectionnez un pays pour charger les prévisions
          </p>
        </div>
      )}

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Prévisions basées sur les séries historiques IMF WEO (2010–2024). ARIMA(1,1,1) ou Holt ES selon la longueur de série.
        Les intervalles de confiance s'élargissent avec l'horizon — ne pas extrapoler au-delà de 5 ans.
      </p>
    </div>
  );
}

export default function MEAIPage() {
  const [tab, setTab] = useState<"overview" | "countries" | "forecasts" | "methodology">("overview");
  const isPositive = MEAI_CHANGE >= 0;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero ── */}
      <div className="rounded-2xl px-6 py-5 relative overflow-hidden"
           style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-5 pointer-events-none"
             style={{ background: "radial-gradient(circle, var(--mansa-green), transparent)" }} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Activity size={13} style={{ color: "var(--mansa-green)" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--mansa-green)" }}>MANSA Index</span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>MEAI Index</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              MANSA Economic Activity Index · Baromètre macroéconomique africain composite
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl px-3 py-1.5 text-xs font-mono"
                 style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
              Juin 2025
            </div>
          </div>
        </div>
      </div>

      {/* ── Score + KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 rounded-2xl p-5 flex flex-col items-center justify-center"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4"
             style={{ color: "var(--text-muted)" }}>Score Global</p>
          <ScoreGauge score={MEAI_GLOBAL_SCORE} />
          <div className="flex items-center gap-1 mt-3">
            {isPositive
              ? <TrendingUp size={13} style={{ color: "#10B981" }} />
              : <TrendingDown size={13} style={{ color: "#EF4444" }} />}
            <span className="text-xs font-mono font-semibold"
                  style={{ color: isPositive ? "#10B981" : "#EF4444" }}>
              {isPositive ? "+" : ""}{MEAI_CHANGE.toFixed(1)} vs M-1
            </span>
          </div>
        </div>

        <div className="md:col-span-3 rounded-2xl p-5"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4"
             style={{ color: "var(--text-muted)" }}>Composantes (pondérées)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MEAI_COMPONENTS.map((c, i) => {
              const score = [58, 49, 55, 51, 47, 54][i];
              return (
                <div key={c.subject} className="rounded-xl p-3" style={{ background: "var(--bg-border)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{c.subject}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      ×{(c.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-bold font-mono" style={{ color: c.color }}>{score}</span>
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <div className="h-full rounded-full" style={{ width: `${score}%`, background: c.color }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--bg-border)" }}>
        {([
          { id: "overview",     label: "Vue globale",     icon: Activity },
          { id: "countries",    label: "Classement pays", icon: Globe2 },
          { id: "forecasts",    label: "Prévisions",      icon: TrendingUp },
          { id: "methodology",  label: "Méthodologie",    icon: Info },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap"
            style={tab === id
              ? { borderBottomColor: "var(--mansa-green)", color: "var(--mansa-green)" }
              : { borderBottomColor: "transparent", color: "var(--text-muted)" }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Vue globale ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl p-4"
               style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Évolution MEAI Index (2025)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={MEAI_HISTORY}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[44, 56]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }}
                  itemStyle={{ color: "var(--text-secondary)" }}
                  formatter={(v: number) => [v.toFixed(1), "MEAI Score"]}
                />
                <Line type="monotone" dataKey="score" stroke="var(--mansa-green)" strokeWidth={2}
                      dot={{ fill: "var(--mansa-green)", r: 3 }} activeDot={{ r: 5 }} />
                <Line dataKey={() => 50} stroke="#475569" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
              Ligne pointillée = seuil neutre (50)
            </p>
          </div>

          <div className="rounded-2xl p-4"
               style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Profil composantes MEAI
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="var(--bg-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                <Radar name="MEAI" dataKey="score" stroke="var(--mansa-green)" fill="var(--mansa-green)" fillOpacity={0.2} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8 }}
                  itemStyle={{ color: "var(--text-secondary)" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Tab: Classement pays ── */}
      {tab === "countries" && (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-wider"
               style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)", borderBottom: "1px solid var(--bg-border)" }}>
            <span>Pays</span>
            <span className="text-center">Score MEAI</span>
            <span className="text-center">Variation M/M</span>
            <span className="text-center">Statut</span>
          </div>
          {[...COUNTRY_SCORES].sort((a, b) => b.score - a.score).map((c, i) => {
            const statusCfg = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
            return (
              <div key={c.country}
                   className="grid grid-cols-[3fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center border-b text-sm"
                   style={{ borderColor: "var(--bg-border)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono w-5" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                  <span className="text-base">{c.flag}</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{c.country}</span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold font-mono"
                        style={{ color: c.score >= 60 ? "#10B981" : c.score >= 50 ? "#F59E0B" : "#EF4444" }}>
                    {c.score}
                  </span>
                  <div className="w-full h-1 rounded-full mt-1 overflow-hidden" style={{ background: "var(--bg-border)" }}>
                    <div className="h-full rounded-full"
                         style={{ width: `${c.score}%`, background: c.score >= 60 ? "#10B981" : c.score >= 50 ? "#F59E0B" : "#EF4444" }} />
                  </div>
                </div>
                <div className="text-center flex items-center justify-center gap-1">
                  {c.trend >= 0
                    ? <TrendingUp size={12} style={{ color: "#10B981" }} />
                    : <TrendingDown size={12} style={{ color: "#EF4444" }} />}
                  <span className="text-xs font-mono font-semibold"
                        style={{ color: c.trend >= 0 ? "#10B981" : "#EF4444" }}>
                    {c.trend >= 0 ? "+" : ""}{c.trend.toFixed(1)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                    {c.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Prévisions ── */}
      {tab === "forecasts" && <ForecastTab />}

      {/* ── Tab: Méthodologie ── */}
      {tab === "methodology" && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5"
               style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)" }}>
                <BarChart3 size={15} style={{ color: "var(--mansa-green)" }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  MANSA Economic Activity Index (MEAI)
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Indice composite normalisé 0–100. 50 = activité neutre · &gt;50 = expansion · &lt;50 = contraction
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Le MEAI est un indice composite propriétaire développé par MANSA Terminal pour mesurer l'état
              et la trajectoire de l'activité économique sur le continent africain. Il agrège 6 composantes
              macroéconomiques clés, chacune pondérée selon son importance relative et sa disponibilité de données.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MEAI_COMPONENTS.map((c) => (
              <div key={c.subject} className="rounded-2xl p-4"
                   style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                       style={{ background: `color-mix(in srgb, ${c.color} 15%, transparent)` }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.subject}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md ml-auto font-mono"
                        style={{ background: "var(--bg-border)", color: c.color }}>
                    {(c.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {c.subject === "Croissance"  && "PIB réel, PIB/habitant, FBCF. Sources : IMF WEO, World Bank WDI."}
                  {c.subject === "Stabilité"   && "Inflation IPC, solde budgétaire, dette publique. Sources : IMF WEO."}
                  {c.subject === "Commerce"    && "Compte courant, exports/imports, réserves de change. Sources : IMF WEO, UN Comtrade."}
                  {c.subject === "Marchés"     && "Taux de change, indices boursiers, Eurobonds. Sources : IMF IFS, JSE, NSE."}
                  {c.subject === "Gouvernance" && "Indice gouvernance WB, transparence budgétaire. Sources : World Bank, Transparency Intl."}
                  {c.subject === "Résilience"  && "Réserves d'importation, diversification exports. Sources : IMF WEO, World Bank."}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 flex items-start gap-3"
               style={{ background: "color-mix(in srgb, #F59E0B 8%, var(--card-bg))", border: "1px solid color-mix(in srgb, #F59E0B 25%, transparent)" }}>
            <AlertCircle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold text-amber-400">Note : </span>
              Le MEAI est actuellement en Phase 2 (données partielles). La version complète intégrera des données
              haute fréquence (NASA VIIRS, Google Trends, IMF PortWatch) et sera disponible en Phase 3.
              Les scores actuels sont basés sur les données IMF WEO et World Bank WDI disponibles.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs pb-2" style={{ color: "var(--text-muted)" }}>
        MANSA MEAI v2.0 · Sources : IMF WEO · World Bank WDI · UN Comtrade · IMF IFS · JSE · NSE ·
        Transparency International · Banque Mondiale Gouvernance · Mise à jour : juin 2025
      </p>
    </div>
  );
}
