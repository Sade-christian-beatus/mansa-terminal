"use client";

import { useState } from "react";
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, Anchor,
  Satellite, Flame, Cloud, Droplets, Activity,
} from "lucide-react";
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
}

/* ── Signaux HF simulés (seront remplacés par données réelles) ── */
const SIGNALS: Signal[] = [
  { id: "1",  country: "Éthiopie",        flag: "🇪🇹", type: "conflict",     severity: "high",   title: "Escalade conflit Tigray", desc: "Augmentation des incidents armés +34% ce mois — données ACLED.", source: "ACLED",          indicator: "Événements violents",  value: "127",    change: +34,  date: "2025-06-07" },
  { id: "2",  country: "Nigeria",          flag: "🇳🇬", type: "economic",    severity: "high",   title: "Forte dépréciation NGN",  desc: "Naira : -8.2% vs USD sur 30 jours. Pression réserves de change.", source: "IMF IFS",        indicator: "Taux de change",       value: "₦1,620", change: -8.2, date: "2025-06-08" },
  { id: "3",  country: "Kenya",            flag: "🇰🇪", type: "climate",     severity: "high",   title: "Inondations catastrophiques", desc: "59 décès, 27 000 affectés. Mombasa, Nairobi — données EM-DAT.", source: "EM-DAT",         indicator: "Personnes affectées",  value: "27K",    change: +0,   date: "2025-06-06" },
  { id: "4",  country: "Égypte",           flag: "🇪🇬", type: "maritime",    severity: "medium", title: "Congestion Port Said",     desc: "Appels navires -12% sur 7 jours. Trafic Red Sea détourné.", source: "IMF PortWatch",  indicator: "Appels navires",       value: "–12%",   change: -12,  date: "2025-06-08" },
  { id: "5",  country: "Angola",           flag: "🇦🇴", type: "economic",    severity: "medium", title: "Production pétrolière",    desc: "Baisse de 4.3% vs M-1. Chute prix Brent impacte recettes.", source: "EIA",            indicator: "Production brute",     value: "1.12 Mb/d", change: -4.3, date: "2025-06-05" },
  { id: "6",  country: "RD Congo",         flag: "🇨🇩", type: "nightlights", severity: "medium", title: "Reprise activité Kivu",    desc: "Indice NLI +6.8 pts sur 3 mois — signal expansion économique.", source: "NASA VIIRS",     indicator: "Nightlight Index",     value: "42.3",   change: +6.8, date: "2025-06-01" },
  { id: "7",  country: "Mozambique",       flag: "🇲🇿", type: "climate",     severity: "medium", title: "Stress hydrique élevé",    desc: "Indice Aqueduct WRI : 3.8/5 (High). Bassins Zambèze.", source: "WRI Aqueduct",   indicator: "Water stress",         value: "3.8/5",  change: +0.3, date: "2025-06-01" },
  { id: "8",  country: "Ghana",            flag: "🇬🇭", type: "economic",    severity: "medium", title: "Google Trends inflation",  desc: "Recherches 'inflation Ghana' +45 pts ce mois — inquiétude population.", source: "Google Trends", indicator: "Trends Index",       value: "78/100", change: +45,  date: "2025-06-08" },
  { id: "9",  country: "Sénégal",          flag: "🇸🇳", type: "economic",    severity: "low",    title: "Reprise touristique",      desc: "Arrivées touristiques +18.4% vs 2024. Impact positif BOP.", source: "World Bank",     indicator: "Recettes tourisme",    value: "+18.4%", change: +18.4, date: "2025-06-03" },
  { id: "10", country: "Afrique du Sud",   flag: "🇿🇦", type: "economic",    severity: "low",    title: "JSE All-Share repli",      desc: "Indice -2.1% sur semaine. Exposition marchés émergents.", source: "Bloomberg",      indicator: "JSE All-Share",        value: "82,450", change: -2.1, date: "2025-06-08" },
  { id: "11", country: "Somalie",          flag: "🇸🇴", type: "climate",     severity: "high",   title: "Sécheresse prolongée",     desc: "6.5M personnes en insécurité alimentaire aiguë — IPC Phase 3+.", source: "IPC/CH",         indicator: "Pop. IPC Phase 3+",    value: "6.5M",   change: +0,   date: "2025-06-01" },
  { id: "12", country: "Maroc",            flag: "🇲🇦", type: "maritime",    severity: "low",    title: "Tanger Med record",        desc: "Port vessel calls +9.2% vs M-1. Hub régional renforcé.", source: "IMF PortWatch",  indicator: "Appels navires",       value: "+9.2%",  change: +9.2, date: "2025-06-07" },
];

const TYPE_CONFIG = {
  economic:    { icon: Activity,   label: "Économique",    color: "#3B82F6" },
  conflict:    { icon: AlertTriangle, label: "Conflit",    color: "#EF4444" },
  climate:     { icon: Cloud,      label: "Climatique",    color: "#10B981" },
  maritime:    { icon: Anchor,     label: "Maritime",      color: "#6366F1" },
  nightlights: { icon: Satellite,  label: "Nightlights",   color: "#F59E0B" },
};
const SEVERITY_CONFIG = {
  high:   { label: "Critique",   bg: "rgba(239,68,68,0.12)",   text: "#EF4444" },
  medium: { label: "Modéré",     bg: "rgba(245,158,11,0.12)",  text: "#F59E0B" },
  low:    { label: "Faible",     bg: "rgba(16,185,129,0.12)",  text: "#10B981" },
};

