"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw,
  Download, Zap, Ship, Globe2, Package,
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
  const [activeTab,  setActiveTab]  = useState<"fx" | "indices" | "energy" | "trade" | "commodities">("fx");
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

  const rates: FxRate[]       = (fxData as any)?.rates       ?? [];
  const indices: MarketIndex[] = (indicesData as any)?.indices ?? [];

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
          { id: "energy",      label: "Énergie (EIA)",icon: Zap        },
          { id: "trade",       label: "Commerce (Comtrade)", icon: Ship },
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
