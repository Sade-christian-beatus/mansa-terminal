"use client";

import { useQuery } from "@tanstack/react-query";

interface FxResponse {
  latest?: { rates: Record<string, number>; date: string };
  prev?: { rates: Record<string, number> };
}

const CURRENCY_META: Record<string, { flag: string }> = {
  NGN: { flag: "🇳🇬" },
  ZAR: { flag: "🇿🇦" },
  KES: { flag: "🇰🇪" },
  GHS: { flag: "🇬🇭" },
  EGP: { flag: "🇪🇬" },
  ETB: { flag: "🇪🇹" },
  MAD: { flag: "🇲🇦" },
  TZS: { flag: "🇹🇿" },
  UGX: { flag: "🇺🇬" },
  XOF: { flag: "🌍" },
  XAF: { flag: "🌍" },
};

function formatRate(rate: number): string {
  if (rate >= 1000) return rate.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  if (rate >= 10) return rate.toFixed(1);
  return rate.toFixed(3);
}

export function MarketTicker() {
  const { data } = useQuery<FxResponse>({
    queryKey: ["fx-ticker"],
    queryFn: () => fetch("/api/fx").then((r) => r.json()),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });

  const rates = data?.latest?.rates ?? {};
  const prevRates = data?.prev?.rates ?? {};

  const items = Object.entries(rates)
    .filter(([code]) => CURRENCY_META[code])
    .map(([code, rate]) => {
      const prev = prevRates[code] ?? rate;
      const change = ((rate - prev) / prev) * 100;
      return { code, rate, change, flag: CURRENCY_META[code].flag };
    });

  if (items.length === 0) {
    return (
      <div className="h-8 bg-[#080D1A] border-b border-[#1E2A42] flex items-center px-4 gap-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-2.5 w-20 bg-[#1E2A42] rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
    <div className="h-8 bg-[#080D1A] border-b border-[#1E2A42] overflow-hidden flex items-stretch">
      {/* Badge FX LIVE */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 border-r border-[#1E2A42] bg-[#00D4AA]/5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
        <span className="text-[#00D4AA] text-[10px] font-mono font-bold tracking-widest">FX</span>
      </div>

      {/* Label base */}
      <div className="shrink-0 flex items-center px-3 border-r border-[#1E2A42]">
        <span className="text-gray-600 text-[10px] font-mono">1 USD =</span>
      </div>

      {/* Scrolling strip */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex w-max animate-ticker h-8 items-center">
          {doubled.map((item, i) => (
            <div
              key={`${item.code}-${i}`}
              className="shrink-0 flex items-center gap-1.5 px-4 border-r border-[#1E2A42]/40 h-full"
            >
              <span className="text-[11px] leading-none">{item.flag}</span>
              <span className="text-gray-400 text-[11px] font-mono">{item.code}</span>
              <span className="text-white text-[11px] font-mono font-semibold tabular-nums">
                {formatRate(item.rate)}
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  item.change > 0.01
                    ? "text-red-400"
                    : item.change < -0.01
                    ? "text-green-400"
                    : "text-gray-600"
                }`}
              >
                {item.change > 0.01 ? "▲" : item.change < -0.01 ? "▼" : "·"}
                {Math.abs(item.change) > 0.01 ? Math.abs(item.change).toFixed(2) + "%" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="shrink-0 flex items-center px-3 border-l border-[#1E2A42]">
        <span className="text-gray-700 text-[10px] font-mono">
          {data?.latest?.date ?? "—"}
        </span>
      </div>
    </div>
  );
}
