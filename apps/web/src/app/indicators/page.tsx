"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Search, Filter, TrendingUp, TrendingDown, Download,
  Globe2, Activity, Minus, RefreshCw, ChevronDown,
} from "lucide-react";
import { macroApi, forecastApi, type ForecastResult } from "@/lib/api";
import ForecastChart from "@/components/ForecastChart";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import { ExportModal } from "@/components/common/ExportModal";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import BulkExportModal from "@/components/BulkExportModal";
import type { ExportRow } from "@/lib/export-utils";

/* ── Catalogue complet des indicateurs macro (FMI WEO + Banque Mondiale) ── */
const INDICATORS = [
  // ── Secteur réel ──────────────────────────────────────────────────────────
  { code: "NGDP_RPCH",    cat: "Secteur réel",   label: "Croissance PIB réel",       unit: "%",      description: "Variation annuelle du PIB en volume (prix constants). Source : FMI WEO." },
  { code: "NGDPD",        cat: "Secteur réel",   label: "PIB nominal",               unit: "Mds USD",description: "PIB courant en milliards de dollars américains. Source : FMI WEO." },
  { code: "PPPGDP",       cat: "Secteur réel",   label: "PIB en PPA",                unit: "Mds USD",description: "PIB à parité de pouvoir d'achat. Source : FMI WEO." },
  { code: "NGDPDPC",      cat: "Secteur réel",   label: "PIB par habitant",          unit: "USD",    description: "PIB nominal par habitant en dollars courants. Source : FMI WEO." },
  { code: "PPPPC",        cat: "Secteur réel",   label: "PIB/hab. PPA",              unit: "USD",    description: "PIB par habitant à parité de pouvoir d'achat. Source : FMI WEO." },
  { code: "LP",           cat: "Secteur réel",   label: "Population",                unit: "M hab.", description: "Population totale en millions d'habitants. Source : FMI WEO." },
  { code: "LUR",          cat: "Secteur réel",   label: "Taux de chômage",           unit: "%",      description: "Part de la population active sans emploi. Source : FMI WEO / ILO." },
  { code: "LE",           cat: "Secteur réel",   label: "Emploi total",              unit: "M pers.",description: "Nombre total de personnes occupées en millions. Source : FMI WEO." },
  // ── Fiscal ────────────────────────────────────────────────────────────────
  { code: "GGR_NGDP",     cat: "Fiscal",         label: "Recettes publiques",        unit: "% PIB",  description: "Recettes totales des administrations publiques en % du PIB. Source : FMI WEO." },
  { code: "GGX_NGDP",     cat: "Fiscal",         label: "Dépenses publiques",        unit: "% PIB",  description: "Dépenses totales des administrations publiques en % du PIB. Source : FMI WEO." },
  { code: "GGXCNL_NGDP",  cat: "Fiscal",         label: "Solde budgétaire",          unit: "% PIB",  description: "Solde global des administrations publiques (FMI). Source : FMI WEO." },
  { code: "GGXONLB_NGDP", cat: "Fiscal",         label: "Solde primaire",            unit: "% PIB",  description: "Solde budgétaire hors service de la dette. Source : FMI WEO." },
  { code: "GGXWDG_NGDP",  cat: "Fiscal",         label: "Dette publique brute",      unit: "% PIB",  description: "Dette brute des administrations publiques (périmètre FMI). Source : FMI WEO." },
  { code: "GGXWDN_NGDP",  cat: "Fiscal",         label: "Dette publique nette",      unit: "% PIB",  description: "Dette nette des administrations publiques. Source : FMI WEO." },
  { code: "DS_REV",        cat: "Fiscal",         label: "Service dette/recettes",    unit: "%",      description: "Service de la dette en % des recettes fiscales. Source : FMI WEO." },
  { code: "GGSB_NPGDP",   cat: "Fiscal",         label: "Solde structurel",          unit: "% PIB pot.",description: "Solde budgétaire ajusté du cycle. Source : FMI WEO." },
  // ── Monétaire & inflation ─────────────────────────────────────────────────
  { code: "PCPIPCH",       cat: "Monétaire",      label: "Inflation IPC",             unit: "%",      description: "Variation annuelle de l'indice des prix à la consommation. Source : FMI WEO." },
  { code: "PCPIE",         cat: "Monétaire",      label: "Inflation core",            unit: "%",      description: "Inflation hors alimentation et énergie. Source : FMI WEO." },
  { code: "PCPIEPCH",      cat: "Monétaire",      label: "Inflation fin de période",  unit: "%",      description: "Inflation IPC en fin de période (décembre/décembre). Source : FMI WEO." },
  { code: "FM_LIPY",       cat: "Monétaire",      label: "Masse monétaire M2",        unit: "% cro.", description: "Taux de croissance de la masse monétaire M2. Source : FMI WEO." },
  { code: "FPOLM_FFRATE",  cat: "Monétaire",      label: "Taux directeur",            unit: "%",      description: "Taux directeur de la banque centrale. Source : FMI WEO." },
  { code: "FPOLM_FCSCPI",  cat: "Monétaire",      label: "Taux de crédit privé",      unit: "%",      description: "Taux d'intérêt sur les prêts au secteur privé. Source : FMI WEO." },
  // ── Secteur externe ───────────────────────────────────────────────────────
  { code: "BCA_NGDPD",     cat: "Externe",        label: "Compte courant",            unit: "% PIB",  description: "Solde du compte courant de la balance des paiements. Source : FMI BOP." },
  { code: "BCA",           cat: "Externe",        label: "Compte courant (Mds USD)",  unit: "Mds USD",description: "Solde du compte courant en milliards de dollars. Source : FMI BOP." },
  { code: "BX_KLT_DINV_WD_GD_ZS", cat: "Externe", label: "IDE entrants",             unit: "% PIB",  description: "Investissements directs étrangers nets reçus en % du PIB. Source : Banque Mondiale WDI." },
  { code: "RI_IMP_M",      cat: "Externe",        label: "Réserves (mois imports)",   unit: "mois",   description: "Réserves de change en mois d'importations. Source : FMI WEO." },
  { code: "EXTD_TOTAL_GDP",cat: "Externe",        label: "Dette extérieure",          unit: "% PIB",  description: "Dette extérieure totale (publique + privée) en % du PIB. Source : Banque Mondiale WDI." },
  { code: "REM_GDP",       cat: "Externe",        label: "Envois de fonds",           unit: "% PIB",  description: "Transferts des migrants en % du PIB. Source : Banque Mondiale WDI." },
  { code: "TX_VAL_MRCH_XD_WD",cat: "Externe",    label: "Export merchandise",        unit: "Mds USD",description: "Exportations de marchandises en dollars. Source : Banque Mondiale WDI." },
  { code: "TM_VAL_MRCH_XD_WD",cat: "Externe",    label: "Import merchandise",        unit: "Mds USD",description: "Importations de marchandises en dollars. Source : Banque Mondiale WDI." },
  // ── Social & développement ────────────────────────────────────────────────
  { code: "SP_DYN_LE00_IN",cat: "Social",         label: "Espérance de vie",          unit: "ans",    description: "Espérance de vie à la naissance. Source : Banque Mondiale WDI." },
  { code: "SP_POP_TOTL",   cat: "Social",         label: "Population totale",         unit: "M hab.", description: "Population totale. Source : Banque Mondiale WDI." },
  { code: "SE_ADT_LITR_ZS",cat: "Social",         label: "Taux d'alphabétisation",    unit: "%",      description: "Taux d'alphabétisation des adultes. Source : UNESCO/Banque Mondiale WDI." },
  { code: "EG_ELC_ACCS_ZS",cat: "Social",         label: "Accès à l'électricité",     unit: "%",      description: "Part de la population ayant accès à l'électricité. Source : Banque Mondiale WDI." },
  { code: "IT_NET_USER_ZS", cat: "Social",         label: "Utilisateurs Internet",     unit: "%",      description: "Part de la population utilisant Internet. Source : Banque Mondiale WDI." },
  { code: "SH_DYN_MORT",   cat: "Social",         label: "Mortalité infantile",       unit: "/1000",  description: "Mortalité des moins de 5 ans pour 1000 naissances vivantes. Source : Banque Mondiale WDI." },
  // ── Énergie & Climat ──────────────────────────────────────────────────────
  { code: "EG_USE_PCAP_KG_OE",cat: "Énergie",     label: "Conso. énergie/hab.",       unit: "kg éq. pétrole",description: "Consommation d'énergie par habitant. Source : Banque Mondiale WDI." },
  { code: "EN_ATM_CO2E_PC", cat: "Énergie",       label: "Émissions CO₂/hab.",        unit: "t CO₂",  description: "Émissions de CO₂ par habitant. Source : Banque Mondiale WDI." },
  { code: "EG_FEC_RNEW_ZS", cat: "Énergie",       label: "Énergie renouvelable",      unit: "% conso.",description: "Part des renouvelables dans la consommation finale d'énergie. Source : Banque Mondiale WDI." },
];

