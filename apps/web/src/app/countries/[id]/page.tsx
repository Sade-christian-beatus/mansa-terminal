"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import Image from "next/image";
import { ArrowLeft, TrendingUp, TrendingDown, Download, Shield, BarChart3, RefreshCw, Landmark, Building2, ExternalLink } from "lucide-react";

const ISO3_TO_ISO2: Record<string, string> = {
  NGA:"ng", ZAF:"za", EGY:"eg", ETH:"et", KEN:"ke", TZA:"tz", MAR:"ma", GHA:"gh",
  CIV:"ci", SEN:"sn", CMR:"cm", AGO:"ao", DZA:"dz", MOZ:"mz", ZMB:"zm", RWA:"rw",
  TUN:"tn", UGA:"ug", LBY:"ly", SUD:"sd", MLI:"ml", BFA:"bf", MWI:"mw", MDG:"mg",
  NER:"ne", BEN:"bj", TGO:"tg", GIN:"gn", TCD:"td", COD:"cd", COG:"cg", MUS:"mu",
  BWA:"bw", NAM:"na", SWZ:"sz", ZWE:"zw", SOM:"so", ERI:"er", DJI:"dj", SLE:"sl",
  LBR:"lr", GMB:"gm", GNB:"gw", CPV:"cv", GNQ:"gq", GAB:"ga", CAF:"cf", BDI:"bi",
  COM:"km", STP:"st", SYC:"sc", LSO:"ls", MRT:"mr",
};
import { macroApi, forecastApi, type BatchForecastResult, type ForecastResult, type Institution } from "@/lib/api";
import {
  getCentralBank, getStatsInstitute, getFallbackNationalIndicators,
} from "@/lib/national-sources";
import { ErrorCard } from "@/components/common/ErrorCard";
import { CATALOG_BY_ID } from "@/lib/indicator-catalog";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";
import { useState } from "react";
import ForecastChart from "@/components/ForecastChart";

/* ── Types ───────────────────────────────────────────── */
const INDICATOR_COLORS: Record<string, string> = {
  NGDP_RPCH:   "#00D4AA",
  PCPIPCH:     "#F59E0B",
  GGXCNL_NGDP: "#3B82F6",
  GGXWDG_NGDP: "#8B5CF6",
  BCA_NGDPD:   "#EC4899",
  NGDPDPC:     "#10B981",
  LUR:         "#EF4444",
};

function getIndicatorMeta(code: string) {
  const ind = CATALOG_BY_ID[code];
  if (ind) {
    const unit =
      code === "NGDPDPC" ? "USD" :
      code.endsWith("_NGDP") || code.endsWith("_NGDPD") ? "% PIB" : "%";
    return { label: ind.name_fr, unit, color: INDICATOR_COLORS[code] ?? "#00D4AA" };
  }
  const fallback: Record<string, { label: string; unit: string }> = {
    NGDP_RPCH:   { label: "Croissance PIB réel",  unit: "%" },
    PCPIPCH:     { label: "Inflation IPC",         unit: "%" },
    GGXCNL_NGDP: { label: "Solde budgétaire",      unit: "% PIB" },
    GGXWDG_NGDP: { label: "Dette publique",        unit: "% PIB" },
    BCA_NGDPD:   { label: "Compte courant",        unit: "% PIB" },
    NGDPDPC:     { label: "PIB par habitant",      unit: "USD" },
    LUR:         { label: "Taux de chômage",       unit: "%" },
  };
  const fb = fallback[code];
  return { label: fb?.label ?? code, unit: fb?.unit ?? "", color: INDICATOR_COLORS[code] ?? "#00D4AA" };
}

const REGION_LABELS: Record<string, string> = {
  "West Africa": "Afrique de l'Ouest",
  "East Africa": "Afrique de l'Est",
  "North Africa": "Afrique du Nord",
  "Central Africa": "Afrique Centrale",
  "Southern Africa": "Afrique Australe",
};

const TIER_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Couverture complète",  color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  2: { label: "Couverture modérée",   color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  3: { label: "Couverture basique",   color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
};

/* ── Scorecard helpers (reproduit la logique du prototype) ── */
type ScoreStatus = "ok" | "warn" | "bad";
interface ScoreItem {
  label: string;
  status: ScoreStatus;
  value: string;
  threshold_ok: string;
  threshold_warn: string;
}

function buildScorecard(
  growth: number | null, inflation: number | null,
  debt: number | null, fiscal: number | null,
  ca: number | null, reserves: number | null,
): ScoreItem[] {
  const item = (label: string, ok: boolean, warn: boolean, val: string, tok: string, twarn: string): ScoreItem =>
    ({ label, status: ok ? "ok" : warn ? "warn" : "bad", value: val, threshold_ok: tok, threshold_warn: twarn });

  return [
    item("Croissance PIB",  (growth ?? 0) >= 4,    (growth ?? 0) >= 2,  growth   != null ? `${growth.toFixed(1)}%` : "—",     "≥ 4%",     "≥ 2%"),
    item("Inflation IPC",   (inflation ?? 99) < 6,  (inflation ?? 99) < 12, inflation != null ? `${inflation.toFixed(1)}%` : "—","< 6%",   "< 12%"),
    item("Dette / PIB",     (debt ?? 999) < 50,     (debt ?? 999) < 70,  debt     != null ? `${debt.toFixed(0)}%` : "—",       "< 50%",    "< 70%"),
    item("Solde budgétaire",(fiscal ?? -99) > -3,   (fiscal ?? -99) > -6, fiscal  != null ? `${fiscal.toFixed(1)}%` : "—",     "> –3%",    "> –6%"),
    item("Compte courant",  (ca ?? -99) > -2,       (ca ?? -99) > -6,    ca       != null ? `${ca.toFixed(1)}%` : "—",         "> –2%",    "> –6%"),
    item("Réserves change", (reserves ?? 0) >= 4,   (reserves ?? 0) >= 3, reserves != null ? `${reserves.toFixed(1)} mois` : "—","≥ 4 mois","≥ 3 mois"),
  ];
}

function compositeGrade(items: ScoreItem[]): { grade: string; label: string; color: string } {
  const score = items.reduce((s, c) => s + (c.status === "ok" ? 2 : c.status === "warn" ? 1 : 0), 0);
  const pct = score / (items.length * 2);
  if (pct >= 0.80) return { grade: "A", label: "Solide",             color: "#10B981" };
  if (pct >= 0.62) return { grade: "B", label: "Globalement sain",   color: "#22D39A" };
  if (pct >= 0.45) return { grade: "C", label: "Sous surveillance",  color: "#F59E0B" };
  if (pct >= 0.28) return { grade: "D", label: "Fragile",            color: "#FB923C" };
  return              { grade: "E", label: "À risque",              color: "#EF4444" };
}