export default function SignalsPage() {
  const [typeFilter,     setTypeFilter]     = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [exportOpen,     setExportOpen]     = useState(false);

  const filtered = SIGNALS.filter((s) =>
    (typeFilter     === "all" || s.type     === typeFilter) &&
    (severityFilter === "all" || s.severity === severityFilter)
  );

  const highCount   = SIGNALS.filter((s) => s.severity === "high").length;
  const mediumCount = SIGNALS.filter((s) => s.severity === "medium").length;

  const handleExportData = async (_sources: string[], _yFrom: number, _yTo: number): Promise<ExportRow[]> => {
    return SIGNALS.map((s) => ({
      country: s.country,
      type: s.type,
      severity: s.severity,
      title: s.title,
      indicator: s.indicator,
      value: s.value,
      change_pct: s.change,
      source: s.source,
      date: s.date,
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background: "color-mix(in srgb, #F59E0B 15%, transparent)" }}>
              <Zap size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Signaux Haute Fréquence
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Indicateurs avancés · Temps réel · IA + données alternatives
              </p>
            </div>
          </div>
        </div>
        <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-sm">
          Exporter
        </button>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Signaux actifs",    value: SIGNALS.length, icon: Zap,         color: "var(--mansa-green)" },
          { label: "Critiques",         value: highCount,       icon: Flame,       color: "#EF4444" },
          { label: "Modérés",           value: mediumCount,     icon: AlertTriangle, color: "#F59E0B" },
          { label: "Pays couverts",     value: new Set(SIGNALS.map((s) => s.country)).size, icon: Activity, color: "#3B82F6" },
          { label: "Sources actives",   value: 9,               icon: Satellite,   color: "#6366F1" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="mansa-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{kpi.label}</span>
                <Icon size={14} style={{ color: kpi.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Type</span>
          {["all", ...Object.keys(TYPE_CONFIG)].map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={
                typeFilter === f
                  ? { background: "var(--mansa-green)", color: "#fff" }
                  : { background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--input-border)" }
              }
            >
              {f === "all" ? "Tous" : TYPE_CONFIG[f as keyof typeof TYPE_CONFIG].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Sévérité</span>
          {["all", "high", "medium", "low"].map((f) => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={
                severityFilter === f
                  ? { background: "var(--mansa-green)", color: "#fff" }
                  : { background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--input-border)" }
              }
            >
              {f === "all" ? "Toutes" : SEVERITY_CONFIG[f as keyof typeof SEVERITY_CONFIG].label}
            </button>
          ))}
        </div>
      </div>

      {/* Grille de signaux */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((sig) => {
          const TypeIcon   = TYPE_CONFIG[sig.type].icon;
          const typeColor  = TYPE_CONFIG[sig.type].color;
          const sevConfig  = SEVERITY_CONFIG[sig.severity];
          const isPositive = sig.change > 0;
          const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

          return (
            <div key={sig.id} className="mansa-card mansa-card-hover rounded-xl p-4 cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                       style={{ background: `color-mix(in srgb, ${typeColor} 15%, transparent)` }}>
                    <TypeIcon size={14} style={{ color: typeColor }} />
                  </div>
                  <div>
                    <span className="text-[10px] font-medium" style={{ color: typeColor }}>
                      {TYPE_CONFIG[sig.type].label}
                    </span>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{sig.source}</div>
                  </div>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: sevConfig.bg, color: sevConfig.text }}
                >
                  {sevConfig.label}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{sig.flag}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                    {sig.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sig.country}</p>
                </div>
              </div>

              <p className="text-xs leading-relaxed mt-2" style={{ color: "var(--text-secondary)" }}>
                {sig.desc}
              </p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t"
                   style={{ borderColor: "var(--bg-border)" }}>
                <div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{sig.indicator}</span>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{sig.value}</p>
                </div>
                {sig.change !== 0 && (
                  <div className="flex items-center gap-1"
                       style={{ color: isPositive ? "var(--positive)" : "var(--negative)" }}>
                    <ChangeIcon size={13} />
                    <span className="text-xs font-semibold">
                      {isPositive ? "+" : ""}{sig.change}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Data sources footer */}
      <div className="mansa-card rounded-xl p-4">
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
          Sources de données actives
        </p>
        <div className="flex flex-wrap gap-2">
          {["ACLED", "EM-DAT", "NASA VIIRS", "IMF PortWatch", "IPC/CH", "Google Trends", "EIA", "WRI Aqueduct", "MANSA Research"].map((src) => (
            <span key={src} className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {src}
            </span>
          ))}
        </div>
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExportData}
        defaultFilename="mansa-hf-signals"
        title="Exporter les signaux HF"
        subtitle="Signaux haute fréquence pour toutes les sources"
        preSelectedSources={ALL_DATA_SOURCES.filter((s) =>
          ["NASA_VIIRS", "EMDAT_CRED", "IMF_PortWatch", "IPC_CH", "Google_Trends", "EIA_International"].includes(s.id)
        ).map((s) => s.id)}
      />
    </div>
  );
}
