"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, TrendingUp, TrendingDown, Info, BarChart3, Globe2, AlertCircle,
  ChevronDown, RefreshCw, Search, ArrowUpRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import ForecastChart from "@/components/ForecastChart";
import { forecastApi, macroApi, type ForecastResult, type BatchForecastResult } from "@/lib/api";
import { MEAI_COMPONENTS, computeMeai, type TableCountry } from "@/lib/meai";

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

/* ── Mini-sparkline déterministe dérivée du score + tendance ── */
function TrendSparkline({ score, trend, color }: { score: number; trend: number; color: string }) {
  const n = 7;
  // Reconstruit une trajectoire plausible se terminant sur `score`, de pente `trend`
  const pts = Array.from({ length: n }, (_, i) => {
    const back = (n - 1 - i);
    const base = score - trend * back;
    const wobble = Math.sin(i * 1.7 + score) * 1.4;
    return Math.max(0, Math.min(100, base + wobble));
  });
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const W = 64, H = 22;
  const d = pts.map((p, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((p - min) / range) * H;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={H - ((pts[n - 1] - min) / range) * H} r={2.2} fill={color} />
    </svg>
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

const NOW_LABEL = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

export default function MEAIPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "countries" | "forecasts" | "methodology">("overview");
  const [countrySearch, setCountrySearch] = useState("");
  const [activeComp, setActiveComp] = useState<string | null>(null);

  // Données MEAI calculées sur /macro/table (repli sur les constantes statiques)
  const [globalScore,     setGlobalScore]     = useState(MEAI_GLOBAL_SCORE);
  const [meaiChange,      setMeaiChange]      = useState(MEAI_CHANGE);
  const [componentScores, setComponentScores] = useState<number[]>([58, 49, 55, 51, 47, 54]);
  const [countryScores,   setCountryScores]   = useState(COUNTRY_SCORES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cur, prev] = await Promise.all([
          macroApi.getTable({ year: 2024 }),
          macroApi.getTable({ year: 2023 }).catch(() => null),
        ]);
        if (cancelled || !cur?.countries?.length) return;
        const c = computeMeai(cur.countries as TableCountry[]);
        const p = prev?.countries?.length ? computeMeai(prev.countries as TableCountry[]) : null;

        setGlobalScore(Math.round(c.global * 10) / 10);
        if (p) setMeaiChange(Math.round((c.global - p.global) * 10) / 10);
        setComponentScores(c.componentScores.map((s) => Math.round(s)));
        setCountryScores(COUNTRY_SCORES.map((cs) => {
          const cur2 = c.perCountry.get(cs.code);
          if (!cur2) return cs;
          const score  = Math.round(cur2.score);
          const prev2  = p?.perCountry.get(cs.code);
          const trend  = prev2 ? Math.round((cur2.score - prev2.score) * 10) / 10 : cs.trend;
          const status = score >= 60 ? "Expansion" : score >= 50 ? "Modéré" : "Contraction";
          return { ...cs, score, trend, status };
        }));
      } catch { /* repli silencieux sur les constantes statiques */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const isPositive = meaiChange >= 0;
  const radarData = MEAI_COMPONENTS.map((comp, i) => ({
    subject: comp.subject, score: componentScores[i] ?? 50, fullMark: 100,
  }));

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
            <div className="rounded-xl px-3 py-1.5 text-xs font-mono capitalize"
                 style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
              {NOW_LABEL}
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
          <ScoreGauge score={globalScore} />
          <div className="flex items-center gap-1 mt-3">
            {isPositive
              ? <TrendingUp size={13} style={{ color: "#10B981" }} />
              : <TrendingDown size={13} style={{ color: "#EF4444" }} />}
            <span className="text-xs font-mono font-semibold"
                  style={{ color: isPositive ? "#10B981" : "#EF4444" }}>
              {isPositive ? "+" : ""}{meaiChange.toFixed(1)} vs N-1
            </span>
          </div>
        </div>

        <div className="md:col-span-3 rounded-2xl p-5"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider"
               style={{ color: "var(--text-muted)" }}>Composantes (pondérées)</p>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Cliquez pour le détail</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MEAI_COMPONENTS.map((c, i) => {
              const score = componentScores[i] ?? 50;
              const isActive = activeComp === c.subject;
              return (
                <button key={c.subject}
                  onClick={() => setActiveComp(isActive ? null : c.subject)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    background: "var(--bg-border)",
                    outline: isActive ? `2px solid ${c.color}` : "2px solid transparent",
                    outlineOffset: -1,
                  }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{c.subject}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      ×{(c.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-bold font-mono" style={{ color: c.color }}>{score}</span>
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: c.color }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Détail composante sélectionnée */}
          {activeComp && (() => {
            const c = MEAI_COMPONENTS.find((m) => m.subject === activeComp)!;
            const desc: Record<string, string> = {
              Croissance:  "PIB réel, PIB/habitant, FBCF. Sources : IMF WEO, World Bank WDI.",
              Stabilité:   "Inflation IPC, solde budgétaire, dette publique. Sources : IMF WEO.",
              Commerce:    "Compte courant, exports/imports, réserves de change. Sources : IMF WEO, UN Comtrade.",
              "Marchés":   "Taux de change, indices boursiers, Eurobonds. Sources : IMF IFS, JSE, NSE.",
              Gouvernance: "Indice gouvernance WB, transparence budgétaire. Sources : World Bank, Transparency Intl.",
              "Résilience":"Réserves d'importation, diversification exports. Sources : IMF WEO, World Bank.",
            };
            return (
              <div className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed flex items-start gap-2"
                   style={{ background: `color-mix(in srgb, ${c.color} 8%, var(--bg-border))`, border: `1px solid color-mix(in srgb, ${c.color} 25%, transparent)`, color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: c.color }}>{c.subject} ·{(c.weight * 100).toFixed(0)}%</span>
                <span>{desc[c.subject]}</span>
              </div>
            );
          })()}
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
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--bg-border)" />
                <PolarAngleAxis dataKey="subject" tick={(props: any) => {
                  const { x, y, payload, textAnchor } = props;
                  const comp = MEAI_COMPONENTS.find((m) => m.subject === payload.value);
                  const isActive = activeComp === payload.value;
                  return (
                    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central"
                          fontSize={isActive ? 11 : 10}
                          fontWeight={isActive ? 700 : 400}
                          fill={isActive ? (comp?.color ?? "var(--text-primary)") : "var(--text-muted)"}>
                      {payload.value}
                    </text>
                  );
                }} />
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
      {tab === "countries" && (() => {
        const ranked = [...countryScores]
          .sort((a, b) => b.score - a.score)
          .filter((c) => !countrySearch || c.country.toLowerCase().includes(countrySearch.toLowerCase()));
        return (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          {/* Barre de recherche */}
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--bg-border)" }}>
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border max-w-xs"
                 style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <Search size={12} style={{ color: "var(--text-muted)" }} />
              <input value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)}
                     placeholder="Rechercher un pays…"
                     className="bg-transparent text-xs focus:outline-none w-full" style={{ color: "var(--text-secondary)" }} />
              {countrySearch && <button onClick={() => setCountrySearch("")} className="text-xs" style={{ color: "var(--text-muted)" }}>✕</button>}
            </div>
          </div>
          <div className="grid grid-cols-[2.4fr_1.1fr_1fr_1fr_0.9fr] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-wider"
               style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)", borderBottom: "1px solid var(--bg-border)" }}>
            <span>Pays</span>
            <span className="text-center">Score MEAI</span>
            <span className="text-center">Tendance</span>
            <span className="text-center">Variation M/M</span>
            <span className="text-center">Statut</span>
          </div>
          {ranked.length === 0 && (
            <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Aucun pays ne correspond.</div>
          )}
          {ranked.map((c, i) => {
            const statusCfg = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG];
            const scoreColor = c.score >= 60 ? "#10B981" : c.score >= 50 ? "#F59E0B" : "#EF4444";
            return (
              <button key={c.country}
                   onClick={() => router.push(`/countries/${c.code}`)}
                   className="w-full text-left grid grid-cols-[2.4fr_1.1fr_1fr_1fr_0.9fr] gap-4 px-5 py-3.5 items-center border-b text-sm transition-colors group"
                   style={{ borderColor: "var(--bg-border)" }}
                   onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                   onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono w-5" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                  <span className="text-base">{c.flag}</span>
                  <span className="font-medium flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                    {c.country}
                    <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--mansa-green)" }} />
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold font-mono" style={{ color: scoreColor }}>{c.score}</span>
                  <div className="w-full h-1 rounded-full mt-1 overflow-hidden" style={{ background: "var(--bg-border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: scoreColor }} />
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <TrendSparkline score={c.score} trend={c.trend} color={scoreColor} />
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
              </button>
            );
          })}
        </div>
        );
      })()}

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