function generateNarrative(countryName: string, growth: number | null, inflation: number | null,
  debt: number | null, fiscal: number | null, ca: number | null, reserves: number | null): string {
  const g = growth ?? 0; const inf = inflation ?? 0; const dbt = debt ?? 0;
  const res = reserves ?? 0; const cur_ca = ca ?? 0;
  const accel = g >= 4 ? "solide" : g >= 2 ? "modérée" : "faible";
  const infTxt = inf > 15 ? "une inflation très élevée" : inf > 10 ? "une inflation élevée" : inf > 6 ? "une inflation modérée" : "une inflation maîtrisée";
  const debtTxt = dbt >= 80 ? "un endettement préoccupant" : dbt >= 60 ? "une dette au-dessus du seuil DSA (60%)" : "une dette soutenable";
  const extTxt = res < 3 ? "des réserves de change tendues" : cur_ca < -6 ? "un déficit courant important" : "une position extérieure relativement confortable";
  return `${countryName} affiche une croissance ${accel} de ${growth?.toFixed(1) ?? "N/A"}%. Le pays connaît ${infTxt} (${inflation?.toFixed(1) ?? "N/A"}%) et ${debtTxt} (${debt?.toFixed(0) ?? "N/A"}% du PIB). Sur le plan extérieur, on observe ${extTxt}${res < 3 ? ` (${reserves?.toFixed(1)} mois d'importations)` : ""}.`;
}

/* ── Sous-composants UI ──────────────────────────────── */
function KPICard({ label, value, unit, trend }: {
  label: string; value: number | null; unit: string; trend?: number | null;
}) {
  const trendPositive = (trend ?? 0) >= 0;
  return (
    <div className="mansa-card rounded-xl p-4">
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
        {value != null ? `${value.toFixed(1)}${unit === "USD" ? "" : unit}` : "–"}
        {unit === "USD" && value != null && <span className="text-sm ml-1" style={{ color: "var(--text-muted)" }}>USD</span>}
      </p>
      {trend != null && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-mono ${trendPositive ? "text-emerald-400" : "text-red-400"}`}>
          {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendPositive ? "+" : ""}{trend.toFixed(1)}{unit !== "USD" ? unit : "%"} vs an préc.
        </div>
      )}
    </div>
  );
}

function IndicatorChart({ code, points }: { code: string; points: { period: string; value: number }[] }) {
  const meta = getIndicatorMeta(code);
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  return (
    <div className="mansa-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</p>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{meta.unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
          <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "8px", fontSize: "12px" }}
            itemStyle={{ color: "var(--text-secondary)" }}
            formatter={(v: number) => [`${v.toFixed(2)} ${meta.unit}`, meta.label]}
          />
          <Line type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} dot={{ r: 3, fill: meta.color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Scorecard component ─────────────────────────────── */
const SCORE_DESCRIPTIONS: Record<string, string> = {
  "Croissance PIB":   "Rythme d'expansion de l'économie",
  "Inflation IPC":    "Hausse des prix à la consommation",
  "Dette / PIB":      "Endettement public rapporté au PIB",
  "Solde budgétaire": "Solde des finances publiques (recettes − dépenses)",
  "Compte courant":   "Solde des échanges avec l'étranger",
  "Réserves change":  "Mois d'importations couverts par les réserves",
};

function Scorecard({ items, grade }: { items: ScoreItem[]; grade: ReturnType<typeof compositeGrade> }) {
  const STATUS_CONFIG: Record<ScoreStatus, { bg: string; text: string; label: string }> = {
    ok:   { bg: "rgba(16,185,129,0.12)",  text: "#10B981", label: "Sain"         },
    warn: { bg: "rgba(245,158,11,0.12)",  text: "#F59E0B", label: "À surveiller" },
    bad:  { bg: "rgba(239,68,68,0.12)",   text: "#EF4444", label: "À risque"     },
  };

  const okCount = items.filter((i) => i.status === "ok").length;
  const score   = items.reduce((s, c) => s + (c.status === "ok" ? 2 : c.status === "warn" ? 1 : 0), 0);
  const pct     = Math.round((score / (items.length * 2)) * 100);

  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={15} style={{ color: "var(--mansa-green)" }} />
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Santé macro-fiscale
        </h3>
      </div>

      {/* Synthèse composite : note + jauge */}
      <div className="rounded-xl p-4 mb-4 flex items-center gap-4"
           style={{ background: `color-mix(in srgb, ${grade.color} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${grade.color} 25%, transparent)` }}>
        <div className="text-center flex-shrink-0">
          <p className="text-4xl font-bold leading-none" style={{ color: grade.color }}>{grade.grade}</p>
          <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Note</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: grade.color }}>{grade.label}</p>
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {okCount} indicateur{okCount > 1 ? "s" : ""} sur {items.length} au vert · score global {pct}%
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: grade.color }} />
          </div>
        </div>
      </div>

      {/* Détail par indicateur */}
      <div className="space-y-1">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          return (
            <div key={item.label} className="py-2 border-b last:border-0" style={{ borderColor: "var(--bg-border)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.text }} />
                <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                <span className="text-sm font-bold font-mono" style={{ color: cfg.text }}>{item.value}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium w-24 text-center flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.text }}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5 pl-4">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {SCORE_DESCRIPTIONS[item.label] ?? ""}
                </span>
                <span className="text-[11px] font-mono whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                  Cible&nbsp;{item.threshold_ok}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t" style={{ borderColor: "var(--bg-border)" }}>
        {(["ok", "warn", "bad"] as ScoreStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_CONFIG[s].text }} />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{STATUS_CONFIG[s].label}</span>
          </div>
        ))}
        <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
          « Cible » = seuil de bonne santé
        </span>
      </div>
    </div>
  );
}

/* ── Données statiques 54 pays (fallback quand API indisponible) ─────────── */
const STATIC_COUNTRY_DATA: Record<string, {
  flag: string; name: string; region: string;
  growth: number; inflation: number; fiscal: number; debt: number;
  ca: number; gdp_pc: number; unemployment: number;
}> = {
  NGA:{flag:"🇳🇬",name:"Nigeria",          region:"West Africa",    growth:3.1, inflation:32.5,fiscal:-4.6,debt:46, ca: 0.8,gdp_pc:2200,unemployment:5.0},
  ZAF:{flag:"🇿🇦",name:"Afrique du Sud",   region:"Southern Africa",growth:1.1, inflation:4.6, fiscal:-5.0,debt:75, ca:-1.6,gdp_pc:6200,unemployment:33.0},
  EGY:{flag:"🇪🇬",name:"Égypte",           region:"North Africa",   growth:2.7, inflation:28.3,fiscal:-7.2,debt:90, ca:-5.4,gdp_pc:3400,unemployment:7.2},
  ETH:{flag:"🇪🇹",name:"Éthiopie",         region:"East Africa",    growth:6.8, inflation:24.1,fiscal:-2.6,debt:38, ca:-3.1,gdp_pc:1300,unemployment:3.5},
  KEN:{flag:"🇰🇪",name:"Kenya",            region:"East Africa",    growth:5.0, inflation:6.5, fiscal:-5.5,debt:70, ca:-4.0,gdp_pc:2100,unemployment:5.7},
  TZA:{flag:"🇹🇿",name:"Tanzanie",         region:"East Africa",    growth:5.4, inflation:3.1, fiscal:-3.0,debt:42, ca:-3.5,gdp_pc:1200,unemployment:2.7},
  MAR:{flag:"🇲🇦",name:"Maroc",            region:"North Africa",   growth:3.2, inflation:2.4, fiscal:-4.1,debt:69, ca:-1.2,gdp_pc:3700,unemployment:12.9},
  GHA:{flag:"🇬🇭",name:"Ghana",            region:"West Africa",    growth:3.1, inflation:22.3,fiscal:-4.6,debt:83, ca:-2.0,gdp_pc:2400,unemployment:4.5},
  CIV:{flag:"🇨🇮",name:"Côte d'Ivoire",    region:"West Africa",    growth:6.5, inflation:3.8, fiscal:-4.0,debt:57, ca:-3.7,gdp_pc:2900,unemployment:3.8},
  SEN:{flag:"🇸🇳",name:"Sénégal",          region:"West Africa",    growth:8.3, inflation:2.8, fiscal:-4.9,debt:73, ca:-12.1,gdp_pc:1800,unemployment:20.1},
  CMR:{flag:"🇨🇲",name:"Cameroun",         region:"Central Africa", growth:4.1, inflation:7.4, fiscal:-2.5,debt:48, ca:-4.2,gdp_pc:1700,unemployment:4.2},
  AGO:{flag:"🇦🇴",name:"Angola",           region:"Central Africa", growth:2.4, inflation:28.2,fiscal:-1.0,debt:73, ca: 4.5,gdp_pc:3100,unemployment:7.5},
  DZA:{flag:"🇩🇿",name:"Algérie",          region:"North Africa",   growth:3.6, inflation:9.2, fiscal:-5.8,debt:60, ca: 2.4,gdp_pc:5200,unemployment:11.8},
  MOZ:{flag:"🇲🇿",name:"Mozambique",       region:"East Africa",    growth:5.5, inflation:6.2, fiscal:-5.0,debt:100,ca:-26.0,gdp_pc:560, unemployment:3.2},
  ZMB:{flag:"🇿🇲",name:"Zambie",           region:"Southern Africa",growth:4.8, inflation:13.0,fiscal:-7.6,debt:137,ca: 1.5,gdp_pc:1500,unemployment:12.7},
  RWA:{flag:"🇷🇼",name:"Rwanda",           region:"East Africa",    growth:7.0, inflation:5.8, fiscal:-6.0,debt:68, ca:-11.4,gdp_pc:900, unemployment:1.3},
  TUN:{flag:"🇹🇳",name:"Tunisie",          region:"North Africa",   growth:1.8, inflation:9.3, fiscal:-7.7,debt:80, ca:-6.2,gdp_pc:3700,unemployment:15.4},
  UGA:{flag:"🇺🇬",name:"Ouganda",          region:"East Africa",    growth:6.1, inflation:3.8, fiscal:-4.4,debt:50, ca:-9.2,gdp_pc:1100,unemployment:2.1},
  LBY:{flag:"🇱🇾",name:"Libye",            region:"North Africa",   growth:4.0, inflation:2.8, fiscal: 4.0,debt:84, ca:13.3,gdp_pc:5200,unemployment:18.6},
  SUD:{flag:"🇸🇩",name:"Soudan",           region:"East Africa",    growth:0.5, inflation:65.0,fiscal:-3.0,debt:183,ca:-5.0,gdp_pc:750, unemployment:13.7},
  MLI:{flag:"🇲🇱",name:"Mali",             region:"West Africa",    growth:4.0, inflation:2.5, fiscal:-3.5,debt:50, ca:-5.5,gdp_pc:1000,unemployment:7.9},
  BFA:{flag:"🇧🇫",name:"Burkina Faso",     region:"West Africa",    growth:2.5, inflation:3.0, fiscal:-4.5,debt:54, ca:-4.1,gdp_pc:840, unemployment:5.5},
  MWI:{flag:"🇲🇼",name:"Malawi",           region:"East Africa",    growth:1.8, inflation:25.0,fiscal:-7.0,debt:92, ca:-9.0,gdp_pc:500, unemployment:6.0},
  MDG:{flag:"🇲🇬",name:"Madagascar",       region:"East Africa",    growth:4.8, inflation:8.0, fiscal:-4.8,debt:57, ca:-6.0,gdp_pc:520, unemployment:1.8},
  NER:{flag:"🇳🇪",name:"Niger",            region:"West Africa",    growth:12.3,inflation:3.9, fiscal:-6.8,debt:52, ca:-16.0,gdp_pc:650, unemployment:0.8},
  BEN:{flag:"🇧🇯",name:"Bénin",            region:"West Africa",    growth:6.4, inflation:2.7, fiscal:-4.7,debt:54, ca:-4.2,gdp_pc:1500,unemployment:2.3},
  TGO:{flag:"🇹🇬",name:"Togo",             region:"West Africa",    growth:6.0, inflation:4.0, fiscal:-3.8,debt:69, ca:-2.9,gdp_pc:1050,unemployment:3.5},
  GIN:{flag:"🇬🇳",name:"Guinée",           region:"West Africa",    growth:6.5, inflation:9.6, fiscal:-3.3,debt:35, ca:-12.0,gdp_pc:1200,unemployment:4.0},
  TCD:{flag:"🇹🇩",name:"Tchad",            region:"Central Africa", growth:3.0, inflation:4.5, fiscal:-1.0,debt:45, ca:-1.5,gdp_pc:750, unemployment:2.3},
  COD:{flag:"🇨🇩",name:"Congo (RDC)",      region:"Central Africa", growth:6.3, inflation:23.6,fiscal:-1.0,debt:15, ca:-3.7,gdp_pc:660, unemployment:4.5},
  COG:{flag:"🇨🇬",name:"Congo (Brazza)",   region:"Central Africa", growth:4.1, inflation:4.0, fiscal:-0.3,debt:89, ca: 1.0,gdp_pc:2300,unemployment:5.5},
  MUS:{flag:"🇲🇺",name:"Maurice",          region:"East Africa",    growth:5.6, inflation:7.0, fiscal:-4.0,debt:85, ca:-5.9,gdp_pc:10500,unemployment:6.2},
  BWA:{flag:"🇧🇼",name:"Botswana",         region:"Southern Africa",growth:3.5, inflation:5.5, fiscal:-1.5,debt:19, ca:-1.6,gdp_pc:7400,unemployment:24.5},
  NAM:{flag:"🇳🇦",name:"Namibie",          region:"Southern Africa",growth:3.6, inflation:5.8, fiscal:-5.2,debt:68, ca:-10.0,gdp_pc:4700,unemployment:33.4},
  SWZ:{flag:"🇸🇿",name:"Eswatini",         region:"Southern Africa",growth:2.0, inflation:5.9, fiscal:-2.8,debt:52, ca: 0.5,gdp_pc:3800,unemployment:22.0},
  ZWE:{flag:"🇿🇼",name:"Zimbabwe",         region:"Southern Africa",growth:3.0, inflation:165.0,fiscal:-3.0,debt:95,ca:-6.0,gdp_pc:1700,unemployment:5.3},
  SOM:{flag:"🇸🇴",name:"Somalie",          region:"East Africa",    growth:3.5, inflation:3.5, fiscal:-1.0,debt:80, ca:-10.0,gdp_pc:600, unemployment:8.0},
  ERI:{flag:"🇪🇷",name:"Érythrée",         region:"East Africa",    growth:2.5, inflation:5.0, fiscal:-12.0,debt:180,ca:-4.0,gdp_pc:740, unemployment:6.0},
  DJI:{flag:"🇩🇯",name:"Djibouti",         region:"East Africa",    growth:7.1, inflation:3.0, fiscal:-1.5,debt:73, ca:-6.0,gdp_pc:3800,unemployment:11.5},
  SLE:{flag:"🇸🇱",name:"Sierra Leone",     region:"West Africa",    growth:3.5, inflation:37.0,fiscal:-8.3,debt:82, ca:-14.0,gdp_pc:600, unemployment:4.5},
  LBR:{flag:"🇱🇷",name:"Liberia",          region:"West Africa",    growth:4.5, inflation:8.0, fiscal:-5.0,debt:60, ca:-23.0,gdp_pc:900, unemployment:3.5},
  GMB:{flag:"🇬🇲",name:"Gambie",           region:"West Africa",    growth:5.8, inflation:15.0,fiscal:-3.9,debt:80, ca:-5.0,gdp_pc:900, unemployment:8.3},
  GNB:{flag:"🇬🇼",name:"Guinée-Bissau",    region:"West Africa",    growth:4.2, inflation:5.0, fiscal:-3.5,debt:78, ca:-5.0,gdp_pc:900, unemployment:6.3},
  CPV:{flag:"🇨🇻",name:"Cap-Vert",         region:"West Africa",    growth:4.5, inflation:7.5, fiscal:-2.8,debt:140,ca:-5.0,gdp_pc:3700,unemployment:11.0},
  GNQ:{flag:"🇬🇶",name:"Guinée équato.",   region:"Central Africa", growth:-2.0,inflation:5.0, fiscal:-6.5,debt:47, ca:-4.0,gdp_pc:8400,unemployment:6.8},
  GAB:{flag:"🇬🇦",name:"Gabon",            region:"Central Africa", growth:2.5, inflation:4.8, fiscal:-1.8,debt:75, ca: 2.5,gdp_pc:8600,unemployment:6.0},
  CAF:{flag:"🇨🇫",name:"Centrafrique",     region:"Central Africa", growth:1.5, inflation:5.3, fiscal:-5.0,debt:60, ca:-12.0,gdp_pc:550, unemployment:5.8},
  BDI:{flag:"🇧🇮",name:"Burundi",          region:"East Africa",    growth:2.2, inflation:22.0,fiscal:-5.0,debt:70, ca:-13.0,gdp_pc:230, unemployment:1.5},
  COM:{flag:"🇰🇲",name:"Comores",          region:"East Africa",    growth:3.1, inflation:5.0, fiscal:-2.5,debt:37, ca:-3.0,gdp_pc:1500,unemployment:3.0},
  STP:{flag:"🇸🇹",name:"São Tomé",         region:"Central Africa", growth:2.5, inflation:17.0,fiscal:-3.0,debt:104,ca:-17.0,gdp_pc:3200,unemployment:13.0},
  SYC:{flag:"🇸🇨",name:"Seychelles",       region:"East Africa",    growth:5.0, inflation:4.5, fiscal:-1.5,debt:65, ca:-10.0,gdp_pc:15800,unemployment:3.4},
  LSO:{flag:"🇱🇸",name:"Lesotho",          region:"Southern Africa",growth:1.8, inflation:7.0, fiscal:-5.5,debt:65, ca: 3.0,gdp_pc:1200,unemployment:24.0},
  MRT:{flag:"🇲🇷",name:"Mauritanie",       region:"West Africa",    growth:3.9, inflation:6.3, fiscal:-1.0,debt:60, ca:-7.0,gdp_pc:2100,unemployment:11.0},
};

/** Génère une série temporelle simulée 2015–2025 à partir d'une valeur de référence */
function generateStaticSeries(value: number, code: string): { period: string; value: number; unit: string | null; source: string }[] {
  return Array.from({ length: 11 }, (_, i) => {
    const year = 2015 + i;
    const seed = Math.sin(year * 3.7 + code.charCodeAt(0) * 0.8) * Math.abs(value) * 0.18;
    const drift = (value / 11) * (i - 5) * 0.1;
    const v = year === 2025 ? value : Math.round((value + drift + seed) * 100) / 100;
    return { period: String(year), value: v, unit: null, source: "FMI WEO (statique)" };
  });
}

/* ── Profil géographique & institutionnel ───────────────── */
interface CountryProfile {
  capital: string;
  languages: string[];
  area_km2: number;
  population_m: number;    // millions
  phone_code: string;
  currency: string;
  currency_code: string;
  tld: string;
  major_cities: string[];
  independence?: string;
  hdi?: number;
}

const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  NGA:{ capital:"Abuja",          languages:["Anglais","Haoussa","Yoruba","Igbo"],    area_km2:923_768, population_m:223, phone_code:"+234", currency:"Naira",           currency_code:"NGN", tld:".ng", major_cities:["Lagos","Kano","Ibadan","Abuja","Port Harcourt"], independence:"1960" },
  ZAF:{ capital:"Pretoria",       languages:["Zoulou","Xhosa","Afrikaans","Anglais"],  area_km2:1_219_090,population_m:60,  phone_code:"+27",  currency:"Rand",            currency_code:"ZAR", tld:".za", major_cities:["Johannesburg","Cape Town","Durban","Pretoria","Port Elizabeth"], independence:"1910" },
  EGY:{ capital:"Le Caire",       languages:["Arabe"],                                 area_km2:1_001_449,population_m:106, phone_code:"+20",  currency:"Livre égyptienne",currency_code:"EGP", tld:".eg", major_cities:["Le Caire","Alexandrie","Gizeh","Shubra El-Kheima","Port-Saïd"], independence:"1952" },
  ETH:{ capital:"Addis-Abeba",    languages:["Amharique","Oromo","Tigrigna"],           area_km2:1_104_300,population_m:127, phone_code:"+251", currency:"Birr",            currency_code:"ETB", tld:".et", major_cities:["Addis-Abeba","Dire Dawa","Mekele","Nazret","Bahir Dar"], independence:"Jamais colonisé" },
  KEN:{ capital:"Nairobi",        languages:["Swahili","Anglais"],                      area_km2:580_367,  population_m:55,  phone_code:"+254", currency:"Shilling kenyan", currency_code:"KES", tld:".ke", major_cities:["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret"], independence:"1963" },
  TZA:{ capital:"Dodoma",         languages:["Swahili","Anglais"],                      area_km2:945_087,  population_m:65,  phone_code:"+255", currency:"Shilling tanzanien",currency_code:"TZS",tld:".tz", major_cities:["Dar es Salaam","Mwanza","Arusha","Dodoma","Mbeya"], independence:"1961" },
  MAR:{ capital:"Rabat",          languages:["Arabe","Tamazight","Français"],           area_km2:710_850,  population_m:37,  phone_code:"+212", currency:"Dirham",          currency_code:"MAD", tld:".ma", major_cities:["Casablanca","Fès","Marrakech","Rabat","Tanger"], independence:"1956" },
  GHA:{ capital:"Accra",          languages:["Anglais","Akan","Ewe"],                   area_km2:238_533,  population_m:33,  phone_code:"+233", currency:"Cedi",            currency_code:"GHS", tld:".gh", major_cities:["Accra","Kumasi","Tamale","Sekondi-Takoradi","Cape Coast"], independence:"1957" },
  CIV:{ capital:"Yamoussoukro",   languages:["Français","Dioula"],                      area_km2:322_463,  population_m:27,  phone_code:"+225", currency:"Franc CFA",       currency_code:"XOF", tld:".ci", major_cities:["Abidjan","Bouaké","Daloa","Yamoussoukro","Korhogo"], independence:"1960" },
  SEN:{ capital:"Dakar",          languages:["Français","Wolof","Pulaar","Sérère"],      area_km2:196_722,  population_m:18,  phone_code:"+221", currency:"Franc CFA",       currency_code:"XOF", tld:".sn", major_cities:["Dakar","Touba","Thiès","Saint-Louis","Ziguinchor"], independence:"1960" },
  CMR:{ capital:"Yaoundé",        languages:["Français","Anglais"],                     area_km2:475_442,  population_m:28,  phone_code:"+237", currency:"Franc CFA",       currency_code:"XAF", tld:".cm", major_cities:["Douala","Yaoundé","Garoua","Bamenda","Maroua"], independence:"1960" },
  AGO:{ capital:"Luanda",         languages:["Portugais","Umbundu","Kimbundu"],          area_km2:1_246_700,population_m:36,  phone_code:"+244", currency:"Kwanza",          currency_code:"AOA", tld:".ao", major_cities:["Luanda","Huambo","Lobito","Benguela","Kuito"], independence:"1975" },
  DZA:{ capital:"Alger",          languages:["Arabe","Tamazight","Français"],            area_km2:2_381_741,population_m:45,  phone_code:"+213", currency:"Dinar algérien",  currency_code:"DZD", tld:".dz", major_cities:["Alger","Oran","Constantine","Annaba","Blida"], independence:"1962" },
  MOZ:{ capital:"Maputo",         languages:["Portugais","Emakhuwa","Xichangana"],       area_km2:801_590,  population_m:33,  phone_code:"+258", currency:"Metical",         currency_code:"MZN", tld:".mz", major_cities:["Maputo","Matola","Nampula","Beira","Chimoio"], independence:"1975" },
  ZMB:{ capital:"Lusaka",         languages:["Anglais","Bemba","Tonga","Nyanja"],        area_km2:752_618,  population_m:20,  phone_code:"+260", currency:"Kwacha",          currency_code:"ZMW", tld:".zm", major_cities:["Lusaka","Kitwe","Ndola","Kabwe","Chingola"], independence:"1964" },
  RWA:{ capital:"Kigali",         languages:["Kinyarwanda","Français","Anglais"],        area_km2:26_338,   population_m:14,  phone_code:"+250", currency:"Franc rwandais",  currency_code:"RWF", tld:".rw", major_cities:["Kigali","Gisenyi","Butare","Gitarama","Ruhengeri"], independence:"1962" },
  TUN:{ capital:"Tunis",          languages:["Arabe","Français"],                        area_km2:163_610,  population_m:12,  phone_code:"+216", currency:"Dinar tunisien",  currency_code:"TND", tld:".tn", major_cities:["Tunis","Sfax","Sousse","Kairouan","Bizerte"], independence:"1956" },
  UGA:{ capital:"Kampala",        languages:["Anglais","Swahili","Luganda"],             area_km2:241_038,  population_m:48,  phone_code:"+256", currency:"Shilling ougandais",currency_code:"UGX",tld:".ug", major_cities:["Kampala","Gulu","Lira","Mbarara","Jinja"], independence:"1962" },
  LBY:{ capital:"Tripoli",        languages:["Arabe"],                                   area_km2:1_759_540,population_m:7,   phone_code:"+218", currency:"Dinar libyen",    currency_code:"LYD", tld:".ly", major_cities:["Tripoli","Benghazi","Misrata","Tarhuna","Al-Khums"], independence:"1951" },
  SUD:{ capital:"Khartoum",       languages:["Arabe","Anglais","Nubien"],                area_km2:1_861_484,population_m:47,  phone_code:"+249", currency:"Livre soudanaise",currency_code:"SDG", tld:".sd", major_cities:["Khartoum","Omdurman","Khartoum-Nord","Port-Soudan","Kassala"], independence:"1956" },
  MLI:{ capital:"Bamako",         languages:["Français","Bambara","Fulfulde"],           area_km2:1_240_192,population_m:23,  phone_code:"+223", currency:"Franc CFA",       currency_code:"XOF", tld:".ml", major_cities:["Bamako","Sikasso","Mopti","Koutiala","Kayes"], independence:"1960" },
  BFA:{ capital:"Ouagadougou",    languages:["Français","Mòoré","Dioula"],               area_km2:274_200,  population_m:22,  phone_code:"+226", currency:"Franc CFA",       currency_code:"XOF", tld:".bf", major_cities:["Ouagadougou","Bobo-Dioulasso","Koudougou","Banfora","Ouahigouya"], independence:"1960" },
  MWI:{ capital:"Lilongwe",       languages:["Chichewa","Anglais","Tumbuka"],            area_km2:118_484,  population_m:20,  phone_code:"+265", currency:"Kwacha malawite", currency_code:"MWK", tld:".mw", major_cities:["Lilongwe","Blantyre","Mzuzu","Zomba","Kasungu"], independence:"1964" },
  MDG:{ capital:"Antananarivo",   languages:["Malgache","Français"],                     area_km2:587_041,  population_m:29,  phone_code:"+261", currency:"Ariary",          currency_code:"MGA", tld:".mg", major_cities:["Antananarivo","Toamasina","Antsirabe","Fianarantsoa","Mahajanga"], independence:"1960" },
  NER:{ capital:"Niamey",         languages:["Français","Haoussa","Zarma"],              area_km2:1_267_000,population_m:26,  phone_code:"+227", currency:"Franc CFA",       currency_code:"XOF", tld:".ne", major_cities:["Niamey","Zinder","Maradi","Tahoua","Agadez"], independence:"1960" },
  BEN:{ capital:"Porto-Novo",     languages:["Français","Fon","Yoruba","Bariba"],        area_km2:112_622,  population_m:13,  phone_code:"+229", currency:"Franc CFA",       currency_code:"XOF", tld:".bj", major_cities:["Cotonou","Porto-Novo","Parakou","Djougou","Bohicon"], independence:"1960" },
  TGO:{ capital:"Lomé",           languages:["Français","Ewe","Kabiyè"],                 area_km2:56_785,   population_m:9,   phone_code:"+228", currency:"Franc CFA",       currency_code:"XOF", tld:".tg", major_cities:["Lomé","Sokodé","Kpalimé","Kara","Atakpamé"], independence:"1960" },
  GIN:{ capital:"Conakry",        languages:["Français","Pular","Mandinka","Soussou"],   area_km2:245_857,  population_m:14,  phone_code:"+224", currency:"Franc guinéen",   currency_code:"GNF", tld:".gn", major_cities:["Conakry","Nzérékoré","Kindia","Kankan","Labé"], independence:"1958" },
  TCD:{ capital:"N'Djamena",      languages:["Français","Arabe","Sara"],                 area_km2:1_284_000,population_m:18,  phone_code:"+235", currency:"Franc CFA",       currency_code:"XAF", tld:".td", major_cities:["N'Djamena","Moundou","Sarh","Abéché","Kélo"], independence:"1960" },
  COD:{ capital:"Kinshasa",       languages:["Français","Lingala","Swahili","Kikongo"],  area_km2:2_344_858,population_m:100, phone_code:"+243", currency:"Franc congolais",  currency_code:"CDF", tld:".cd", major_cities:["Kinshasa","Lubumbashi","Mbuji-Mayi","Kananga","Kisangani"], independence:"1960" },
  COG:{ capital:"Brazzaville",    languages:["Français","Lingala","Monokutuba"],          area_km2:342_000,  population_m:6,   phone_code:"+242", currency:"Franc CFA",       currency_code:"XAF", tld:".cg", major_cities:["Brazzaville","Pointe-Noire","Dolisie","Nkayi","Impfondo"], independence:"1960" },
  MUS:{ capital:"Port-Louis",     languages:["Anglais","Créole mauricien","Français"],   area_km2:2_040,    population_m:1.3, phone_code:"+230", currency:"Roupie mauricienne",currency_code:"MUR",tld:".mu", major_cities:["Port-Louis","Beau Bassin","Vacoas","Curepipe","Quatre Bornes"], independence:"1968" },
  BWA:{ capital:"Gaborone",       languages:["Setswana","Anglais"],                       area_km2:581_730,  population_m:2.6, phone_code:"+267", currency:"Pula",            currency_code:"BWP", tld:".bw", major_cities:["Gaborone","Francistown","Molepolole","Selebi-Phikwe","Maun"], independence:"1966" },
  NAM:{ capital:"Windhoek",       languages:["Anglais","Afrikaans","Oshiwambo"],          area_km2:824_292,  population_m:2.7, phone_code:"+264", currency:"Dollar namibien",  currency_code:"NAD", tld:".na", major_cities:["Windhoek","Rundu","Walvis Bay","Swakopmund","Oshakati"], independence:"1990" },
  SWZ:{ capital:"Mbabane",        languages:["Siswati","Anglais"],                        area_km2:17_364,   population_m:1.2, phone_code:"+268", currency:"Lilangeni",       currency_code:"SZL", tld:".sz", major_cities:["Mbabane","Manzini","Big Bend","Malkerns","Nhlangano"], independence:"1968" },
  ZWE:{ capital:"Harare",         languages:["Shona","Ndebele","Anglais"],                area_km2:390_757,  population_m:16,  phone_code:"+263", currency:"Dollar zimbabwéen",currency_code:"ZWL", tld:".zw", major_cities:["Harare","Bulawayo","Chitungwiza","Mutare","Gweru"], independence:"1980" },
  SOM:{ capital:"Mogadiscio",     languages:["Somali","Arabe"],                           area_km2:637_657,  population_m:18,  phone_code:"+252", currency:"Shilling somalien",currency_code:"SOS", tld:".so", major_cities:["Mogadiscio","Hargeisa","Berbera","Kismayo","Baidoa"], independence:"1960" },
  ERI:{ capital:"Asmara",         languages:["Tigrigna","Arabe","Anglais"],               area_km2:117_600,  population_m:3.5, phone_code:"+291", currency:"Nakfa",           currency_code:"ERN", tld:".er", major_cities:["Asmara","Keren","Massaoua","Assab","Mendefera"], independence:"1993" },
  DJI:{ capital:"Djibouti",       languages:["Afar","Somali","Arabe","Français"],         area_km2:23_200,   population_m:1.0, phone_code:"+253", currency:"Franc djiboutien", currency_code:"DJF", tld:".dj", major_cities:["Djibouti","Ali Sabieh","Dikhil","Tadjourah","Obock"], independence:"1977" },
  SLE:{ capital:"Freetown",       languages:["Anglais","Krio","Temne","Mende"],           area_km2:71_740,   population_m:8.5, phone_code:"+232", currency:"Leone",           currency_code:"SLL", tld:".sl", major_cities:["Freetown","Bo","Kenema","Koidu","Makeni"], independence:"1961" },
  LBR:{ capital:"Monrovia",       languages:["Anglais","Kpelle","Bassa"],                 area_km2:111_369,  population_m:5.4, phone_code:"+231", currency:"Dollar libérien",  currency_code:"LRD", tld:".lr", major_cities:["Monrovia","Gbarnga","Kakata","Bensonville","Harper"], independence:"1847" },
  GMB:{ capital:"Banjul",         languages:["Anglais","Mandinka","Wolof","Fulah"],       area_km2:11_295,   population_m:2.7, phone_code:"+220", currency:"Dalasi",          currency_code:"GMD", tld:".gm", major_cities:["Banjul","Serekunda","Brikama","Farafenni","Basse Santa Su"], independence:"1965" },
  GNB:{ capital:"Bissau",         languages:["Portugais","Créole","Balanta","Fula"],      area_km2:36_125,   population_m:2.1, phone_code:"+245", currency:"Franc CFA",       currency_code:"XOF", tld:".gw", major_cities:["Bissau","Bafatá","Gabú","Bissorã","Cacheu"], independence:"1974" },
  CPV:{ capital:"Praia",          languages:["Portugais","Créole capverdien"],            area_km2:4_033,    population_m:0.6, phone_code:"+238", currency:"Escudo capverdien",currency_code:"CVE", tld:".cv", major_cities:["Praia","Mindelo","Santa Maria","Assomada","São Filipe"], independence:"1975" },
  GNQ:{ capital:"Malabo",         languages:["Espagnol","Français","Portugais","Fang"],   area_km2:28_051,   population_m:1.5, phone_code:"+240", currency:"Franc CFA",       currency_code:"XAF", tld:".gq", major_cities:["Malabo","Bata","Ebebiyín","Aconibe","Añisoc"], independence:"1968" },
  GAB:{ capital:"Libreville",     languages:["Français","Fang","Myene"],                  area_km2:267_668,  population_m:2.3, phone_code:"+241", currency:"Franc CFA",       currency_code:"XAF", tld:".ga", major_cities:["Libreville","Port-Gentil","Franceville","Oyem","Moanda"], independence:"1960" },
  CAF:{ capital:"Bangui",         languages:["Français","Sango"],                         area_km2:622_984,  population_m:5.5, phone_code:"+236", currency:"Franc CFA",       currency_code:"XAF", tld:".cf", major_cities:["Bangui","Bimbo","Mbaïki","Berberati","Kaga-Bandoro"], independence:"1960" },
  BDI:{ capital:"Bujumbura",      languages:["Kirundi","Français","Anglais"],             area_km2:27_834,   population_m:13,  phone_code:"+257", currency:"Franc burundais",  currency_code:"BIF", tld:".bi", major_cities:["Bujumbura","Gitega","Muyinga","Ngozi","Ruyigi"], independence:"1962" },
  COM:{ capital:"Moroni",         languages:["Comorien","Arabe","Français"],              area_km2:2_235,    population_m:0.9, phone_code:"+269", currency:"Franc comorien",   currency_code:"KMF", tld:".km", major_cities:["Moroni","Mutsamudu","Fomboni","Domoni","Sima"], independence:"1975" },
  STP:{ capital:"São Tomé",       languages:["Portugais","Créole santomais"],             area_km2:964,      population_m:0.2, phone_code:"+239", currency:"Dobra",           currency_code:"STN", tld:".st", major_cities:["São Tomé","Santo António","Neves","Guadalupe","Santa Cruz"], independence:"1975" },
  SYC:{ capital:"Victoria",       languages:["Créole seychellois","Anglais","Français"],  area_km2:451,      population_m:0.1, phone_code:"+248", currency:"Roupie seychelloise",currency_code:"SCR",tld:".sc", major_cities:["Victoria","Anse Boileau","Bel Ombre","Beau Vallon","Takamaka"], independence:"1976" },
  LSO:{ capital:"Maseru",         languages:["Sesotho","Anglais","Zoulou"],               area_km2:30_355,   population_m:2.2, phone_code:"+266", currency:"Loti",            currency_code:"LSL", tld:".ls", major_cities:["Maseru","Teyateyaneng","Mafeteng","Hlotse","Mohale's Hoek"], independence:"1966" },
  MRT:{ capital:"Nouakchott",     languages:["Arabe","Pulaar","Wolof","Soninké"],         area_km2:1_030_700,population_m:4.7, phone_code:"+222", currency:"Ouguiya",         currency_code:"MRU", tld:".mr", major_cities:["Nouakchott","Nouadhibou","Kaédi","Zouerate","Rosso"], independence:"1960" },
};

const FORECAST_INDS = "NGDP_RPCH,PCPIPCH,GGXWDG_NGDP,GGXCNL_NGDP,BCA_NGDPD";

function ForecastSection({ countryId }: { countryId: string }) {
  const [horizon, setHorizon] = useState(3);
  const [data, setData] = useState<BatchForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await forecastApi.getBatch(countryId, { indicators: FORECAST_INDS, horizon });
      setData(res); setLoaded(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Erreur");
    } finally { setLoading(false); }
  }

  if (!loaded && !loading) {
    return (
      <div className="mansa-card rounded-xl p-8 text-center space-y-3">
        <BarChart3 size={28} className="mx-auto" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Prévisions ARIMA 1–5 ans pour {countryId}
        </p>
        <button onClick={load}
          className="mx-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "var(--mansa-green)", color: "#000" }}>
          Charger les prévisions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
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
        <button onClick={load}
          className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
          style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-xs flex items-center gap-2"
             style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="mansa-card rounded-xl p-4 h-56 skeleton" />
          ))}
        </div>
      )}

      {!loading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data.forecasts).map(([code, fc]) => {
            if ("error" in fc) return (
              <div key={code} className="mansa-card rounded-xl p-4 flex flex-col items-center justify-center min-h-[180px]">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{code}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{fc.error}</p>
              </div>
            );
            return (
              <div key={code} className="mansa-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {(fc as ForecastResult).indicator_name}
                  </p>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                    {(fc as ForecastResult).model}
                  </span>
                </div>
                <ForecastChart result={fc as ForecastResult} height={180} />
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        ARIMA(1,1,1) ou Holt ES · Intervalles de confiance 80%/95% · Données IMF WEO
      </p>
    </div>
  );
}

/* ── Sources nationales ───────────────────────────────── */
const NATIONAL_IND_LABELS: Record<string, string> = {
  INT_POLICY:      "Taux directeur",
  INT_RESERVE_REQ: "Réserves obligatoires",
  CPI_NAT:         "Inflation IPC (nationale)",
  FX_CBN_USD:      "Taux de change officiel",
  FX_RESERVES:     "Réserves de change",
  M2_GDP:          "Masse monétaire M2",
};

function InstitutionCard({ icon: Icon, role, inst }: {
  icon: typeof Landmark; role: string; inst: Institution;
}) {
  return (
    <div className="mansa-card rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
           style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)" }}>
        <Icon size={18} style={{ color: "var(--mansa-green)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>{role}</p>
        <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
          {inst.abbrev}
          {inst.url && (
            <a href={inst.url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center ml-1.5 align-middle"
               style={{ color: "var(--mansa-green)" }}>
              <ExternalLink size={12} />
            </a>
          )}
        </p>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{inst.name}</p>
      </div>
    </div>
  );
}

function NationalSourcesSection({ countryId, fallbackInflation }: {
  countryId: string; fallbackInflation: number | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["country-national", countryId],
    queryFn: () => macroApi.getNationalSources(countryId),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const latest = (pts: { period: string; value: number; unit: string | null; source: string }[]) => {
    if (!pts?.length) return null;
    return [...pts].sort((a, b) => b.period.localeCompare(a.period))[0];
  };

  // Institutions : API si disponible, sinon repli côté client
  const statsInstitute = data?.institutions?.stats_institute ?? getStatsInstitute(countryId);
  const centralBank    = data?.institutions?.central_bank ?? getCentralBank(countryId);
  const others         = data?.institutions?.others ?? [];

  // Indicateurs : API si présents, sinon repli (taux directeur + IPC national)
  const apiIndicators = data?.indicators ?? {};
  const apiCodes = Object.keys(apiIndicators).filter((c) => (apiIndicators[c]?.length ?? 0) > 0);
  const indicators = apiCodes.length > 0
    ? apiCodes.map((code) => ({ code, ...latest(apiIndicators[code])! }))
    : getFallbackNationalIndicators(countryId, fallbackInflation);
  const isFallback = apiCodes.length === 0;

  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Landmark size={15} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Sources nationales
          </h3>
        </div>
        {isFallback && indicators.length > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
            Dernières valeurs publiées
          </span>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Institutions productrices de statistiques propres au pays et données qu'elles publient.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => <div key={i} className="mansa-card rounded-xl h-20 skeleton" />)}
        </div>
      ) : (
        <>
          {/* Institutions */}
          {(statsInstitute || centralBank || others.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {statsInstitute && (
                <InstitutionCard icon={Building2} role="Institut de statistique" inst={statsInstitute} />
              )}
              {centralBank && (
                <InstitutionCard icon={Landmark} role="Banque centrale" inst={centralBank} />
              )}
              {others.map((o) => (
                <InstitutionCard key={o.abbrev} icon={Building2} role="Autre source" inst={o} />
              ))}
            </div>
          )}

          {/* Indicateurs nationaux */}
          {indicators.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {indicators.map((pt) => (
                <div key={pt.code} className="rounded-xl p-3" style={{ background: "var(--bg-border)" }}>
                  <p className="text-[11px] mb-1 leading-tight" style={{ color: "var(--text-muted)" }}>
                    {data?.indicator_names?.[pt.code] ?? NATIONAL_IND_LABELS[pt.code] ?? pt.code}
                  </p>
                  <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                    {pt.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                    {pt.unit && pt.unit !== "USD" && <span className="text-xs ml-0.5">{pt.unit}</span>}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)", color: "var(--mansa-green)" }}>
                      {pt.source}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{pt.period}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-4 text-center" style={{ background: "var(--bg-border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Aucune donnée nationale disponible pour ce pays. Lancez{" "}
                <code className="text-[#00D4AA] bg-[#00D4AA]/10 px-1 rounded">dagster job execute -j daily_data_refresh</code>{" "}
                (asset <code className="text-[#00D4AA] bg-[#00D4AA]/10 px-1 rounded">central_banks_to_database</code>) pour les charger en temps réel.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Page principale ─────────────────────────────────── */
export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const countryId = id.toUpperCase();
  const [exportOpen, setExportOpen] = useState(false);
  const [dataTab, setDataTab] = useState<"historique" | "previsions">("historique");

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const { data: macro, isLoading, isError } = useQuery({
    queryKey: ["country-macro", countryId],
    queryFn: () => macroApi.getCountryMacro(countryId, { from_year: 2015, to_year: 2024 }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const meta    = countries?.find((c: { id: string }) => c.id === countryId);
  const profile = COUNTRY_PROFILES[countryId];

  // Si l'API échoue, on utilise les données statiques
  const staticData = STATIC_COUNTRY_DATA[countryId];

  if (isError && !staticData) {
    return (
      <ErrorCard
        title="Pays introuvable"
        message={`Aucune donnée disponible pour le code pays "${countryId}".`}
        reset={() => router.push("/countries")}
      />
    );
  }

  // Construire des indicateurs de fallback à partir des données statiques
  const fallbackIndicators = staticData ? {
    NGDP_RPCH:   generateStaticSeries(staticData.growth,      "NGDP_RPCH"),
    PCPIPCH:     generateStaticSeries(staticData.inflation,   "PCPIPCH"),
    GGXCNL_NGDP: generateStaticSeries(staticData.fiscal,     "GGXCNL_NGDP"),
    GGXWDG_NGDP: generateStaticSeries(staticData.debt,       "GGXWDG_NGDP"),
    BCA_NGDPD:   generateStaticSeries(staticData.ca,         "BCA_NGDPD"),
    NGDPDPC:     generateStaticSeries(staticData.gdp_pc,     "NGDPDPC"),
    LUR:         generateStaticSeries(staticData.unemployment,"LUR"),
  } : {};

  // Utiliser les vraies données API ou le fallback statique
  const effectiveMacro = macro ?? (staticData ? {
    country_id: countryId,
    country_name: staticData.name,
    indicators: fallbackIndicators,
  } : null);
  const isUsingFallback = !macro && !!staticData;

  const getLatestAndTrend = (code: string) => {
    const pts = effectiveMacro?.indicators?.[code] ?? [];
    if (pts.length === 0) return { latest: null, trend: null };
    const sorted = [...pts].sort((a: { period: string }, b: { period: string }) => b.period.localeCompare(a.period));
    const latest = sorted[0].value;
    const prev = sorted[1]?.value ?? null;
    return { latest, trend: prev != null ? latest - prev : null };
  };

  const gdp  = getLatestAndTrend("NGDP_RPCH");
  const inf  = getLatestAndTrend("PCPIPCH");
  const fis  = getLatestAndTrend("GGXCNL_NGDP");
  const dbt  = getLatestAndTrend("GGXWDG_NGDP");
  const ca   = getLatestAndTrend("BCA_NGDPD");
  const res  = { latest: staticData ? 3.5 : null, trend: null }; // réserves non disponibles en statique
  const gdppc = getLatestAndTrend("NGDPDPC");

  const scoreItems  = buildScorecard(gdp.latest, inf.latest, dbt.latest, fis.latest, ca.latest, res.latest);
  const grade       = compositeGrade(scoreItems);
  const narrative   = (!isLoading || isUsingFallback)
    ? generateNarrative(effectiveMacro?.country_name ?? countryId, gdp.latest, inf.latest, dbt.latest, fis.latest, ca.latest, res.latest)
    : null;

  const tier = meta ? TIER_LABEL[meta.coverage_tier as number] : null;
  const displayFlag = meta?.flag_emoji ?? staticData?.flag ?? "🌍";
  const displayName = effectiveMacro?.country_name ?? staticData?.name ?? countryId;

  const handleExport = async (): Promise<ExportRow[]> => {
    const rows: ExportRow[] = [];
    Object.entries(effectiveMacro?.indicators ?? {}).forEach(([code, pts]) => {
      (pts as { period: string; value: number }[]).forEach((p) => {
        rows.push({ country: countryId, indicator: code, period: p.period, value: p.value });
      });
    });
    return rows;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/countries")}
            className="flex items-center gap-2 text-sm mb-4 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={14} />
            Retour aux pays
          </button>
          <div className="flex items-center gap-2 mb-4">
            {isUsingFallback && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ background: "color-mix(in srgb, var(--mansa-green) 10%, transparent)", color: "var(--mansa-green-dark)", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)" }}>
                Données statiques 2025e
              </span>
            )}
            <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
              <Download size={12} /> Exporter
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {ISO3_TO_ISO2[countryId] ? (
            <Image
              src={`https://flagcdn.com/w160/${ISO3_TO_ISO2[countryId]}.png`}
              alt={displayName}
              width={60}
              height={40}
              unoptimized
              className="rounded shadow-sm object-cover"
            />
          ) : (
            <span className="text-5xl">{displayFlag}</span>
          )}
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </h1>
            {meta?.name_fr && meta.name_fr !== displayName && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{meta.name_fr}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {meta?.region && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {REGION_LABELS[meta.region] ?? meta.region}
                </span>
              )}
              {meta?.currency_code && (
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{meta.currency_code}</span>
              )}
              {tier && (
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${tier.color}`}>
                  {tier.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading && !isUsingFallback ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="mansa-card rounded-xl p-4 h-24 skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="Croissance PIB"   value={gdp.latest}   unit="%"     trend={gdp.trend}  />
          <KPICard label="Inflation"         value={inf.latest}   unit="%"     trend={inf.trend}  />
          <KPICard label="Solde budgétaire"  value={fis.latest}   unit="% PIB" trend={fis.trend}  />
          <KPICard label="Dette publique"    value={dbt.latest}   unit="% PIB" trend={dbt.trend}  />
        </div>
      )}

      {/* Profil géographique & institutionnel */}
      {profile && (
        <div className="mansa-card rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Profil institutionnel
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Capitale</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{profile.capital}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Superficie</p>
              <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                {profile.area_km2.toLocaleString("fr-FR")} km²
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Population</p>
              <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                {profile.population_m >= 1 ? `${profile.population_m.toFixed(0)} M` : `${(profile.population_m * 1000).toFixed(0)} K`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Monnaie</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {profile.currency} <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>({profile.currency_code})</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Indicatif / TLD</p>
              <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                {profile.phone_code} · {profile.tld}
              </p>
            </div>
            {profile.independence && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Indépendance</p>
                <p className="text-sm font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{profile.independence}</p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ borderColor: "var(--bg-border)" }}>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Langues officielles</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.languages.map((l) => (
                  <span key={l} className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: "var(--bg-border)", color: "var(--text-secondary)" }}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Principales villes</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.major_cities.slice(0, 5).map((c, i) => (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: i === 0 ? "color-mix(in srgb, var(--mansa-green) 15%, transparent)" : "var(--bg-border)",
                          color: i === 0 ? "var(--mansa-green)" : "var(--text-secondary)",
                          border: i === 0 ? "1px solid color-mix(in srgb, var(--mansa-green) 25%, transparent)" : "none",
                        }}>
                    {i === 0 ? "★ " : ""}{c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sources nationales (INSD, BCEAO, etc.) */}
      <NationalSourcesSection countryId={countryId} fallbackInflation={inf.latest ?? staticData?.inflation ?? null} />

      {/* Scorecard + Narrative */}
      {(!isLoading || isUsingFallback) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Scorecard items={scoreItems} grade={grade} />

          <div className="space-y-4">
            {/* Narrative */}
            {narrative && (
              <div className="mansa-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--mansa-green)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Synthèse macro-fiscale
                  </h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {narrative}
                </p>
              </div>
            )}

            {/* PIB par habitant + chômage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>PIB par habitant</p>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {gdppc.latest != null ? `$${gdppc.latest.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}` : "—"}
                </p>
              </div>
              <div className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Note composite</p>
                <p className="text-xl font-bold font-mono" style={{ color: grade.color }}>
                  {grade.grade} — {grade.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graphiques — tabs Historique / Prévisions */}
      <div>
        <div className="flex items-center gap-1 border-b mb-4" style={{ borderColor: "var(--bg-border)" }}>
          {([
            { id: "historique",  label: "Historique 2015–2024" },
            { id: "previsions",  label: "Prévisions" },
          ] as const).map(({ id: tid, label }) => (
            <button key={tid} onClick={() => setDataTab(tid)}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
              style={dataTab === tid
                ? { borderBottomColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                : { borderBottomColor: "transparent", color: "var(--text-muted)" }}>
              {label}
            </button>
          ))}
        </div>

        {dataTab === "historique" && (
          isLoading && !isUsingFallback ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mansa-card rounded-xl p-4 h-52 skeleton" />)}
            </div>
          ) : Object.values(effectiveMacro?.indicators ?? {}).some((pts) => (pts as []).length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(effectiveMacro?.indicators ?? {}).map(([code, pts]) =>
                (pts as { period: string; value: number }[]).length > 0 ? (
                  <IndicatorChart key={code} code={code} points={pts as { period: string; value: number }[]} />
                ) : null
              )}
            </div>
          ) : (
            <div className="mansa-card rounded-xl p-8 text-center">
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                Aucune série temporelle disponible pour ce pays.
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Les données macro-fiscales sont chargées par les pipelines Dagster (IMF WEO · World Bank WDI).
                Lancez <code className="text-[#00D4AA] bg-[#00D4AA]/10 px-1 rounded">dagster job execute -j full_historical_refresh</code> pour les charger.
              </p>
            </div>
          )
        )}

        {dataTab === "previsions" && <ForecastSection countryId={countryId} />}
      </div>

      <p className="text-xs pb-4" style={{ color: "var(--text-muted)" }}>
        Sources : FMI World Economic Outlook · Banque Mondiale WDI · MANSA Terminal
      </p>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExport}
        defaultFilename={`mansa-country-${countryId.toLowerCase()}`}
        title={`Exporter ${displayName}`}
        subtitle="Toutes les séries temporelles macro-fiscales disponibles"
      />
    </div>
  );
}