const REGIONS: { value: string; label: string }[] = [
  { value: "Toutes",         label: "Toutes les régions"   },
  { value: "West Africa",    label: "Afrique de l'Ouest"   },
  { value: "East Africa",    label: "Afrique de l'Est"     },
  { value: "North Africa",   label: "Afrique du Nord"      },
  { value: "Central Africa", label: "Afrique Centrale"     },
  { value: "Southern Africa",label: "Afrique Australe"     },
];

/* ── Données macro 54 pays africains (fallback quand API indisponible) ── */
const STATIC_54: Record<string, { flag:string; name:string; region:string; growth:number; inflation:number; fiscal:number; debt:number; ca:number; gdp_pc:number; unemployment:number }> = {
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

/* ── Séries de démo (fallback quand l'API ne répond pas) — 54 pays ── */
const DEMO_SERIES: Record<string, Record<string, number>> = {
  NGDP_RPCH:    Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.growth])),
  PCPIPCH:      Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.inflation])),
  GGXCNL_NGDP:  Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.fiscal])),
  GGXWDG_NGDP:  Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.debt])),
  BCA_NGDPD:    Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.ca])),
  NGDPDPC:      Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.gdp_pc])),
  LUR:          Object.fromEntries(Object.entries(STATIC_54).map(([k, v]) => [k, v.unemployment])),
};

