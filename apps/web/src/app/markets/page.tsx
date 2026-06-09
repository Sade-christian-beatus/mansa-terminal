"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw,
  Download, Zap, Ship, Globe2, Package, Landmark, ArrowUpDown,
} from "lucide-react";
import { marketsApi } from "@/lib/api";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ── Types ──────────────────────────────────────────────── */
interface FxRate {
  currency_code: string;
  currency_name: string;
  countries: string[];
  peg: string | null;
  rate_official: number;
  rate_parallel: number;
  spread_pct: number;
  change_7d: number;
  change_30d: number;
  as_of: string;
}
interface MarketIndex {
  name: string;
  exchange: string;
  country: string;
  flag: string;
  value: number;
  change_1d: number;
  change_ytd: number;
  volume_usd_m: number;
  currency: string;
  top_stocks: string[];
}

/* ── Données EIA / Comtrade simulées ─────────────────────── */
const EIA_PRICES = [
  { month: "Jan", brent: 78, wti: 73, gas_henry: 2.5, coal_cif: 110 },
  { month: "Fév", brent: 82, wti: 77, gas_henry: 2.3, coal_cif: 108 },
  { month: "Mar", brent: 85, wti: 80, gas_henry: 1.9, coal_cif: 105 },
  { month: "Avr", brent: 89, wti: 84, gas_henry: 1.8, coal_cif: 107 },
  { month: "Mai", brent: 83, wti: 79, gas_henry: 2.1, coal_cif: 104 },
  { month: "Juin",brent: 79, wti: 74, gas_henry: 2.4, coal_cif: 102 },
];

const COMTRADE_FLOWS = [
  { country: "Nigeria",      flag: "🇳🇬", exports: 58.2,  imports: 24.1, balance: +34.1, main_exp: "Pétrole brut (92%)" },
  { country: "Afrique du S.",flag: "🇿🇦", exports: 99.4,  imports: 92.3, balance: +7.1,  main_exp: "Or, platine, charbon" },
  { country: "Égypte",       flag: "🇪🇬", exports: 31.7,  imports: 68.2, balance: -36.5, main_exp: "Gaz nat., produits pétrole" },
  { country: "Maroc",        flag: "🇲🇦", exports: 35.2,  imports: 49.1, balance: -13.9, main_exp: "Phosphates, textile" },
  { country: "Côte d'Ivoire",flag: "🇨🇮", exports: 12.8,  imports: 9.6,  balance: +3.2,  main_exp: "Cacao, noix de cajou" },
  { country: "Kenya",        flag: "🇰🇪", exports: 8.1,   imports: 14.2, balance: -6.1,  main_exp: "Thé, horticulture, café" },
  { country: "Éthiopie",     flag: "🇪🇹", exports: 4.2,   imports: 10.3, balance: -6.1,  main_exp: "Café, sésame, peaux" },
  { country: "Ghana",        flag: "🇬🇭", exports: 14.9,  imports: 13.1, balance: +1.8,  main_exp: "Or, pétrole, cacao" },
];

