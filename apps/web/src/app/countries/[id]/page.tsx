"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Download, Shield } from "lucide-react";
import { macroApi } from "@/lib/api";
import { ErrorCard } from "@/components/common/ErrorCard";
import { CATALOG_BY_ID } from "@/lib/indicator-catalog";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";
import { useState } from "react";

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
function Scorecard({ items, grade }: { items: ScoreItem[]; grade: ReturnType<typeof compositeGrade> }) {
  const STATUS_CONFIG: Record<ScoreStatus, { bg: string; text: string; label: string }> = {
    ok:   { bg: "rgba(16,185,129,0.12)",  text: "#10B981", label: "✓ OK"   },
    warn: { bg: "rgba(245,158,11,0.12)",  text: "#F59E0B", label: "⚠ Vigilance" },
    bad:  { bg: "rgba(239,68,68,0.12)",   text: "#EF4444", label: "✗ Risque" },
  };
  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={15} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Scorecard macro — Note composite
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-4xl font-bold leading-none" style={{ color: grade.color }}>{grade.grade}</p>
            <p className="text-xs mt-1" style={{ color: grade.color }}>{grade.label}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          return (
            <div key={item.label} className="flex items-center gap-3 py-2 border-b last:border-0"
                 style={{ borderColor: "var(--bg-border)" }}>
              <span className="text-sm flex-1" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
              <span className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>{item.value}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium w-28 text-center"
                    style={{ background: cfg.bg, color: cfg.text }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
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

/* ── Page principale ─────────────────────────────────── */
export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const countryId = id.toUpperCase();
  const [exportOpen, setExportOpen] = useState(false);

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

  const meta = countries?.find((c: { id: string }) => c.id === countryId);

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
          <span className="text-5xl">{displayFlag}</span>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </h1>
            {meta?.name_fr && meta.name_fr !== displayName && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{meta.name_fr}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                {countryId}
              </span>
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

      {/* Graphiques */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Séries temporelles 2015–2024
        </h2>
        {isLoading && !isUsingFallback ? (
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
        )}
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