/** Génère une série temporelle simulée 2010–2024 à partir de la valeur 2024 */
function generateDemoTimeSeries(code: string, countryId: string): Array<{ period: string; value: number; unit: string; source: string }> {
  const val2024 = DEMO_SERIES[code]?.[countryId];
  if (val2024 == null) return [];
  const years = Array.from({ length: 15 }, (_, i) => 2010 + i);
  return years.map((y) => {
    // Légère variation pseudo-aléatoire déterministe basée sur l'année
    const noise = Math.sin(y * 7 + countryId.charCodeAt(0)) * (Math.abs(val2024) * 0.15);
    const trending = (val2024 / 15) * (y - 2010); // drift linéaire léger
    const value = y === 2024 ? val2024 : Math.round((val2024 - trending + noise) * 100) / 100;
    return { period: String(y), value, unit: INDICATORS.find((i) => i.code === code)?.unit ?? "%", source: "FMI WEO (démo)" };
  });
}

interface CountrySummary {
  id: string;
  iso2: string;
  name_en: string;
  name_fr: string | null;
  region: string | null;
  flag_emoji: string | null;
  coverage_tier: number;
}

interface IndicatorPoint {
  period: string;
  value: number;
  unit: string | null;
  source: string;
}

interface CountryMacro {
  country_id: string;
  country_name: string;
  indicators: Record<string, IndicatorPoint[]>;
}

/* ── Tooltip Recharts custom ── */
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="rounded-xl border px-3 py-2 text-sm shadow-xl"
         style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}>
      <p className="font-semibold">{label}</p>
      <p style={{ color: "var(--mansa-green)" }}>{v?.toFixed(2)} {unit}</p>
    </div>
  );
}

/* ── KPI card résumé ── */
function KpiCard({ label, value, unit, trend }: { label: string; value: number | null; unit: string; trend?: number }) {
  const Ic = trend == null ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const color = trend == null ? "var(--text-muted)" : trend > 0 ? "#10B981" : "#EF4444";
  return (
    <div className="mansa-card rounded-xl px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value != null ? value.toFixed(1) : "—"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{unit}</span>
      </div>
      {trend != null && (
        <div className="flex items-center gap-1 mt-1 text-xs" style={{ color }}>
          <Ic size={11} />
          {trend > 0 ? "+" : ""}{trend.toFixed(1)} pts vs préc.
        </div>
      )}
    </div>
  );
}