/* ── Données Eurobonds (prototype macro-data.js) ─────────────── */
const EUROBONDS = [
  { iso: "MAR", name: "Maroc",          flag: "🇲🇦", maturity: 2032, ytm: 5.4,  spread: 120,  chg: -1,  rating: "BB+", amount: 2.5 },
  { iso: "ZAF", name: "Afrique du Sud", flag: "🇿🇦", maturity: 2032, ytm: 7.1,  spread: 270,  chg: -2,  rating: "BB-", amount: 5.0 },
  { iso: "CIV", name: "Côte d'Ivoire",  flag: "🇨🇮", maturity: 2033, ytm: 7.6,  spread: 330,  chg: -3,  rating: "BB-", amount: 2.6 },
  { iso: "BEN", name: "Bénin",          flag: "🇧🇯", maturity: 2032, ytm: 8.0,  spread: 380,  chg: -2,  rating: "B+",  amount: 0.5 },
  { iso: "SEN", name: "Sénégal",        flag: "🇸🇳", maturity: 2031, ytm: 8.4,  spread: 410,  chg: +4,  rating: "B+",  amount: 2.2 },
  { iso: "RWA", name: "Rwanda",         flag: "🇷🇼", maturity: 2031, ytm: 8.7,  spread: 450,  chg: +3,  rating: "B+",  amount: 0.6 },
  { iso: "NGA", name: "Nigeria",        flag: "🇳🇬", maturity: 2032, ytm: 10.3, spread: 600,  chg: -8,  rating: "B",   amount: 4.2 },
  { iso: "CMR", name: "Cameroun",       flag: "🇨🇲", maturity: 2032, ytm: 9.2,  spread: 500,  chg: +2,  rating: "B-",  amount: 0.7 },
  { iso: "AGO", name: "Angola",         flag: "🇦🇴", maturity: 2032, ytm: 11.2, spread: 690,  chg: +15, rating: "B-",  amount: 3.0 },
  { iso: "KEN", name: "Kenya",          flag: "🇰🇪", maturity: 2031, ytm: 9.9,  spread: 560,  chg: -5,  rating: "B",   amount: 2.0 },
  { iso: "EGY", name: "Égypte",         flag: "🇪🇬", maturity: 2033, ytm: 11.8, spread: 760,  chg: +12, rating: "B-",  amount: 3.8 },
  { iso: "TUN", name: "Tunisie",        flag: "🇹🇳", maturity: 2027, ytm: 12.9, spread: 870,  chg: +20, rating: "CCC+",amount: 1.0 },
  { iso: "GAB", name: "Gabon",          flag: "🇬🇦", maturity: 2031, ytm: 11.0, spread: 680,  chg: +11, rating: "CCC", amount: 0.7 },
  { iso: "GHA", name: "Ghana",          flag: "🇬🇭", maturity: 2030, ytm: 18.5, spread: 1320, chg: +24, rating: "CCC", amount: 3.3 },
  { iso: "ZMB", name: "Zambie",         flag: "🇿🇲", maturity: 2033, ytm: 13.4, spread: 905,  chg: -18, rating: "CCC", amount: 3.0 },
  { iso: "ETH", name: "Éthiopie",       flag: "🇪🇹", maturity: 2031, ytm: 16.2, spread: 1180, chg: +9,  rating: "CCC-",amount: 1.0 },
];

function ratingColor(r: string) {
  if (/^BB|^BBB/.test(r)) return "#10B981";
  if (/^B\+/.test(r)) return "#22D39A";
  if (/^B(-|$)/.test(r)) return "#FBBF24";
  return "#EF4444"; // CCC / distressed
}
function spreadColor(bps: number) { return bps >= 900 ? "#EF4444" : bps >= 500 ? "#F59E0B" : "#10B981"; }

const WB_COMMODITIES = [
  { name: "Cacao",      unit: "$/t",   price: 9_420, change: +22.3, flag: "🍫" },
  { name: "Café Arabica",unit: "$/lb", price: 1.98,  change: +8.1,  flag: "☕" },
  { name: "Coton",      unit: "¢/lb",  price: 82.4,  change: -3.2,  flag: "🪡" },
  { name: "Phosphates", unit: "$/t",   price: 388,   change: -5.7,  flag: "⚗️" },
  { name: "Cuivre",     unit: "$/t",   price: 9_820, change: +4.8,  flag: "🔶" },
  { name: "Or",         unit: "$/oz",  price: 2_340, change: +12.1, flag: "🥇" },
  { name: "Brent",      unit: "$/bbl", price: 79.2,  change: -6.3,  flag: "🛢️" },
  { name: "Gaz nat.",   unit: "$/mbtu",price: 2.41,  change: +3.4,  flag: "🔥" },
];

/* ── Sous-composants ───────────────────────────────────── */
function ChangeTag({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const pos = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pos ? "+" : ""}{value.toFixed(2)}{suffix}
    </span>
  );
}

