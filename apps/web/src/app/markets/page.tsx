"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw } from "lucide-react";
import { marketsApi } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Composants ─────────────────────────────────────────────────────────────
function ChangeTag({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const pos = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-mono font-semibold
                      ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {pos ? "+" : ""}{value.toFixed(2)}{suffix}
    </span>
  );
}

function FxCard({ rate }: { rate: FxRate }) {
  const spread = rate.spread_pct;
  const highSpread = spread > 5;

  return (
    <div className="mansa-card rounded-xl p-4 hover:border-[#00D4AA]/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold text-white font-mono">{rate.currency_code}</p>
          <p className="text-xs text-gray-500 mt-0.5">{rate.currency_name}</p>
        </div>
        {rate.peg && (
          <span className="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20
                           px-1.5 py-0.5 rounded font-medium">
            Ancré {rate.peg}
          </span>
        )}
      </div>

      {/* Taux officiel */}
      <div className="mb-3">
        <p className="text-xs text-gray-600 mb-0.5">Taux officiel (USD)</p>
        <p className="text-xl font-bold text-white font-mono">
          {rate.rate_official.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Spread parallèle */}
      <div className={`flex items-center justify-between text-xs mb-3 px-2 py-1.5 rounded-lg
                       ${highSpread ? "bg-amber-400/10" : "bg-[#141B2E]"}`}>
        <span className="text-gray-500">Marché parallèle</span>
        <div className="text-right">
          <span className="text-gray-300 font-mono">
            {rate.rate_parallel.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
          </span>
          <span className={`ml-2 font-semibold ${highSpread ? "text-amber-400" : "text-gray-500"}`}>
            +{spread.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Variations */}
      <div className="flex items-center justify-between text-xs border-t border-[#1E2A42] pt-2">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-gray-600">7 jours</span>
          <ChangeTag value={rate.change_7d} />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-gray-600">30 jours</span>
          <ChangeTag value={rate.change_30d} />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-gray-600">Pays</span>
          <span className="text-gray-400 font-mono">{rate.countries.length}</span>
        </div>
      </div>
    </div>
  );
}

function IndexCard({ idx }: { idx: MarketIndex }) {
  const pos1d = idx.change_1d >= 0;
  const posYtd = idx.change_ytd >= 0;

  return (
    <div className="mansa-card rounded-xl p-5 hover:border-[#00D4AA]/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{idx.flag}</span>
          <div>
            <p className="text-sm font-bold text-white">{idx.name}</p>
            <p className="text-xs text-gray-500 truncate max-w-[160px]">{idx.exchange}</p>
          </div>
        </div>
        <ChangeTag value={idx.change_1d} />
      </div>

      {/* Valeur indice */}
      <p className="text-2xl font-bold text-white font-mono mb-1">
        {idx.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
      </p>
      <p className="text-xs text-gray-600 mb-4">{idx.currency}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-[#141B2E] rounded-lg px-3 py-2">
          <p className="text-gray-600 mb-1">YTD</p>
          <ChangeTag value={idx.change_ytd} />
        </div>
        <div className="bg-[#141B2E] rounded-lg px-3 py-2">
          <p className="text-gray-600 mb-1">Volume</p>
          <p className="text-gray-300 font-mono">${idx.volume_usd_m}M</p>
        </div>
      </div>

      {/* Top stocks */}
      {idx.top_stocks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1E2A42]">
          <p className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wider">Top valeurs</p>
          <div className="flex flex-wrap gap-1">
            {idx.top_stocks.map((s) => (
              <span key={s} className="text-[10px] bg-[#1E2A42] text-gray-400 px-2 py-0.5 rounded">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function MarketsPage() {
  const { data: fxData, isLoading: fxLoading } = useQuery({
    queryKey: ["markets-fx"],
    queryFn: () => marketsApi.getFxRates(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: indicesData, isLoading: indicesLoading } = useQuery({
    queryKey: ["markets-indices"],
    queryFn: () => marketsApi.getIndices(),
    staleTime: 1000 * 60 * 5,
  });

  const rates: FxRate[]      = (fxData as any)?.rates       ?? [];
  const indices: MarketIndex[] = (indicesData as any)?.indices ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp size={22} className="text-[#00D4AA]" />
            Marchés africains
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Devises · Bourses · Taux de change · BRVM · JSE · NSE · EGX · MASI
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw size={12} className="animate-spin" />
          <span>Données indicatives — flux temps réel Phase 3</span>
        </div>
      </div>

      {/* ── Indices boursiers ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-[#00D4AA]" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Indices boursiers
          </h2>
          <span className="text-xs text-gray-600">6 places financières</span>
        </div>

        {indicesLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mansa-card rounded-xl h-52 skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {indices.map((idx) => (
              <IndexCard key={idx.name} idx={idx} />
            ))}
          </div>
        )}
      </section>

      {/* ── Tracker devises ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={16} className="text-[#00D4AA]" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Tracker devises
          </h2>
          <span className="text-xs text-gray-600">10 monnaies africaines vs USD</span>
        </div>

        {fxLoading ? (
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="mansa-card rounded-xl h-44 skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {rates.map((rate) => (
              <FxCard key={rate.currency_code} rate={rate} />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-gray-700 pb-4">
        Sources : Banques centrales · BCEAO · BEAC · Exchange websites · MANSA Terminal
        · Données indicatives, pas de conseil en investissement
      </p>
    </div>
  );
}