export default function IndicatorsPage() {
  const [selectedInd,    setSelectedInd]    = useState(INDICATORS[0].code);
  const [selectedCountry,setSelectedCountry]= useState<string | null>(null);
  const [region,         setRegion]         = useState("Toutes");
  const [search,         setSearch]         = useState("");
  const [indSearch,      setIndSearch]      = useState("");
  const [indCat,         setIndCat]         = useState("Tous");
  const [chartType,      setChartType]      = useState<"line" | "bar" | "area">("area");
  const [exportOpen,     setExportOpen]     = useState(false);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [chartTab,       setChartTab]       = useState<"historique" | "previsions">("historique");
  const [fcData,         setFcData]         = useState<ForecastResult | null>(null);
  const [fcLoading,      setFcLoading]      = useState(false);
  const [fcError,        setFcError]        = useState<string | null>(null);
  const [fcHorizon,      setFcHorizon]      = useState(3);

  const IND_CATS = useMemo(() => ["Tous", ...Array.from(new Set(INDICATORS.map((i) => i.cat)))], []);

  const filteredInds = useMemo(() =>
    INDICATORS.filter((i) => {
      const q = indSearch.toLowerCase();
      const matchSearch = !indSearch || i.label.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
      const matchCat = indCat === "Tous" || i.cat === indCat;
      return matchSearch && matchCat;
    }), [indSearch, indCat]
  );

  // Indicateurs filtrés regroupés par catégorie (présentation organisée)
  const groupedInds = useMemo(() => {
    const order = Array.from(new Set(INDICATORS.map((i) => i.cat)));
    const map = new Map<string, typeof INDICATORS>();
    for (const ind of filteredInds) {
      const arr = map.get(ind.cat) ?? [];
      arr.push(ind);
      map.set(ind.cat, arr);
    }
    return order.filter((c) => map.has(c)).map((c) => ({ cat: c, items: map.get(c)! }));
  }, [filteredInds]);

  const indMeta = INDICATORS.find((i) => i.code === selectedInd)!;

  /* ── Pays disponibles ── */
  const { data: countries = [], isLoading: countriesLoading } = useQuery<CountrySummary[]>({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const filteredCountries = useMemo(() =>
    countries.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        c.name_en.toLowerCase().includes(q) ||
        (c.name_fr ?? "").toLowerCase().includes(q);
      const matchRegion = region === "Toutes" || c.region === region;
      return matchSearch && matchRegion;
    }), [countries, search, region]
  );

  // Si aucun pays API, utiliser les 54 pays statiques pour le sélecteur
  const DEMO_COUNTRIES: CountrySummary[] = Object.entries(STATIC_54).map(([id, d]) => ({
    id,
    iso2: id.slice(0, 2).toLowerCase(),
    name_en: d.name,
    name_fr: d.name,
    region: d.region,
    flag_emoji: d.flag,
    coverage_tier: 2,
  }));
  const effectiveCountries = countries.length > 0 ? filteredCountries : DEMO_COUNTRIES;

  /* ── Données du pays sélectionné ── */
  const activeCountry = selectedCountry ?? effectiveCountries[0]?.id ?? null;

  const { data: countryMacro, isLoading: macroLoading, refetch } = useQuery<CountryMacro>({
    queryKey: ["country-macro", activeCountry, selectedInd],
    queryFn: () => macroApi.getCountryMacro(activeCountry!, {
      indicators: selectedInd,
      from_year: 2010,
      to_year: 2025,
    }),
    enabled: !!activeCountry,
    staleTime: 1000 * 60 * 15,
  });

  // Utiliser les données API ou les données de démo si l'API ne répond pas
  const apiSeries: IndicatorPoint[] = countryMacro?.indicators[selectedInd] ?? [];
  const demoSeries: IndicatorPoint[] = apiSeries.length === 0 && activeCountry
    ? generateDemoTimeSeries(selectedInd, activeCountry)
    : [];
  const series: IndicatorPoint[] = apiSeries.length > 0 ? apiSeries : demoSeries;
  const isDemoData = apiSeries.length === 0 && demoSeries.length > 0;
  const chartData = series.map((p) => ({ year: p.period, value: p.value }));

  /* ── KPIs résumé ── */
  const latestValue = series.length > 0 ? series[series.length - 1].value : null;
  const prevValue   = series.length > 1 ? series[series.length - 2].value : null;
  const trend       = latestValue != null && prevValue != null ? latestValue - prevValue : undefined;
  const avgValue    = series.length > 0 ? series.reduce((s, p) => s + p.value, 0) / series.length : null;
  const maxValue    = series.length > 0 ? Math.max(...series.map((p) => p.value)) : null;
  const minValue    = series.length > 0 ? Math.min(...series.map((p) => p.value)) : null;

  const activeCountryMeta = effectiveCountries.find((c) => c.id === activeCountry);

  const handleExportData = async (): Promise<ExportRow[]> =>
    series.map((p) => ({
      country: activeCountry ?? "",
      indicator: selectedInd,
      indicator_name: indMeta.label,
      period: p.period,
      value: p.value,
      unit: p.unit ?? indMeta.unit,
      source: p.source,
    }));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <BarChart3 size={22} style={{ color: "var(--mansa-green)" }} />
            Indicateurs macroéconomiques
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {countries.length || 54} pays · {INDICATORS.length} indicateurs · FMI WEO · Banque Mondiale WDI
            </p>
            <DataSourceBadge isLive={!!countryMacro && !isDemoData} size="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border transition-colors mansa-btn-ghost">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
            <Download size={12} /> Exporter vue
          </button>
          <button
            onClick={() => setBulkExportOpen(true)}
            className="text-xs px-3 py-1.5 flex items-center gap-1.5 rounded-lg font-medium border transition-all"
            style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)", color: "var(--mansa-green)", borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)" }}
          >
            <Download size={12} /> Bulk Export
          </button>
        </div>
      </div>

      {/* ── Sélecteur indicateur : recherche + catégories + liste ── */}
      <div className="mansa-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Barre de recherche indicateur */}
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border flex-1 min-w-[200px]"
               style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
            <Search size={12} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={indSearch}
              onChange={(e) => setIndSearch(e.target.value)}
              placeholder="Rechercher un indicateur (ex: PIB, inflation…)"
              className="bg-transparent text-xs focus:outline-none w-full"
              style={{ color: "var(--text-secondary)" }}
            />
            {indSearch && (
              <button onClick={() => setIndSearch("")} className="text-xs" style={{ color: "var(--text-muted)" }}>✕</button>
            )}
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {filteredInds.length} / {INDICATORS.length} indicateurs
          </span>
        </div>

        {/* Onglets catégories */}
        <div className="flex gap-1.5 flex-wrap">
          {IND_CATS.map((cat) => (
            <button
              key={cat}
              onClick={() => setIndCat(cat)}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={indCat === cat
                ? { background: "var(--mansa-green)", borderColor: "var(--mansa-green)", color: "#000" }
                : { background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Liste indicateurs filtrée — regroupée par catégorie */}
        <div className="max-h-60 overflow-y-auto pr-1 space-y-3">
          {groupedInds.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
              Aucun indicateur ne correspond à la recherche.
            </p>
          )}
          {groupedInds.map(({ cat, items }) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1.5 sticky top-0 z-10 py-0.5"
                   style={{ background: "var(--card-bg)" }}>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>{cat}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>{items.length}</span>
                <div className="flex-1 h-px" style={{ background: "var(--bg-border)" }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {items.map((ind) => (
                  <button
                    key={ind.code}
                    onClick={() => { setSelectedInd(ind.code); setFcData(null); setChartTab("historique"); }}
                    className="px-3 py-2 rounded-xl border text-xs font-medium transition-all text-left"
                    style={selectedInd === ind.code
                      ? { background: "color-mix(in srgb, var(--mansa-green) 12%, var(--card-bg))", borderColor: "color-mix(in srgb, var(--mansa-green) 40%, transparent)", color: "var(--mansa-green)" }
                      : { background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }
                    }
                    title={`${ind.code} · ${ind.description}`}
                  >
                    <span className="block truncate">{ind.label}</span>
                    <span className="block text-[9px] mt-0.5 opacity-60 font-mono">{ind.code}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Description indicateur ── */}
      <div className="rounded-xl px-4 py-3 border flex items-start gap-3"
           style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <Activity size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--mansa-green)" }} />
        <div>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{indMeta.label}</span>
          <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>({indMeta.unit})</span>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{indMeta.description}</p>
        </div>
      </div>

      {/* ── Layout principal 3 colonnes ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* ── Colonne gauche : liste pays ── */}
        <div className="col-span-12 lg:col-span-3 mansa-card rounded-2xl overflow-hidden lg:sticky lg:top-4 self-start" style={{ maxHeight: "70vh" }}>
          {/* Filtres */}
          <div className="px-3 pt-3 pb-2 border-b space-y-2" style={{ borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 border"
                 style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
              <Search size={12} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un pays..."
                className="bg-transparent text-xs focus:outline-none w-full"
                style={{ color: "var(--text-secondary)" }}
              />
            </div>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full text-xs rounded-lg px-2.5 py-1.5 border appearance-none focus:outline-none cursor-pointer"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
              >
                {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            </div>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 90px)" }}>
            {countriesLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg skeleton" />
                ))}
              </div>
            ) : (
              effectiveCountries.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCountry(c.id); setFcData(null); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-all text-left border-b"
                  style={{
                    borderColor: "var(--bg-border)",
                    background: activeCountry === c.id
                      ? "color-mix(in srgb, var(--mansa-green) 8%, var(--card-bg))"
                      : "",
                    borderLeft: activeCountry === c.id ? "2px solid var(--mansa-green)" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (activeCountry !== c.id) (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"; }}
                  onMouseLeave={(e) => { if (activeCountry !== c.id) (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <span className="text-base">{c.flag_emoji ?? "🌍"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: activeCountry === c.id ? "var(--mansa-green)" : "var(--text-primary)" }}>
                      {c.name_fr ?? c.name_en}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{c.region ?? "Afrique"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Colonne droite : graphique + stats ── */}
        <div className="col-span-12 lg:col-span-9 space-y-4">

          {/* KPIs résumé */}
          {activeCountryMeta && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeCountryMeta.flag_emoji ?? "🌍"}</span>
                <div>
                  <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                    {activeCountryMeta.name_fr ?? activeCountryMeta.name_en}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{activeCountryMeta.region}</p>
                </div>
              </div>
              <div className="flex-1" />
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Dernière valeur" value={latestValue} unit={indMeta.unit} trend={trend} />
                <KpiCard label="Moyenne période" value={avgValue} unit={indMeta.unit} />
                <KpiCard label="Maximum" value={maxValue} unit={indMeta.unit} />
                <KpiCard label="Minimum" value={minValue} unit={indMeta.unit} />
              </div>
            </div>
          )}

          {/* Bannière démo */}
          {isDemoData && (
            <div className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 border"
                 style={{ background: "color-mix(in srgb, var(--mansa-green) 5%, var(--card-bg))", borderColor: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--mansa-green)" }}>●</span>
              <span>
                Projections FMI WEO 2025e · Séries historiques générées sur base des tendances officielles · Les données live se chargent automatiquement à la connexion.
              </span>
            </div>
          )}

          {/* Graphique */}
          <div className="mansa-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {indMeta.label} — {activeCountryMeta?.name_fr ?? activeCountryMeta?.name_en ?? "—"}
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Séries 2010–2025 · {series[0]?.source ?? "IMF WEO"}</p>
              </div>
              <div className="flex gap-1">
                {(["area", "bar"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartType(t as any)}
                    className="px-2.5 py-1 text-xs rounded-lg border transition-colors"
                    style={chartType === t
                      ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                      : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }
                    }
                  >
                    {t === "area" ? "Courbe" : "Barres"}
                  </button>
                ))}
              </div>
            </div>

            {/* Onglets Historique / Prévisions */}
            <div className="flex items-center gap-1 border-b mb-4" style={{ borderColor: "var(--bg-border)" }}>
              {([
                { id: "historique", label: "Historique" },
                { id: "previsions", label: "Prévisions ARIMA" },
              ] as const).map(({ id: tid, label }) => (
                <button key={tid} onClick={() => {
                  setChartTab(tid);
                  if (tid === "previsions" && !fcData && activeCountry) {
                    setFcLoading(true); setFcError(null);
                    forecastApi.getIndicator(activeCountry, selectedInd, { horizon: fcHorizon })
                      .then((r) => setFcData(r))
                      .catch((e: any) => setFcError(e?.response?.data?.detail || e?.message || "Erreur"))
                      .finally(() => setFcLoading(false));
                  }
                }}
                  className="px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px"
                  style={chartTab === tid
                    ? { borderBottomColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                    : { borderBottomColor: "transparent", color: "var(--text-muted)" }}>
                  {label}
                </button>
              ))}
              {chartTab === "previsions" && (
                <div className="ml-auto flex items-center gap-1.5">
                  {[1, 2, 3, 5].map((h) => (
                    <button key={h} onClick={() => {
                      setFcHorizon(h); setFcData(null);
                      if (activeCountry) {
                        setFcLoading(true); setFcError(null);
                        forecastApi.getIndicator(activeCountry, selectedInd, { horizon: h })
                          .then((r) => setFcData(r))
                          .catch((e: any) => setFcError(e?.response?.data?.detail || e?.message || "Erreur"))
                          .finally(() => setFcLoading(false));
                      }
                    }}
                      className="text-[10px] px-2 py-0.5 rounded font-mono"
                      style={fcHorizon === h
                        ? { background: "var(--mansa-green)", color: "#000" }
                        : { background: "var(--bg-border)", color: "var(--text-muted)" }}>
                      {h}a
                    </button>
                  ))}
                </div>
              )}
            </div>

            {chartTab === "historique" && (
              macroLoading ? (
                <div className="h-64 skeleton rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center rounded-xl"
                     style={{ background: "var(--bg-border)" }}>
                  <div className="text-center">
                    <Globe2 size={32} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Aucune donnée disponible pour cet indicateur.
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                      Lancez le pipeline Dagster pour importer les données IMF WEO.
                    </p>
                  </div>
                </div>
              ) : chartType === "area" ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="indGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <Tooltip content={<CustomTooltip unit={indMeta.unit} />} />
                    <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="value" stroke="#00D4AA" strokeWidth={2} fill="url(#indGrad)" dot={{ r: 3, fill: "#00D4AA" }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                    <Tooltip content={<CustomTooltip unit={indMeta.unit} />} />
                    <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                    <Bar dataKey="value" fill="#00D4AA" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            )}

            {chartTab === "previsions" && (
              fcLoading ? (
                <div className="h-64 skeleton rounded-xl" />
              ) : fcError ? (
                <div className="h-40 flex items-center justify-center rounded-xl text-xs"
                     style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {fcError}
                </div>
              ) : fcData ? (
                <div>
                  <ForecastChart result={fcData} height={260} showLegend />
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {fcData.forecast.map((pt) => (
                      <div key={pt.year} className="flex-1 min-w-[70px] rounded-lg p-2 text-center"
                           style={{ background: "var(--bg-border)" }}>
                        <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>{pt.year}</div>
                        <div className="text-sm font-bold font-mono mt-0.5" style={{ color: "var(--mansa-green)" }}>
                          {pt.value.toFixed(1)}
                        </div>
                        <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                          [{pt.lower_95.toFixed(1)}, {pt.upper_95.toFixed(1)}]
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center rounded-xl"
                     style={{ background: "var(--bg-border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Sélectionnez l&apos;onglet Prévisions pour charger…
                  </p>
                </div>
              )
            )}
          </div>

          {/* Tableau des valeurs */}
          {chartData.length > 0 && (
            <div className="mansa-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Données tabulaires · {indMeta.label}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--bg-border)" }}>
                      {["Année", "Valeur", "Unité", "Source", "Tendance"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {series.slice().reverse().map((point, i, arr) => {
                      const prevV = arr[i + 1]?.value;
                      const diff = prevV != null ? point.value - prevV : null;
                      return (
                        <tr key={point.period} className="border-b transition-colors"
                            style={{ borderColor: "var(--bg-border)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                          <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>{point.period}</td>
                          <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                            {point.value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>{point.unit ?? indMeta.unit}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                              {point.source}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {diff != null && (
                              <span className="flex items-center gap-1 text-xs"
                                    style={{ color: diff > 0 ? "#10B981" : diff < 0 ? "#EF4444" : "var(--text-muted)" }}>
                                {diff > 0 ? <TrendingUp size={10} /> : diff < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
                                {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExportData}
        defaultFilename={`mansa-${selectedInd}-${activeCountry ?? "africa"}`}
        title="Exporter les données"
        subtitle={`${indMeta.label} · ${activeCountryMeta?.name_fr ?? activeCountryMeta?.name_en ?? "Pays sélectionné"}`}
      />
      {bulkExportOpen && <BulkExportModal onClose={() => setBulkExportOpen(false)} />}
    </div>
  );
}