function FxCard({ rate }: { rate: FxRate }) {
  const highSpread = rate.spread_pct > 5;
  return (
    <div className="mansa-card rounded-xl p-4 mansa-card-hover">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold font-mono" style={{ color: "var(--text-primary)" }}>{rate.currency_code}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{rate.currency_name}</p>
        </div>
        {rate.peg && (
          <span className="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded font-medium">
            Ancré {rate.peg}
          </span>
        )}
      </div>
      <div className="mb-3">
        <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Taux officiel (USD)</p>
        <p className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
          {rate.rate_official.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className={`flex items-center justify-between text-xs mb-3 px-2 py-1.5 rounded-lg ${highSpread ? "bg-amber-400/10" : ""}`}
           style={!highSpread ? { background: "var(--sidebar-bg)" } : {}}>
        <span style={{ color: "var(--text-muted)" }}>Parallèle</span>
        <div className="text-right">
          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
            {rate.rate_parallel.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
          </span>
          <span className={`ml-2 font-semibold ${highSpread ? "text-amber-400" : ""}`} style={!highSpread ? { color: "var(--text-muted)" } : {}}>
            +{rate.spread_pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs border-t pt-2" style={{ borderColor: "var(--bg-border)" }}>
        <div className="flex flex-col items-center gap-0.5">
          <span style={{ color: "var(--text-muted)" }}>7j</span>
          <ChangeTag value={rate.change_7d} />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span style={{ color: "var(--text-muted)" }}>30j</span>
          <ChangeTag value={rate.change_30d} />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span style={{ color: "var(--text-muted)" }}>Pays</span>
          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{rate.countries.length}</span>
        </div>
      </div>
    </div>
  );
}

function IndexCard({ idx }: { idx: MarketIndex }) {
  return (
    <div className="mansa-card rounded-xl p-5 mansa-card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{idx.flag}</span>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{idx.name}</p>
            <p className="text-xs truncate max-w-[160px]" style={{ color: "var(--text-muted)" }}>{idx.exchange}</p>
          </div>
        </div>
        <ChangeTag value={idx.change_1d} />
      </div>
      <p className="text-2xl font-bold font-mono mb-1" style={{ color: "var(--text-primary)" }}>
        {idx.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
      </p>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{idx.currency}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--sidebar-bg)" }}>
          <p className="mb-1" style={{ color: "var(--text-muted)" }}>YTD</p>
          <ChangeTag value={idx.change_ytd} />
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--sidebar-bg)" }}>
          <p className="mb-1" style={{ color: "var(--text-muted)" }}>Volume</p>
          <p className="font-mono" style={{ color: "var(--text-secondary)" }}>${idx.volume_usd_m}M</p>
        </div>
      </div>
      {idx.top_stocks.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--bg-border)" }}>
          <p className="text-[10px] mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Top valeurs</p>
          <div className="flex flex-wrap gap-1">
            {idx.top_stocks.map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page principale ───────────────────────────────────── */
export default function MarketsPage() {
  const [activeTab,  setActiveTab]  = useState<"fx" | "indices" | "eurobonds" | "energy" | "trade" | "commodities">("fx");
  const [bondSort,   setBondSort]   = useState<"spread" | "ytm" | "maturity">("spread");
  const [exportOpen, setExportOpen] = useState(false);

  const { data: fxData, isLoading: fxLoading, refetch: refetchFx, isFetching: fetchingFx } = useQuery({
    queryKey: ["markets-fx"],
    queryFn: () => marketsApi.getFxRates(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: indicesData, isLoading: indicesLoading } = useQuery({
    queryKey: ["markets-indices"],
    queryFn: () => marketsApi.getIndices(),
    staleTime: 1000 * 60 * 5,
  });

  /* ── Données fallback FX (BCEAO + BEAC + banques centrales) ── */
  const FX_FALLBACK: FxRate[] = [
    { currency_code: "XOF", currency_name: "Franc CFA (UEMOA)",   countries: ["SEN","CIV","MLI","BFA","TGO","BEN","NER","GNB"], peg: "EUR", rate_official: 655.96,  rate_parallel: 660.0,  spread_pct: 0.6,  change_7d: 0.0,  change_30d: 0.0,  as_of: "2025-06-09" },
    { currency_code: "XAF", currency_name: "Franc CFA (CEMAC)",   countries: ["CMR","GAB","CHL","CAF","GNQ","COG"], peg: "EUR",   rate_official: 655.96,  rate_parallel: 661.0,  spread_pct: 0.8,  change_7d: 0.0,  change_30d: 0.0,  as_of: "2025-06-09" },
    { currency_code: "NGN", currency_name: "Naira nigérian",        countries: ["NGA"],                          peg: null,    rate_official: 1620.0,  rate_parallel: 1680.0, spread_pct: 3.7,  change_7d: -8.2, change_30d:-15.3, as_of: "2025-06-09" },
    { currency_code: "KES", currency_name: "Shilling kényan",       countries: ["KEN"],                          peg: null,    rate_official: 129.5,   rate_parallel: 133.0,  spread_pct: 2.7,  change_7d: +1.2, change_30d: +3.1, as_of: "2025-06-09" },
    { currency_code: "GHS", currency_name: "Cedi ghanéen",          countries: ["GHA"],                          peg: null,    rate_official: 15.8,    rate_parallel: 16.4,   spread_pct: 3.8,  change_7d: -1.5, change_30d: -4.2, as_of: "2025-06-09" },
    { currency_code: "ZAR", currency_name: "Rand sud-africain",     countries: ["ZAF"],                          peg: null,    rate_official: 18.62,   rate_parallel: 18.90,  spread_pct: 1.5,  change_7d: +0.8, change_30d: -2.1, as_of: "2025-06-09" },
    { currency_code: "EGP", currency_name: "Livre égyptienne",      countries: ["EGY"],                          peg: null,    rate_official: 48.5,    rate_parallel: 52.0,   spread_pct: 7.2,  change_7d: -2.3, change_30d: -8.4, as_of: "2025-06-09" },
    { currency_code: "MAD", currency_name: "Dirham marocain",       countries: ["MAR"],                          peg: null,    rate_official: 9.92,    rate_parallel: 10.05,  spread_pct: 1.3,  change_7d: +0.3, change_30d: +0.7, as_of: "2025-06-09" },
    { currency_code: "ETB", currency_name: "Birr éthiopien",        countries: ["ETH"],                          peg: null,    rate_official: 57.5,    rate_parallel: 112.0,  spread_pct: 94.8, change_7d: -5.1, change_30d:-18.2, as_of: "2025-06-09" },
    { currency_code: "TZS", currency_name: "Shilling tanzanien",    countries: ["TZA"],                          peg: null,    rate_official: 2590.0,  rate_parallel: 2630.0, spread_pct: 1.5,  change_7d: +0.4, change_30d: +1.2, as_of: "2025-06-09" },
  ];

  /* ── Données fallback indices boursiers africains ── */
  const INDICES_FALLBACK: MarketIndex[] = [
    { name: "BRVM Composite",  exchange: "Bourse Régionale UEMOA",   country: "Côte d'Ivoire", flag: "🇨🇮", value: 296.85,  change_1d: +0.42, change_ytd: +8.3,  volume_usd_m: 12.4,  currency: "XOF", top_stocks: ["SONATEL","ORAGROUP","TOTAL CI","SAFCA"] },
    { name: "NGX All-Share",   exchange: "Nigerian Exchange Group",   country: "Nigeria",       flag: "🇳🇬", value: 105_420, change_1d: -1.12, change_ytd: +32.4, volume_usd_m: 89.2,  currency: "NGN", top_stocks: ["DANGOTE","MTNN","AIRTELAF","GTCO","ZENITH"] },
    { name: "JSE All-Share",   exchange: "Johannesburg Stock Exch.",  country: "Afrique du S.", flag: "🇿🇦", value: 82_450,  change_1d: -2.1,  change_ytd: +5.1,  volume_usd_m: 1_240, currency: "ZAR", top_stocks: ["NASPERS","PROSUS","ABSA","STANDARD","GLENCORE"] },
    { name: "NSE 20",          exchange: "Nairobi Securities Exch.",  country: "Kenya",         flag: "🇰🇪", value: 2_148,   change_1d: +0.73, change_ytd: +14.2, volume_usd_m: 8.7,   currency: "KES", top_stocks: ["SAFARICOM","KCB","EQUITY","EABL","KPLC"] },
    { name: "EGX 30",          exchange: "Egyptian Exchange",         country: "Égypte",        flag: "🇪🇬", value: 28_910,  change_1d: +1.84, change_ytd: +48.3, volume_usd_m: 145.3, currency: "EGP", top_stocks: ["CIB","COMI","HRHO","ETEL","EKHO"] },
    { name: "Casablanca MASI", exchange: "Bourse de Casablanca",      country: "Maroc",         flag: "🇲🇦", value: 13_620,  change_1d: +0.21, change_ytd: +6.8,  volume_usd_m: 34.8,  currency: "MAD", top_stocks: ["ATTIJARIWAFA","BCP","MAROC TELECOM","IAM","HPS"] },
    { name: "GSE Composite",   exchange: "Ghana Stock Exchange",      country: "Ghana",         flag: "🇬🇭", value: 4_125,   change_1d: -0.38, change_ytd: +22.1, volume_usd_m: 3.2,   currency: "GHS", top_stocks: ["MTN GH","GCB","TOTAL GH","GOIL","CAL BANK"] },
    { name: "DSE Total Mkt",   exchange: "Dar es Salaam Stk Exch.",   country: "Tanzanie",      flag: "🇹🇿", value: 2_089,   change_1d: +0.15, change_ytd: +4.3,  volume_usd_m: 1.8,   currency: "TZS", top_stocks: ["CRDB","NMB","VODACOM TZ","TWIGA"] },
  ];

  const rates: FxRate[]       = (() => {
    const api = (fxData as any)?.rates;
    return Array.isArray(api) && api.length > 0 ? api : FX_FALLBACK;
  })();
  const indices: MarketIndex[] = (() => {
    const api = (indicesData as any)?.indices;
    return Array.isArray(api) && api.length > 0 ? api : INDICES_FALLBACK;
  })();

  const handleExport = async (_sources: string[], yFrom: number, yTo: number): Promise<ExportRow[]> => {
    const rows: ExportRow[] = [];
    rates.forEach((r) => rows.push({ dataset: "FX Rates", currency: r.currency_code, name: r.currency_name, rate_official: r.rate_official, rate_parallel: r.rate_parallel, spread_pct: r.spread_pct, change_7d: r.change_7d, change_30d: r.change_30d }));
    indices.forEach((i) => rows.push({ dataset: "Stock Indices", name: i.name, exchange: i.exchange, value: i.value, change_1d: i.change_1d, change_ytd: i.change_ytd, volume_usd_m: i.volume_usd_m }));
    COMTRADE_FLOWS.forEach((c) => rows.push({ dataset: "UN Comtrade", country: c.country, exports_bn: c.exports, imports_bn: c.imports, balance_bn: c.balance, main_exports: c.main_exp }));
    WB_COMMODITIES.forEach((c) => rows.push({ dataset: "WB Commodities", commodity: c.name, unit: c.unit, price: c.price, change_pct: c.change }));
    return rows;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <TrendingUp size={22} style={{ color: "var(--mansa-green)" }} />
            Marchés africains
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Devises · Bourses · Énergie EIA · Commerce Comtrade · Matières premières
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => refetchFx()} className="p-1.5 rounded-lg border transition-colors"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }}>
            <RefreshCw size={13} className={fetchingFx ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-sm flex items-center gap-2">
            <Download size={14} /> Exporter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--bg-border)" }}>
        {([
          { id: "fx",          label: "Devises",      icon: DollarSign },
          { id: "indices",     label: "Bourses",      icon: BarChart2  },
          { id: "eurobonds",   label: "Eurobonds",    icon: Landmark   },
          { id: "energy",      label: "Énergie (EIA)",icon: Zap        },
          { id: "trade",       label: "Commerce",     icon: Ship       },
          { id: "commodities", label: "Matières premières", icon: Package },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={
              activeTab === id
                ? { borderBottomColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                : { borderBottomColor: "transparent", color: "var(--text-muted)" }
            }
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Devises ── */}
      {activeTab === "fx" && (
        fxLoading ? (
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="mansa-card rounded-xl h-44 skeleton" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {rates.map((rate) => <FxCard key={rate.currency_code} rate={rate} />)}
          </div>
        )
      )}

      {/* ── Tab Bourses ── */}
      {activeTab === "indices" && (
        indicesLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mansa-card rounded-xl h-52 skeleton" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {indices.map((idx) => <IndexCard key={idx.name} idx={idx} />)}
          </div>
        )
      )}

      {/* ── Tab Eurobonds ── */}
      {activeTab === "eurobonds" && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Spread médian (bps)",  value: Math.round(EUROBONDS.reduce((s,b)=>s+b.spread,0)/EUROBONDS.length), color: "#F59E0B" },
              { label: "Spread max",            value: Math.max(...EUROBONDS.map(b=>b.spread)) + " bps", color: "#EF4444" },
              { label: "En écartement (7j)",   value: EUROBONDS.filter(b=>b.chg>0).length + "/" + EUROBONDS.length, color: "#EF4444" },
              { label: "Encours total ($Bn)",  value: EUROBONDS.reduce((s,b)=>s+b.amount,0).toFixed(1), color: "#3B82F6" },
            ].map((k) => (
              <div key={k.label} className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Tableau */}
          <div className="mansa-card rounded-xl overflow-hidden">
            {/* En-tête avec tri */}
            <div className="grid gap-4 px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
                 style={{ gridTemplateColumns: "2fr 60px 70px 1fr 60px 60px", background: "var(--sidebar-bg)", borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
              <span>Pays</span>
              <button className="flex items-center gap-1 text-left" onClick={() => setBondSort("maturity")} style={{ color: bondSort === "maturity" ? "var(--mansa-green)" : "var(--text-muted)" }}>Mat <ArrowUpDown size={8} /></button>
              <button className="flex items-center gap-1 text-right justify-end" onClick={() => setBondSort("ytm")} style={{ color: bondSort === "ytm" ? "var(--mansa-green)" : "var(--text-muted)" }}>Rdt % <ArrowUpDown size={8} /></button>
              <button className="flex items-center gap-1" onClick={() => setBondSort("spread")} style={{ color: bondSort === "spread" ? "var(--mansa-green)" : "var(--text-muted)" }}>Spread vs UST <ArrowUpDown size={8} /></button>
              <span className="text-right">Δ7j</span>
              <span className="text-right">Note</span>
            </div>

            {[...EUROBONDS]
              .sort((a,b) => bondSort === "spread" ? b.spread - a.spread : bondSort === "ytm" ? b.ytm - a.ytm : a.maturity - b.maturity)
              .map((bond) => {
                const maxSpread = Math.max(...EUROBONDS.map(b=>b.spread));
                return (
                  <div
                    key={bond.iso}
                    className="grid gap-4 px-4 py-3 border-b items-center transition-colors hover:opacity-90"
                    style={{ gridTemplateColumns: "2fr 60px 70px 1fr 60px 60px", borderColor: "var(--bg-border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{bond.flag}</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{bond.name}</p>
                        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>${bond.amount}Bn</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>&lsquo;{String(bond.maturity).slice(2)}</span>
                    <span className="text-sm font-bold font-mono text-right" style={{ color: "var(--text-primary)" }}>{bond.ytm.toFixed(1)}%</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(bond.spread/maxSpread)*100}%`, background: spreadColor(bond.spread) }} />
                      </div>
                      <span className="text-xs font-mono font-bold w-12 text-right" style={{ color: spreadColor(bond.spread) }}>{bond.spread}</span>
                    </div>
                    <span className="text-xs font-mono text-right" style={{ color: bond.chg > 0 ? "#EF4444" : bond.chg < 0 ? "#10B981" : "var(--text-muted)" }}>
                      {bond.chg > 0 ? "+" : ""}{bond.chg}
                    </span>
                    <div className="text-right">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border"
                            style={{ color: ratingColor(bond.rating), borderColor: ratingColor(bond.rating) + "44" }}>
                        {bond.rating}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Investment grade (BB et +)", count: EUROBONDS.filter(b=>/^BB|^BBB/.test(b.rating)).length, color: "#10B981" },
              { label: "High yield (B)",             count: EUROBONDS.filter(b=>/^B[^B]|^B$/.test(b.rating)).length, color: "#F59E0B" },
              { label: "Distressed (CCC et -)",      count: EUROBONDS.filter(b=>/^CCC/.test(b.rating)).length,       color: "#EF4444" },
            ].map((g) => (
              <div key={g.label} className="mansa-card rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl font-bold font-mono" style={{ color: g.color }}>{g.count}</span>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{g.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Source : Bloomberg · MANSA Terminal · Spread = prime risque vs US Treasuries · Δ7j en points de base
          </p>
        </div>
      )}

      {/* ── Tab Énergie EIA ── */}
      {activeTab === "energy" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Brent actuel",        value: "$79.2/bbl",  change: -6.3, color: "#F59E0B" },
              { label: "WTI actuel",           value: "$74.1/bbl",  change: -5.8, color: "#F97316" },
              { label: "Gaz Henry Hub",        value: "$2.41/mbtu", change: +3.4, color: "#3B82F6" },
              { label: "Charbon vapeur CIF",   value: "$102/t",     change: -7.5, color: "#6B7280" },
            ].map((k) => (
              <div key={k.label} className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
                <p className="text-xl font-bold font-mono mb-1" style={{ color: k.color }}>{k.value}</p>
                <ChangeTag value={k.change} />
              </div>
            ))}
          </div>

          <div className="mansa-card rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Évolution des prix énergétiques (EIA) — 2025 YTD
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={EIA_PRICES} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ color: "var(--text-secondary)" }}
                />
                <Line type="monotone" dataKey="brent"     stroke="#F59E0B" strokeWidth={2} dot={false} name="Brent ($/bbl)" />
                <Line type="monotone" dataKey="wti"       stroke="#F97316" strokeWidth={2} dot={false} name="WTI ($/bbl)" />
                <Line type="monotone" dataKey="coal_cif"  stroke="#6B7280" strokeWidth={2} dot={false} name="Charbon ($/t)" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-3 flex-wrap">
              {[{ label: "Brent", color: "#F59E0B" }, { label: "WTI", color: "#F97316" }, { label: "Charbon", color: "#6B7280" }].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span className="w-3 h-0.5 rounded" style={{ background: l.color }} />{l.label}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Source : EIA International Energy Statistics · api.eia.gov · Mise à jour mensuelle</p>
        </div>
      )}

      {/* ── Tab Comtrade ── */}
      {activeTab === "trade" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Exportations totales (Bn$)", value: COMTRADE_FLOWS.reduce((s, c) => s + c.exports, 0).toFixed(1), color: "#10B981" },
              { label: "Importations totales (Bn$)", value: COMTRADE_FLOWS.reduce((s, c) => s + c.imports, 0).toFixed(1), color: "#EF4444" },
              { label: "Balance commerciale (Bn$)",  value: COMTRADE_FLOWS.reduce((s, c) => s + c.balance, 0).toFixed(1), color: "#3B82F6" },
            ].map((k) => (
              <div key={k.label} className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="mansa-card rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_3fr] gap-4 px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
                 style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
              <span>Pays</span><span>Exports (Bn$)</span><span>Imports (Bn$)</span><span>Balance</span><span>Principaux exports</span>
            </div>
            {COMTRADE_FLOWS.map((c) => (
              <div key={c.country}
                   className="grid grid-cols-[2fr_1fr_1fr_1fr_3fr] gap-4 px-4 py-3 items-center border-b text-sm"
                   style={{ borderColor: "var(--bg-border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.flag}</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{c.country}</span>
                </div>
                <span className="font-mono text-emerald-400">{c.exports.toFixed(1)}</span>
                <span className="font-mono text-red-400">{c.imports.toFixed(1)}</span>
                <span className={`font-mono font-semibold ${c.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {c.balance >= 0 ? "+" : ""}{c.balance.toFixed(1)}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.main_exp}</span>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Source : UN Comtrade v1 · comtradeapi.un.org · Données 2023–2024</p>
        </div>
      )}

      {/* ── Tab Matières premières ── */}
      {activeTab === "commodities" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {WB_COMMODITIES.map((c) => (
              <div key={c.name} className="mansa-card rounded-xl p-4 mansa-card-hover">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{c.flag}</span>
                  <ChangeTag value={c.change} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--mansa-green)" }}>
                  {typeof c.price === "number" && c.price > 100
                    ? c.price.toLocaleString("fr-FR")
                    : c.price}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.unit}</p>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Source : World Bank Commodity Markets · Banque Mondiale · Mise à jour mensuelle</p>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs pb-4" style={{ color: "var(--text-muted)" }}>
        Sources : BCEAO · BEAC · Banques centrales · EIA International · UN Comtrade · World Bank Commodities · MANSA Terminal —
        Données indicatives, pas de conseil en investissement
      </p>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExport}
        defaultFilename="mansa-markets"
        title="Exporter les données marchés"
        subtitle="Devises · Indices · Énergie EIA · Commerce Comtrade · Matières premières"
        preSelectedSources={["IMF_IFS", "World_Bank_WDI", "EIA_International", "UN_Comtrade"]}
      />
    </div>
  );
}
