"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Globe, TrendingUp, Filter, BarChart2, X, CheckCircle2,
  Trophy, ArrowUpDown, TrendingDown,
} from "lucide-react";
import { macroApi } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface Country {
  id: string;
  iso2: string;
  name_en: string;
  name_fr: string | null;
  region: string | null;
  currency_code: string | null;
  coverage_tier: number;
  flag_emoji: string | null;
}

const REGION_LABELS: Record<string, string> = {
  "All":            "Tous",
  "West Africa":    "Afrique de l'Ouest",
  "East Africa":    "Afrique de l'Est",
  "North Africa":   "Afrique du Nord",
  "Central Africa": "Afrique Centrale",
  "Southern Africa":"Afrique Australe",
};
const REGIONS = Object.keys(REGION_LABELS);

// ── Données macro complètes (Top 54 pays africains) ───────────────────────────
interface MacroData {
  growth: number;
  inflation: number;
  debt: number;
  fiscal: number;
  ca: number;
  gdp_usd: number;   // Mds USD
  gdp_pc: number;    // USD / hab
  fdi: number;       // Mds USD
  exports: number;   // Mds USD
}

const MACRO_DATA: Record<string, MacroData & { flag: string; name: string; region: string }> = {
  NGA: { flag:"🇳🇬", name:"Nigeria",           region:"West Africa",    growth:3.1,  inflation:32.5, debt:46,  fiscal:-4.6, ca: 0.8, gdp_usd:477,  gdp_pc:2200,  fdi:3.3,  exports:46.4  },
  ZAF: { flag:"🇿🇦", name:"Afrique du Sud",    region:"Southern Africa",growth:1.1,  inflation:4.6,  debt:75,  fiscal:-5.0, ca:-1.6, gdp_usd:381,  gdp_pc:6200,  fdi:5.2,  exports:108.2 },
  EGY: { flag:"🇪🇬", name:"Égypte",            region:"North Africa",   growth:2.7,  inflation:28.3, debt:90,  fiscal:-7.2, ca:-5.4, gdp_usd:360,  gdp_pc:3400,  fdi:4.9,  exports:45.2  },
  ETH: { flag:"🇪🇹", name:"Éthiopie",          region:"East Africa",    growth:6.8,  inflation:24.1, debt:38,  fiscal:-2.6, ca:-3.1, gdp_usd:156,  gdp_pc:1300,  fdi:3.7,  exports:3.5   },
  KEN: { flag:"🇰🇪", name:"Kenya",             region:"East Africa",    growth:5.0,  inflation:6.5,  debt:70,  fiscal:-5.5, ca:-4.0, gdp_usd:110,  gdp_pc:2100,  fdi:0.7,  exports:6.2   },
  TZA: { flag:"🇹🇿", name:"Tanzanie",          region:"East Africa",    growth:5.4,  inflation:3.1,  debt:42,  fiscal:-3.0, ca:-3.5, gdp_usd:77,   gdp_pc:1200,  fdi:1.1,  exports:5.1   },
  MAR: { flag:"🇲🇦", name:"Maroc",             region:"North Africa",   growth:3.2,  inflation:2.4,  debt:69,  fiscal:-4.1, ca:-1.2, gdp_usd:142,  gdp_pc:3700,  fdi:1.8,  exports:42.5  },
  GHA: { flag:"🇬🇭", name:"Ghana",             region:"West Africa",    growth:3.1,  inflation:22.3, debt:83,  fiscal:-4.6, ca:-2.0, gdp_usd:77,   gdp_pc:2400,  fdi:2.5,  exports:16.0  },
  CIV: { flag:"🇨🇮", name:"Côte d'Ivoire",     region:"West Africa",    growth:6.5,  inflation:3.8,  debt:57,  fiscal:-4.0, ca:-3.7, gdp_usd:78,   gdp_pc:2900,  fdi:0.8,  exports:12.8  },
  SEN: { flag:"🇸🇳", name:"Sénégal",           region:"West Africa",    growth:8.3,  inflation:2.8,  debt:73,  fiscal:-4.9, ca:-12.1,gdp_usd:32,   gdp_pc:1800,  fdi:2.3,  exports:4.8   },
  CMR: { flag:"🇨🇲", name:"Cameroun",          region:"Central Africa", growth:4.1,  inflation:7.4,  debt:48,  fiscal:-2.5, ca:-4.2, gdp_usd:47,   gdp_pc:1700,  fdi:0.8,  exports:5.2   },
  AGO: { flag:"🇦🇴", name:"Angola",            region:"Central Africa", growth:2.4,  inflation:28.2, debt:73,  fiscal:-1.0, ca: 4.5, gdp_usd:108,  gdp_pc:3100,  fdi:3.9,  exports:32.0  },
  DZA: { flag:"🇩🇿", name:"Algérie",           region:"North Africa",   growth:3.6,  inflation:9.2,  debt:60,  fiscal:-5.8, ca: 2.4, gdp_usd:239,  gdp_pc:5200,  fdi:1.0,  exports:48.5  },
  MOZ: { flag:"🇲🇿", name:"Mozambique",        region:"East Africa",    growth:5.5,  inflation:6.2,  debt:100, fiscal:-5.0, ca:-26.0,gdp_usd:18,   gdp_pc:560,   fdi:2.9,  exports:5.6   },
  ZMB: { flag:"🇿🇲", name:"Zambie",            region:"Southern Africa",growth:4.8,  inflation:13.0, debt:137, fiscal:-7.6, ca: 1.5, gdp_usd:28,   gdp_pc:1500,  fdi:0.6,  exports:9.5   },
  RWA: { flag:"🇷🇼", name:"Rwanda",            region:"East Africa",    growth:7.0,  inflation:5.8,  debt:68,  fiscal:-6.0, ca:-11.4,gdp_usd:13,   gdp_pc:900,   fdi:0.5,  exports:1.3   },
  TUN: { flag:"🇹🇳", name:"Tunisie",           region:"North Africa",   growth:1.8,  inflation:9.3,  debt:80,  fiscal:-7.7, ca:-6.2, gdp_usd:46,   gdp_pc:3700,  fdi:0.5,  exports:19.2  },
  UGA: { flag:"🇺🇬", name:"Ouganda",           region:"East Africa",    growth:6.1,  inflation:3.8,  debt:50,  fiscal:-4.4, ca:-9.2, gdp_usd:50,   gdp_pc:1100,  fdi:0.9,  exports:4.9   },
  LBY: { flag:"🇱🇾", name:"Libye",             region:"North Africa",   growth:4.0,  inflation:2.8,  debt:84,  fiscal: 4.0, ca:13.3, gdp_usd:37,   gdp_pc:5200,  fdi:0.2,  exports:19.0  },
  SUD: { flag:"🇸🇩", name:"Soudan",            region:"East Africa",    growth:0.5,  inflation:65.0, debt:183, fiscal:-3.0, ca:-5.0, gdp_usd:36,   gdp_pc:750,   fdi:0.5,  exports:3.9   },
  MLI: { flag:"🇲🇱", name:"Mali",              region:"West Africa",    growth:4.0,  inflation:2.5,  debt:50,  fiscal:-3.5, ca:-5.5, gdp_usd:22,   gdp_pc:1000,  fdi:0.4,  exports:3.2   },
  BFA: { flag:"🇧🇫", name:"Burkina Faso",      region:"West Africa",    growth:2.5,  inflation:3.0,  debt:54,  fiscal:-4.5, ca:-4.1, gdp_usd:18,   gdp_pc:840,   fdi:0.1,  exports:3.0   },
  MWI: { flag:"🇲🇼", name:"Malawi",            region:"East Africa",    growth:1.8,  inflation:25.0, debt:92,  fiscal:-7.0, ca:-9.0, gdp_usd:10,   gdp_pc:500,   fdi:0.1,  exports:0.9   },
  MDG: { flag:"🇲🇬", name:"Madagascar",        region:"East Africa",    growth:4.8,  inflation:8.0,  debt:57,  fiscal:-4.8, ca:-6.0, gdp_usd:15,   gdp_pc:520,   fdi:0.4,  exports:2.2   },
  NER: { flag:"🇳🇪", name:"Niger",             region:"West Africa",    growth:12.3, inflation:3.9,  debt:52,  fiscal:-6.8, ca:-16.0,gdp_usd:17,   gdp_pc:650,   fdi:1.0,  exports:2.4   },
  BEN: { flag:"🇧🇯", name:"Bénin",             region:"West Africa",    growth:6.4,  inflation:2.7,  debt:54,  fiscal:-4.7, ca:-4.2, gdp_usd:19,   gdp_pc:1500,  fdi:0.5,  exports:3.7   },
  TGO: { flag:"🇹🇬", name:"Togo",              region:"West Africa",    growth:6.0,  inflation:4.0,  debt:69,  fiscal:-3.8, ca:-2.9, gdp_usd:8.9,  gdp_pc:1050,  fdi:0.2,  exports:1.5   },
  GIN: { flag:"🇬🇳", name:"Guinée",            region:"West Africa",    growth:6.5,  inflation:9.6,  debt:35,  fiscal:-3.3, ca:-12.0,gdp_usd:16,   gdp_pc:1200,  fdi:1.8,  exports:3.4   },
  TCD: { flag:"🇹🇩", name:"Tchad",             region:"Central Africa", growth:3.0,  inflation:4.5,  debt:45,  fiscal:-1.0, ca:-1.5, gdp_usd:13,   gdp_pc:750,   fdi:0.3,  exports:2.5   },
  COD: { flag:"🇨🇩", name:"Congo (RDC)",       region:"Central Africa", growth:6.3,  inflation:23.6, debt:15,  fiscal:-1.0, ca:-3.7, gdp_usd:65,   gdp_pc:660,   fdi:1.8,  exports:18.3  },
  COG: { flag:"🇨🇬", name:"Congo (Brazzaville)",region:"Central Africa",growth:4.1,  inflation:4.0,  debt:89,  fiscal:-0.3, ca: 1.0, gdp_usd:13,   gdp_pc:2300,  fdi:1.3,  exports:5.4   },
  MUS: { flag:"🇲🇺", name:"Maurice",           region:"East Africa",    growth:5.6,  inflation:7.0,  debt:85,  fiscal:-4.0, ca:-5.9, gdp_usd:13,   gdp_pc:10500, fdi:0.4,  exports:2.6   },
  BWA: { flag:"🇧🇼", name:"Botswana",          region:"Southern Africa",growth:3.5,  inflation:5.5,  debt:19,  fiscal:-1.5, ca:-1.6, gdp_usd:19,   gdp_pc:7400,  fdi:0.3,  exports:7.2   },
  NAM: { flag:"🇳🇦", name:"Namibie",           region:"Southern Africa",growth:3.6,  inflation:5.8,  debt:68,  fiscal:-5.2, ca:-10.0,gdp_usd:13,   gdp_pc:4700,  fdi:0.4,  exports:5.3   },
  SWZ: { flag:"🇸🇿", name:"Eswatini",          region:"Southern Africa",growth:2.0,  inflation:5.9,  debt:52,  fiscal:-2.8, ca: 0.5, gdp_usd:4.5,  gdp_pc:3800,  fdi:0.1,  exports:1.8   },
  ZWE: { flag:"🇿🇼", name:"Zimbabwe",          region:"Southern Africa",growth:3.0,  inflation:165.0,debt:95,  fiscal:-3.0, ca:-6.0, gdp_usd:26,   gdp_pc:1700,  fdi:0.4,  exports:6.3   },
  SOM: { flag:"🇸🇴", name:"Somalie",           region:"East Africa",    growth:3.5,  inflation:3.5,  debt:80,  fiscal:-1.0, ca:-10.0,gdp_usd:10,   gdp_pc:600,   fdi:0.1,  exports:0.6   },
  ERI: { flag:"🇪🇷", name:"Érythrée",          region:"East Africa",    growth:2.5,  inflation:5.0,  debt:180, fiscal:-12.0,ca:-4.0, gdp_usd:2.7,  gdp_pc:740,   fdi:0.0,  exports:0.4   },
  DJI: { flag:"🇩🇯", name:"Djibouti",          region:"East Africa",    growth:7.1,  inflation:3.0,  debt:73,  fiscal:-1.5, ca:-6.0, gdp_usd:4.0,  gdp_pc:3800,  fdi:0.2,  exports:0.1   },
  SLE: { flag:"🇸🇱", name:"Sierra Leone",      region:"West Africa",    growth:3.5,  inflation:37.0, debt:82,  fiscal:-8.3, ca:-14.0,gdp_usd:5.0,  gdp_pc:600,   fdi:0.2,  exports:0.5   },
  LBR: { flag:"🇱🇷", name:"Liberia",           region:"West Africa",    growth:4.5,  inflation:8.0,  debt:60,  fiscal:-5.0, ca:-23.0,gdp_usd:4.3,  gdp_pc:900,   fdi:0.4,  exports:0.7   },
  GMB: { flag:"🇬🇲", name:"Gambie",            region:"West Africa",    growth:5.8,  inflation:15.0, debt:80,  fiscal:-3.9, ca:-5.0, gdp_usd:2.3,  gdp_pc:900,   fdi:0.1,  exports:0.2   },
  GNB: { flag:"🇬🇼", name:"Guinée-Bissau",     region:"West Africa",    growth:4.2,  inflation:5.0,  debt:78,  fiscal:-3.5, ca:-5.0, gdp_usd:1.9,  gdp_pc:900,   fdi:0.0,  exports:0.2   },
  CPV: { flag:"🇨🇻", name:"Cap-Vert",          region:"West Africa",    growth:4.5,  inflation:7.5,  debt:140, fiscal:-2.8, ca:-5.0, gdp_usd:2.2,  gdp_pc:3700,  fdi:0.2,  exports:0.1   },
  GNQ: { flag:"🇬🇶", name:"Guinée équatoriale",region:"Central Africa", growth:-2.0, inflation:5.0,  debt:47,  fiscal:-6.5, ca:-4.0, gdp_usd:12,   gdp_pc:8400,  fdi:0.2,  exports:4.8   },
  GAB: { flag:"🇬🇦", name:"Gabon",             region:"Central Africa", growth:2.5,  inflation:4.8,  debt:75,  fiscal:-1.8, ca: 2.5, gdp_usd:20,   gdp_pc:8600,  fdi:1.5,  exports:6.2   },
  CAF: { flag:"🇨🇫", name:"Centrafrique",      region:"Central Africa", growth:1.5,  inflation:5.3,  debt:60,  fiscal:-5.0, ca:-12.0,gdp_usd:2.9,  gdp_pc:550,   fdi:0.0,  exports:0.2   },
  BDI: { flag:"🇧🇮", name:"Burundi",           region:"East Africa",    growth:2.2,  inflation:22.0, debt:70,  fiscal:-5.0, ca:-13.0,gdp_usd:2.9,  gdp_pc:230,   fdi:0.0,  exports:0.2   },
  COM: { flag:"🇰🇲", name:"Comores",           region:"East Africa",    growth:3.1,  inflation:5.0,  debt:37,  fiscal:-2.5, ca:-3.0, gdp_usd:1.4,  gdp_pc:1500,  fdi:0.0,  exports:0.1   },
  STP: { flag:"🇸🇹", name:"São Tomé-et-Príncipe",region:"Central Africa",growth:2.5, inflation:17.0, debt:104, fiscal:-3.0, ca:-17.0,gdp_usd:0.7,  gdp_pc:3200,  fdi:0.0,  exports:0.0   },
  SYC: { flag:"🇸🇨", name:"Seychelles",        region:"East Africa",    growth:5.0,  inflation:4.5,  debt:65,  fiscal:-1.5, ca:-10.0,gdp_usd:2.1,  gdp_pc:15800, fdi:0.2,  exports:0.7   },
  LSO: { flag:"🇱🇸", name:"Lesotho",           region:"Southern Africa",growth:1.8,  inflation:7.0,  debt:65,  fiscal:-5.5, ca: 3.0, gdp_usd:2.5,  gdp_pc:1200,  fdi:0.1,  exports:0.8   },
  MRT: { flag:"🇲🇷", name:"Mauritanie",        region:"West Africa",    growth:3.9,  inflation:6.3,  debt:60,  fiscal:-1.0, ca:-7.0, gdp_usd:10,   gdp_pc:2100,  fdi:0.5,  exports:2.8   },
};

