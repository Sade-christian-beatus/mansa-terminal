"use client";

import { useQuery } from "@tanstack/react-query";

interface FxResponse {
  latest?: { rates: Record<string, number>; date: string };
  prev?: { rates: Record<string, number> };
  isFallback?: boolean;
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

  const rates = (data?.latest?.rates ?? {}) as Record<string, number>;
  const prevRates = (data?.prev?.rates ?? {}) as Record<string, number>;

  const items = Object.entries(rates)
    .filter(([code]) => CURRENCY_META[code])
    .map(([code, rate]) => {
      const prev = prevRates[code] ?? rate;
      const change = ((rate - prev) / prev) * 100;
      return { code, rate, change, flag: CURRENCY_META[code].flag };
    });

  if (items.length === 0) {
    return (
      <div className="h-8 border-b flex items-center px-4 gap-8"
           style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-2.5 w-20 skeleton rounded" />
        ))}
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
    <div className="h-8 border-b overflow-hidden flex items-stretch"
         style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
      {/* Badge FX LIVE / DEMO */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 border-r"
           style={{
             borderColor: "var(--sidebar-border)",
             background: data?.isFallback ? "rgba(245,158,11,0.05)" : "color-mix(in srgb, var(--mansa-green) 5%, transparent)",
           }}>
        <span className={`w-1.5 h-1.5 rounded-full ${data?.isFallback ? "bg-amber-400" : "animate-pulse"}`}
              style={data?.isFallback ? {} : { background: "var(--mansa-green)" }} />
        <span className="text-[10px] font-mono font-bold tracking-widest"
              style={{ color: data?.isFallback ? "#F59E0B" : "var(--mansa-green)" }}>
          {data?.isFallback ? "DEMO" : "FX"}
        </span>
      </div>

      {/* Label base */}
      <div className="shrink-0 flex items-center px-3 border-r"
           style={{ borderColor: "var(--sidebar-border)" }}>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>1 USD =</span>
      </div>

      {/* Scrolling strip */}
      <div className="flex-1 overflow-hidden relative">
        <div className="flex w-max animate-ticker h-8 items-center">
          {doubled.map((item, i) => (
            <div
              key={`${item.code}-${i}`}
              className="shrink-0 flex items-center gap-1.5 px-4 h-full border-r"
              style={{ borderColor: "color-mix(in srgb, var(--bg-border) 40%, transparent)" }}
            >
              <span className="text-[11px] leading-none">{item.flag}</span>
              <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>{item.code}</span>
              <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatRate(item.rate)}
              </span>
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: item.change > 0.01 ? "#EF4444" : item.change < -0.01 ? "#10B981" : "var(--text-muted)" }}
              >
                {item.change > 0.01 ? "▲" : item.change < -0.01 ? "▼" : "·"}
                {Math.abs(item.change) > 0.01 ? Math.abs(item.change).toFixed(2) + "%" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="shrink-0 flex items-center px-3 border-l"
           style={{ borderColor: "var(--sidebar-border)" }}>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {data?.latest?.date ?? "—"}
        </span>
      </div>
    </div>
  );
}
