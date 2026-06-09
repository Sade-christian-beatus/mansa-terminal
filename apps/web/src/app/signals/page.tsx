"use client";

import { useState, useMemo } from "react";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Anchor,
  Satellite, Flame, Cloud, Droplets, Activity, RefreshCw,
  Download, Radio, Shield, ChevronRight, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { ExportModal, ALL_DATA_SOURCES } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";

/* ── Types ────────────────────────────────────────────────── */
interface Signal {
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

const SIGNALS: Signal[] = [
  {
    id: "1", country: "Éthiopie", flag: "🇪🇹", type: "conflict", severity: "high",
    title: "Escalade conflit Tigray", region: "Est",
    desc: "Augmentation des incidents armés +34% ce mois. Déplacements massifs de population vers la frontière érythréenne. Données ACLED temps réel.",
    source: "ACLED", indicator: "Événements violents", value: "127 incidents", change: +34,
    date: "2025-06-07", sparkline: [45, 52, 61, 78, 95, 108, 127],
  },
  {
    id: "2", country: "Nigeria", flag: "🇳🇬", type: "economic", severity: "high",
    title: "Forte dépréciation NGN", region: "Ouest",
    desc: "Naira : -8.2% vs USD sur 30 jours. Pression sur les réserves de change de la CBN. Inflation importée en hausse.",
    source: "IMF IFS", indicator: "Taux de change USD/NGN", value: "₦1,620", change: -8.2,
    date: "2025-06-08", sparkline: [1_480, 1_510, 1_540, 1_570, 1_590, 1_610, 1_620],
  },
  {
    id: "3", country: "Kenya", flag: "🇰🇪", type: "climate", severity: "high",
    title: "Inondations catastrophiques", region: "Est",
    desc: "59 décès confirmés, 27 000 personnes affectées à Mombasa et Nairobi. Infrastructure routière endommagée. EM-DAT.",
    source: "EM-DAT", indicator: "Personnes affectées", value: "27 000", change: +0,
    date: "2025-06-06", sparkline: [0, 0, 2_000, 8_000, 18_000, 24_000, 27_000],
  },
  {
    id: "4", country: "Égypte", flag: "🇪🇬", type: "maritime", severity: "medium",
    title: "Congestion Port Said", region: "Nord",
    desc: "Appels navires -12% sur 7 jours. Trafic Red Sea détourné via Cap de Bonne Espérance. Impact sur le commerce régional.",
    source: "IMF PortWatch", indicator: "Appels navires /7j", value: "–12%", change: -12,
    date: "2025-06-08", sparkline: [100, 98, 96, 94, 91, 89, 88],
  },
  {
    id: "5", country: "Angola", flag: "🇦🇴", type: "economic", severity: "medium",
    title: "Recul production pétrolière", region: "Centre",
    desc: "Baisse de 4.3% de la production brute vs M-1. Chute des prix du Brent impacte directement les recettes budgétaires angolaises.",
    source: "EIA", indicator: "Production brute", value: "1.12 Mb/j", change: -4.3,
    date: "2025-06-05", sparkline: [1.28, 1.25, 1.22, 1.20, 1.18, 1.14, 1.12],
  },
  {
    id: "6", country: "RD Congo", flag: "🇨🇩", type: "nightlights", severity: "medium",
    title: "Reprise activité économique Kivu", region: "Centre",
    desc: "Indice NLI +6.8 pts sur 3 mois dans la région du Kivu. Signal positif d'expansion de l'activité économique informelle.",
    source: "NASA VIIRS", indicator: "Nightlight Index", value: "42.3 NLI", change: +6.8,
    date: "2025-06-01", sparkline: [35, 36.8, 38.2, 39.5, 40.8, 41.6, 42.3],
  },
  {
    id: "7", country: "Mozambique", flag: "🇲🇿", type: "climate", severity: "medium",
    title: "Stress hydrique — Bassins Zambèze", region: "Est",
    desc: "Indice Aqueduct WRI : 3.8/5 (High stress). Projections : +15% aggravation d'ici 2035. Impact agriculture et hydroélectricité.",
    source: "WRI Aqueduct", indicator: "Water stress score", value: "3.8/5", change: +0.3,
    date: "2025-06-01", sparkline: [3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8],
  },
  {
    id: "8", country: "Ghana", flag: "🇬🇭", type: "economic", severity: "medium",
    title: "Indicateur Google Trends inflation", region: "Ouest",
    desc: "Recherches 'inflation Ghana' +45 pts ce mois — signal avant-coureur d'inquiétude populaire. Indice de confiance des ménages en baisse.",
    source: "Google Trends", indicator: "Trends Index", value: "78/100", change: +45,
    date: "2025-06-08", sparkline: [33, 42, 51, 60, 68, 74, 78],
  },
  {
    id: "9", country: "Sénégal", flag: "🇸🇳", type: "economic", severity: "low",
    title: "Reprise touristique record", region: "Ouest",
    desc: "Arrivées touristiques internationales +18.4% vs 2024. Impact positif sur la balance des paiements et les recettes en devises.",
    source: "World Bank", indicator: "Recettes tourisme", value: "+18.4%", change: +18.4,
    date: "2025-06-03", sparkline: [100, 106, 110, 114, 118, 121, 118.4],
  },
  {
    id: "10", country: "Afrique du Sud", flag: "🇿🇦", type: "economic", severity: "low",
    title: "JSE All-Share en repli", region: "Sud",
    desc: "Indice boursier -2.1% sur 7 jours. Exposition aux marchés émergents pénalisée par hausse du dollar américain.",
    source: "JSE / Bloomberg", indicator: "JSE All-Share", value: "82 450", change: -2.1,
    date: "2025-06-08", sparkline: [85_200, 84_600, 84_100, 83_800, 83_200, 82_800, 82_450],
  },
  {
    id: "11", country: "Somalie", flag: "🇸🇴", type: "climate", severity: "high",
    title: "Insécurité alimentaire aiguë IPC Phase 3+", region: "Est",
    desc: "6.5 millions de personnes en Phase 3+ selon la classification IPC. La sécheresse prolongée amplifie la crise humanitaire.",
    source: "IPC/CH", indicator: "Pop. IPC Phase 3+", value: "6.5M", change: +0,
    date: "2025-06-01", sparkline: [5.2, 5.5, 5.7, 5.9, 6.1, 6.3, 6.5],
  },
  {
    id: "12", country: "Maroc", flag: "🇲🇦", type: "maritime", severity: "low",
    title: "Tanger Med — Record trafic conteneurs", region: "Nord",
    desc: "Port vessel calls +9.2% vs M-1. Tanger Med consolide sa position de hub portuaire régional face au détournement du trafic Red Sea.",
    source: "IMF PortWatch", indicator: "Appels navires", value: "+9.2%", change: +9.2,
    date: "2025-06-07", sparkline: [82, 84, 86, 87, 89, 90, 92],
  },
];

const TYPE_CONFIG = {
  economic:    { icon: Activity,      label: "Économique",  color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  conflict:    { icon: AlertTriangle, label: "Conflit",     color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  climate:     { icon: Cloud,         label: "Climatique",  color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  maritime:    { icon: Anchor,        label: "Maritime",    color: "#6366F1", bg: "rgba(99,102,241,0.12)" },
  nightlights: { icon: Satellite,     label: "Nightlights", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
};
const SEVERITY_CONFIG = {
  high:   { label: "Critique",  bg: "rgba(239,68,68,0.15)",   text: "#EF4444", border: "rgba(239,68,68,0.3)" },
  medium: { label: "Modéré",    bg: "rgba(245,158,11,0.15)",  text: "#F59E0B", border: "rgba(245,158,11,0.3)" },
  low:    { label: "Faible",    bg: "rgba(16,185,129,0.15)",  text: "#10B981", border: "rgba(16,185,129,0.3)" },
};

/* ── Mini sparkline inline ── */
function SparkLine({ data, color, isPositive }: { data: number[]; color: string; isPositive: boolean }) {
  const normalized = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width={80} height={32}>
      <AreaChart data={normalized} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sg-${color.replace("#", "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Signal Card ── */
function SignalCard({ sig, onClick }: { sig: Signal; onClick: () => void }) {
  const TypeIcon   = TYPE_CONFIG[sig.type].icon;
  const typeColor  = TYPE_CONFIG[sig.type].color;
  const typeBg     = TYPE_CONFIG[sig.type].bg;
  const sevConfig  = SEVERITY_CONFIG[sig.severity];
  const isPositive = sig.change > 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
  const changeColor = sig.type === "economic" || sig.type === "maritime"
    ? isPositive ? "var(--positive)" : "var(--negative)"
    : sig.type === "conflict" || sig.type === "climate"
    ? isPositive ? "var(--negative)" : "var(--positive)"
    : typeColor;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer transition-all duration-200 group relative overflow-hidden"
      style={{
        background: "var(--card-bg)",
        border: `1px solid var(--card-border)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `color-mix(in srgb, ${typeColor} 40%, var(--card-border))`;
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px color-mix(in srgb, ${typeColor} 10%, transparent)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--card-border)";
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Severity stripe */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
           style={{ background: sevConfig.text, opacity: 0.6 }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: typeBg }}>
            <TypeIcon size={15} style={{ color: typeColor }} />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: typeColor }}>
              {TYPE_CONFIG[sig.type].label}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sig.source}</div>
          </div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
          style={{ background: sevConfig.bg, color: sevConfig.text, border: `1px solid ${sevConfig.border}` }}
        >
          {sevConfig.label}
        </span>
      </div>

      {/* Country + title */}
      <div className="flex items-start gap-2.5 mb-2">
        <span className="text-xl flex-shrink-0 mt-0.5">{sig.flag}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
            {sig.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sig.country} · {sig.region}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
        {sig.desc}
      </p>

      {/* Footer: KPI + sparkline */}
      <div className="flex items-end justify-between mt-3 pt-3"
           style={{ borderTop: "1px solid var(--bg-border)" }}>
        <div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sig.indicator}</p>
          <p className="text-sm font-bold font-mono mt-0.5" style={{ color: "var(--text-primary)" }}>
            {sig.value}
          </p>
          {sig.change !== 0 && (
            <div className="flex items-center gap-1 mt-0.5" style={{ color: changeColor }}>
              <ChangeIcon size={11} />
              <span className="text-[10px] font-semibold">
                {isPositive ? "+" : ""}{sig.change}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-end gap-2">
          {sig.sparkline && (
            <SparkLine data={sig.sparkline} color={typeColor} isPositive={isPositive} />
          )}
          <div className="text-[9px] text-right flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <Clock size={9} />
            {sig.date}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat bubble ── */
function StatBubble({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1"
         style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
             style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <Icon size={12} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

/* ── Timeline item ── */
function TimelineItem({ sig }: { sig: Signal }) {
  const TypeIcon = TYPE_CONFIG[sig.type].icon;
  const color    = TYPE_CONFIG[sig.type].color;
  const sev      = SEVERITY_CONFIG[sig.severity];
  return (
    <div className="flex items-start gap-3 py-2.5"
         style={{ borderBottom: "1px solid var(--bg-border)" }}>
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
           style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <TypeIcon size={11} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">{sig.flag}</span>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{sig.title}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: sev.bg, color: sev.text }}>{sev.label}</span>
        </div>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sig.country} · {sig.source} · {sig.date}
        </p>
      </div>
      <div className="text-xs font-mono font-semibold flex-shrink-0" style={{ color }}>
        {sig.value}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════════════ */
export default function SignalsPage() {
  const [typeFilter,     setTypeFilter]     = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [view,           setView]           = useState<"grid" | "timeline">("grid");
  const [exportOpen,     setExportOpen]     = useState(false);
  const [selected,       setSelected]       = useState<Signal | null>(null);

  const filtered = useMemo(() =>
    SIGNALS.filter((s) =>
      (typeFilter     === "all" || s.type     === typeFilter) &&
      (severityFilter === "all" || s.severity === severityFilter)
    ), [typeFilter, severityFilter]);

  const highCount   = SIGNALS.filter((s) => s.severity === "high").length;
  const mediumCount = SIGNALS.filter((s) => s.severity === "medium").length;
  const lowCount    = SIGNALS.filter((s) => s.severity === "low").length;

  const handleExportData = async (_sources: string[], _yFrom: number, _yTo: number): Promise<ExportRow[]> =>
    SIGNALS.map((s) => ({
      country: s.country, type: s.type, severity: s.severity,
      title: s.title, indicator: s.indicator, value: s.value,
      change_pct: s.change, source: s.source, date: s.date,
    }));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Hero Header ── */}
      <div className="rounded-2xl px-6 py-5 relative overflow-hidden"
           style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-5"
             style={{ background: "radial-gradient(circle, #EF4444, transparent)" }} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#EF4444" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#EF4444" }}>
                LIVE · HAUTE FRÉQUENCE
              </span>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Signaux Haute Fréquence
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Surveillance économique temps réel · 54 pays · IA + données alternatives
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--card-border)" }}>
              {(["grid", "timeline"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className="px-3 py-1.5 text-[11px] font-medium transition-colors"
                  style={view === v
                    ? { background: "var(--mansa-green)", color: "#fff" }
                    : { background: "var(--input-bg)", color: "var(--text-muted)" }}>
                  {v === "grid" ? "Grille" : "Timeline"}
                </button>
              ))}
            </div>
            <button onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all"
              style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }}>
              <Download size={12} /> Exporter
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all"
              style={{ background: "var(--input-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }}>
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatBubble label="Signaux actifs" value={SIGNALS.length} icon={Radio}    color="var(--mansa-green)" />
        <StatBubble label="Critiques"      value={highCount}      icon={Flame}    color="#EF4444" />
        <StatBubble label="Modérés"        value={mediumCount}    icon={AlertTriangle} color="#F59E0B" />
        <StatBubble label="Faibles"        value={lowCount}       icon={Shield}   color="#10B981" />
        <StatBubble label="Pays couverts"  value={new Set(SIGNALS.map((s) => s.country)).size} icon={Activity} color="#3B82F6" />
      </div>

      {/* ── Filtres ── */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap"
           style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider mr-1"
                style={{ color: "var(--text-muted)" }}>Type</span>
          {["all", ...Object.keys(TYPE_CONFIG)].map((f) => {
            const cfg = f !== "all" ? TYPE_CONFIG[f as keyof typeof TYPE_CONFIG] : null;
            const active = typeFilter === f;
            return (
              <button key={f} onClick={() => setTypeFilter(f)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                style={active
                  ? { background: cfg?.color ?? "var(--mansa-green)", color: "#fff" }
                  : { background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--input-border)" }}>
                {cfg && <cfg.icon size={10} />}
                {f === "all" ? "Tous" : cfg!.label}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px" style={{ background: "var(--bg-border)" }} />

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider mr-1"
                style={{ color: "var(--text-muted)" }}>Sévérité</span>
          {["all", "high", "medium", "low"].map((f) => {
            const cfg = f !== "all" ? SEVERITY_CONFIG[f as keyof typeof SEVERITY_CONFIG] : null;
            return (
              <button key={f} onClick={() => setSeverityFilter(f)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                style={severityFilter === f
                  ? { background: cfg?.text ?? "var(--mansa-green)", color: "#fff" }
                  : { background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--input-border)" }}>
                {f === "all" ? "Toutes" : cfg!.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {filtered.length} signal{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Vue Grille ── */}
      {view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((sig) => (
            <SignalCard key={sig.id} sig={sig} onClick={() => setSelected(sig)} />
          ))}
        </div>
      )}

      {/* ── Vue Timeline ── */}
      {view === "timeline" && (
        <div className="rounded-2xl overflow-hidden"
             style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
               style={{ borderColor: "var(--bg-border)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              {filtered.length} événements · trié par date desc
            </span>
          </div>
          <div className="px-4 divide-y" style={{ borderColor: "var(--bg-border)" }}>
            {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((sig) => (
              <TimelineItem key={sig.id} sig={sig} />
            ))}
          </div>
        </div>
      )}

      {/* ── Détail modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.7)" }}
             onClick={() => setSelected(null)}>
          <div
            className="rounded-2xl p-6 max-w-lg w-full relative"
            style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-lg"
              style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>×</button>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{selected.flag}</span>
              <div>
                <p className="font-bold" style={{ color: "var(--text-primary)" }}>{selected.title}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {selected.country} · {selected.source} · {selected.date}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              {selected.desc}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Indicateur", val: selected.indicator },
                { label: "Valeur",     val: selected.value },
                { label: "Variation",  val: `${selected.change > 0 ? "+" : ""}${selected.change}%` },
                { label: "Type",       val: TYPE_CONFIG[selected.type].label },
              ].map((row) => (
                <div key={row.label} className="rounded-xl p-3"
                     style={{ background: "var(--bg-border)" }}>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{row.label}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{row.val}</p>
                </div>
              ))}
            </div>

            {selected.sparkline && (
              <div className="rounded-xl p-3" style={{ background: "var(--bg-border)" }}>
                <p className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>Tendance 7 jours</p>
                <SparkLine
                  data={selected.sparkline}
                  color={TYPE_CONFIG[selected.type].color}
                  isPositive={selected.change > 0}
                />
              </div>
            )}

            <button onClick={() => setSelected(null)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--mansa-green)", color: "#fff" }}>
              Fermer <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Sources footer ── */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
           style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}>Sources actives</span>
        {["ACLED", "EM-DAT", "NASA VIIRS", "IMF PortWatch", "IPC/CH", "Google Trends", "EIA", "WRI Aqueduct", "MANSA Research"].map((src) => (
          <span key={src} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
                style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {src}
          </span>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
          Mis à jour : 9 juin 2025
        </span>
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExportData}
        defaultFilename="mansa-hf-signals"
        title="Exporter les signaux HF"
        subtitle="Signaux haute fréquence · toutes sources"
        preSelectedSources={ALL_DATA_SOURCES
          .filter((s) => ["NASA_VIIRS","EMDAT_CRED","IMF_PortWatch","IPC_CH","Google_Trends","EIA_International"].includes(s.id))
          .map((s) => s.id)}
      />
    </div>
  );
}