const COMPARE_COLORS = ["#00D4AA","#3B82F6","#F59E0B","#A78BFA","#F87171","#34D399","#FB923C","#60A5FA"];
const COMPARE_INDICATORS = [
  { code: "growth",    label: "Croissance PIB (%)" },
  { code: "inflation", label: "Inflation (%)" },
  { code: "debt",      label: "Dette publique (% PIB)" },
  { code: "fiscal",    label: "Solde budgétaire (% PIB)" },
  { code: "ca",        label: "Compte courant (% PIB)" },
  { code: "gdp_usd",   label: "PIB nominal (Mds USD)" },
  { code: "fdi",       label: "IDE entrants (Mds USD)" },
];

// ── Chantier 7 : Données rankings ────────────────────────────────────────────
type RankingKey = "gdp_usd" | "gdp_pc" | "growth" | "inflation" | "debt" | "exports" | "fdi";

const RANKING_TABS: { key: RankingKey; label: string; unit: string; desc: string; dir: "asc" | "desc" }[] = [
  { key: "gdp_usd",   label: "PIB nominal",      unit: "Mds USD",  desc: "Classement des économies africaines par taille du PIB nominal (USD courants, 2025e)",       dir: "desc" },
  { key: "gdp_pc",    label: "PIB / habitant",    unit: "USD/hab",  desc: "PIB nominal divisé par la population — indicateur du niveau de vie moyen",                  dir: "desc" },
  { key: "growth",    label: "Croissance",        unit: "%",        desc: "Croissance du PIB réel 2024 — économies les plus dynamiques en tête",                       dir: "desc" },
  { key: "inflation", label: "Inflation",         unit: "%",        desc: "Taux d'inflation IPC 2024 — classement du plus stable au plus élevé",                       dir: "asc"  },
  { key: "debt",      label: "Dette publique",    unit: "% PIB",    desc: "Dette brute des administrations publiques en % du PIB — risque de surendettement",          dir: "asc"  },
  { key: "exports",   label: "Exportations",      unit: "Mds USD",  desc: "Valeur totale des exportations de biens et services — intégration dans le commerce mondial",dir: "desc" },
  { key: "fdi",       label: "IDE entrants",      unit: "Mds USD",  desc: "Investissements Directs Étrangers reçus — attractivité pour les capitaux étrangers",         dir: "desc" },
];

// ── Composant Comparateur ─────────────────────────────────────────────────────
function ComparePanel({ picked, countries, onRemove }: {
  picked: string[];
  countries: Country[];
  onRemove: (id: string) => void;
}) {
  const [indicator, setIndicator] = useState("growth");
  const indMeta = COMPARE_INDICATORS.find((i) => i.code === indicator)!;

  const rows = picked.map((id, idx) => {
    const c  = countries.find((x) => x.id === id);
    const md = MACRO_DATA[id];
    const v  = md ? md[indicator as keyof MacroData] as number : undefined;
    return { id, name: md?.name ?? c?.name_fr ?? c?.name_en ?? id, flag: md?.flag ?? c?.flag_emoji ?? "🌍", color: COMPARE_COLORS[idx % COMPARE_COLORS.length], value: v };
  });

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.value ?? 0)), 0.1);

  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Comparateur pays — {picked.length} pays sélectionnés
          </h3>
        </div>
        <select
          value={indicator}
          onChange={(e) => setIndicator(e.target.value)}
          className="text-xs rounded-lg px-2 py-1 border focus:outline-none"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
        >
          {COMPARE_INDICATORS.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
        </select>
      </div>
      <div className="space-y-2.5">
        {rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((row) => {
          const pct   = maxAbs > 0 ? Math.abs(row.value ?? 0) / maxAbs * 100 : 0;
          const isNeg = (row.value ?? 0) < 0;
          return (
            <div key={row.id} className="flex items-center gap-3">
              <span className="text-base">{row.flag}</span>
              <span className="text-xs w-28 truncate" style={{ color: "var(--text-secondary)" }}>{row.name}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative h-5 rounded" style={{ background: "var(--bg-border)" }}>
                  <div
                    className="absolute top-0 h-full rounded transition-all"
                    style={{ width: `${pct}%`, background: isNeg ? "#EF4444" : row.color }}
                  />
                </div>
                <span className="text-xs font-bold font-mono w-16 text-right"
                      style={{ color: isNeg ? "#EF4444" : row.color }}>
                  {row.value != null ? (row.value > 0 ? "+" : "") + row.value.toFixed(1) : "—"}
                </span>
              </div>
              <button onClick={() => onRemove(row.id)} style={{ color: "var(--text-muted)" }}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        {indMeta.label} · Données 2025e · FMI WEO
      </p>
    </div>
  );
}

// ── Composant Rankings ───────────────────────────────────────────────────────
function RankingsPanel() {
  const [activeTab, setActiveTab] = useState<RankingKey>("gdp_usd");
  const tab = RANKING_TABS.find((t) => t.key === activeTab)!;

  const ranked = useMemo(() => {
    const entries = Object.entries(MACRO_DATA).map(([id, d]) => ({
      id,
      flag:  d.flag,
      name:  d.name,
      region:d.region,
      value: d[activeTab] as number,
    }));
    return entries.sort((a, b) => tab.dir === "desc" ? b.value - a.value : a.value - b.value);
  }, [activeTab, tab.dir]);

  const medalColor = (i: number) => i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "var(--text-muted)";

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {RANKING_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border"
            style={
              activeTab === t.key
                ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", borderColor: "color-mix(in srgb, var(--mansa-green) 40%, transparent)", color: "var(--mansa-green)" }
                : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }
            }
          >
            {t.dir === "desc" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="rounded-xl px-4 py-2.5 text-xs border flex items-center gap-2"
           style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
        <Trophy size={12} style={{ color: "var(--mansa-green)" }} />
        {tab.desc} · {tab.dir === "desc" ? "Du plus élevé au plus bas" : "Du plus bas au plus élevé"} · Données 2025e · FMI WEO
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-4">
        {ranked.slice(0, 3).map((c, i) => (
          <div
            key={c.id}
            className="rounded-2xl p-4 text-center border"
            style={{
              background: "var(--card-bg)",
              borderColor: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32",
              boxShadow: i === 0 ? "0 0 20px rgba(255,215,0,0.1)" : "none",
            }}
          >
            <p className="text-xs font-bold mb-1" style={{ color: medalColor(i) }}>
              #{i + 1} {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
            </p>
            <p className="text-3xl mb-1">{c.flag}</p>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{c.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.region}</p>
            <p className="text-xl font-bold font-mono mt-2" style={{ color: medalColor(i) }}>
              {c.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tab.unit}</p>
          </div>
        ))}
      </div>

      {/* Table complète */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)" }}>
        <div
          className="grid grid-cols-[50px_1fr_1fr_120px] gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b"
          style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)", borderColor: "var(--bg-border)" }}
        >
          <span>#</span>
          <span>Pays</span>
          <span>Région</span>
          <span className="text-right flex items-center justify-end gap-1">
            <ArrowUpDown size={10} /> {tab.unit}
          </span>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--bg-border)" }}>
          {ranked.map((c, i) => (
            <Link
              key={c.id}
              href={`/countries/${c.id}`}
              className="grid grid-cols-[50px_1fr_1fr_120px] gap-4 px-4 py-3 items-center text-sm transition-colors"
              style={{ borderColor: "var(--bg-border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span className="text-xs font-bold font-mono" style={{ color: i < 3 ? medalColor(i) : "var(--text-muted)" }}>
                {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i + 1}`}
              </span>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl flex-shrink-0">{c.flag}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{c.id}</p>
                </div>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.region}</span>
              <div className="text-right">
                <span
                  className="text-sm font-bold font-mono"
                  style={{
                    color: tab.key === "inflation" && c.value > 20 ? "#EF4444"
                         : tab.key === "debt" && c.value > 90      ? "#EF4444"
                         : tab.key === "growth" && c.value >= 5    ? "#10B981"
                         : "var(--text-primary)",
                  }}
                >
                  {c.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                </span>
                <span className="text-[10px] ml-1" style={{ color: "var(--text-muted)" }}>{tab.unit}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {ranked.length} économies africaines · Sources : FMI World Economic Outlook 2024 · Banque Mondiale WDI · MANSA Terminal
      </p>
    </div>
  );
}

// ── Carte pays ───────────────────────────────────────────────────────────────
function CountryCard({ country, compareMode, isPicked, onToggle }: {
  country: Country;
  compareMode?: boolean;
  isPicked?: boolean;
  onToggle?: () => void;
}) {
  const macro = MACRO_DATA[country.id];

  if (compareMode) {
    return (
      <button
        onClick={onToggle}
        className="mansa-card rounded-xl p-4 text-left transition-all w-full"
        style={{
          borderColor: isPicked ? "var(--mansa-green)" : undefined,
          background:  isPicked ? "color-mix(in srgb, var(--mansa-green) 6%, var(--card-bg))" : undefined,
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-2xl">{macro?.flag ?? country.flag_emoji ?? "🌍"}</span>
          {isPicked && <CheckCircle2 size={14} className="text-emerald-400" />}
        </div>
        <div className="font-semibold text-sm leading-tight mb-1" style={{ color: isPicked ? "var(--mansa-green)" : "var(--text-primary)" }}>
          {macro?.name ?? country.name_fr ?? country.name_en}
        </div>
        {macro && (
          <div className="text-xs font-mono mt-2" style={{ color: "var(--text-muted)" }}>
            PIB: <span style={{ color: macro.growth >= 4 ? "#10B981" : macro.growth >= 2 ? "#F59E0B" : "#EF4444" }}>
              +{macro.growth.toFixed(1)}%
            </span>
          </div>
        )}
      </button>
    );
  }

  const growthColor = macro
    ? macro.growth >= 5 ? "#10B981" : macro.growth >= 2.5 ? "#F59E0B" : "#EF4444"
    : "var(--text-muted)";

  return (
    <Link href={`/countries/${country.id}`} className="mansa-card rounded-xl p-4 mansa-card-hover cursor-pointer block">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{macro?.flag ?? country.flag_emoji ?? "🌍"}</span>
        {macro && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono"
                style={{ color: growthColor, background: `${growthColor}18` }}>
            {macro.growth >= 0 ? "+" : ""}{macro.growth.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="font-semibold text-sm leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
        {macro?.name ?? country.name_fr ?? country.name_en}
      </div>
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{country.id}</span>
        {macro && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            ${macro.gdp_usd >= 10 ? `${macro.gdp_usd.toFixed(0)}Mds` : `${macro.gdp_usd.toFixed(1)}Mds`}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Pays statiques fallback (54 pays africains depuis MACRO_DATA) ─────────────
const STATIC_COUNTRIES: Country[] = Object.entries(MACRO_DATA).map(([id, d]) => ({
  id,
  iso2: id.slice(0, 2),
  name_en: d.name,
  name_fr: d.name,
  region: d.region,
  currency_code: null,
  coverage_tier: 2,
  flag_emoji: d.flag,
}));

// ── Page principale ──────────────────────────────────────────────────────────
export default function CountriesPage() {
  const [view,           setView]           = useState<"grid" | "rankings">("grid");
  const [search,         setSearch]         = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [compareMode,    setCompareMode]    = useState(false);
  const [picked,         setPicked]         = useState<string[]>(["NGA","ZAF","EGY","KEN"]);

  const { data: apiCountries = [], isLoading } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn:  () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // Fallback vers les données statiques si l'API ne répond pas
  const countries = useMemo(() =>
    apiCountries.length > 0 ? apiCountries : STATIC_COUNTRIES,
  [apiCountries]);

  const filtered = useMemo(() =>
    countries.filter((c) => {
      const matchSearch = !search ||
        c.name_en.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        (c.name_fr ?? "").toLowerCase().includes(search.toLowerCase());
      const matchRegion = selectedRegion === "All" || c.region === selectedRegion;
      return matchSearch && matchRegion;
    }), [countries, search, selectedRegion]
  );

  const byRegion = useMemo(() => {
    if (selectedRegion !== "All") return { [selectedRegion]: filtered };
    return filtered.reduce<Record<string, Country[]>>((acc, c) => {
      const r = c.region ?? "Other";
      if (!acc[r]) acc[r] = [];
      acc[r].push(c);
      return acc;
    }, {});
  }, [filtered, selectedRegion]);

  const togglePick = (id: string) => {
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <Globe size={22} style={{ color: "var(--mansa-green)" }} />
            Analyse pays · Afrique
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {Object.keys(MACRO_DATA).length} économies · FMI WEO · Banque Mondiale · Données 2025e
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Vue toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--bg-border)" }}>
            {(["grid", "rankings"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={view === v
                  ? { background: "var(--mansa-green)", color: "#000" }
                  : { background: "var(--input-bg)", color: "var(--text-muted)" }
                }
              >
                {v === "grid" ? "🗺️ Grille" : "🏆 Classements"}
              </button>
            ))}
          </div>

          {view === "grid" && (
            <button
              onClick={() => setCompareMode((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-all"
              style={
                compareMode
                  ? { background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                  : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
              }
            >
              <BarChart2 size={13} />
              Comparateur
              {compareMode && picked.length > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: "var(--mansa-green)" }}>{picked.length}</span>
              )}
            </button>
          )}

          {view === "grid" && (
            <div className="mansa-card rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5">
              <span style={{ color: "var(--mansa-green)" }} className="font-semibold">{countries.length}</span>
              <span style={{ color: "var(--text-muted)" }}>économies couvertes</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Vue Classements ── */}
      {view === "rankings" && <RankingsPanel />}

      {/* ── Vue Grille ── */}
      {view === "grid" && (
        <>
          {/* Comparateur */}
          {compareMode && (
            <div className="space-y-3">
              <ComparePanel picked={picked} countries={countries} onRemove={(id) => togglePick(id)} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Cliquez sur un pays ci-dessous pour l&apos;ajouter · {picked.length} pays sélectionnés
              </p>
            </div>
          )}

          {/* Filtres */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 max-w-sm border"
                 style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <Search size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="bg-transparent text-sm focus:outline-none w-full"
                style={{ color: "var(--text-secondary)" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} style={{ color: "var(--text-muted)" }} />
              <div className="flex gap-1.5 flex-wrap">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRegion(r)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                    style={selectedRegion === r
                      ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", color: "var(--mansa-green)", borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)" }
                      : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
                    }
                  >
                    {r === "All" ? "Tous" : REGION_LABELS[r]?.split(" ")[0] ?? r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Liste pays */}
          {isLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="mansa-card rounded-xl p-4 h-28 skeleton" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
              Aucun pays trouvé pour &quot;{search}&quot;
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(byRegion)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([region, regionCountries]) => (
                  <div key={region}>
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {REGION_LABELS[region] ?? region}
                      </h2>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>({regionCountries.length})</span>
                      <div className="flex-1 h-px" style={{ background: "var(--bg-border)" }} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {regionCountries.map((country) => (
                        <CountryCard
                          key={country.id}
                          country={country}
                          compareMode={compareMode}
                          isPicked={picked.includes(country.id)}
                          onToggle={() => togglePick(country.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
