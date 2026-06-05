"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Globe, BarChart3, Landmark } from "lucide-react";

interface ImfData {
  values: Record<string, Record<string, number>>;
  isFallback?: boolean;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function useAggregates() {
  const { data: gdp, isLoading: l1 } = useQuery<ImfData>({
    queryKey: ["imf-hero-gdp"],
    queryFn: () => fetch("/api/imf?indicator=NGDP_RPCH&periods=2023,2024").then((r) => r.json()),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const { data: inf, isLoading: l2 } = useQuery<ImfData>({
    queryKey: ["imf-hero-inf"],
    queryFn: () => fetch("/api/imf?indicator=PCPIPCH&periods=2023,2024").then((r) => r.json()),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const { data: debt } = useQuery<ImfData>({
    queryKey: ["imf-hero-debt"],
    queryFn: () => fetch("/api/imf?indicator=GGXWDG_NGDP&periods=2024").then((r) => r.json()),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // Typage explicite pour éviter que `?? {}` élargisse vers Record<string, unknown>
  const gdpVals = (gdp?.values ?? {}) as Record<string, Record<string, number>>;
  const infVals = (inf?.values ?? {}) as Record<string, Record<string, number>>;
  const debtVals = (debt?.values ?? {}) as Record<string, Record<string, number>>;

  const gdp24 = Object.values(gdpVals).map((v) => v["2024"]).filter((v): v is number => v != null);
  const gdp23 = Object.values(gdpVals).map((v) => v["2023"]).filter((v): v is number => v != null);
  const inf24 = Object.values(infVals).map((v) => v["2024"]).filter((v): v is number => v != null);
  const debt24 = Object.values(debtVals).map((v) => v["2024"]).filter((v): v is number => v != null);

  const isFallback = !!(gdp?.isFallback || inf?.isFallback || debt?.isFallback);

  return {
    isLoading: l1 || l2,
    isFallback,
    medianGdp: median(gdp24),
    medianGdpPrev: median(gdp23),
    growingCount: gdp24.filter((v) => v > 3).length,
    total: gdp24.length,
    medianInf: median(inf24),
    highInfCount: inf24.filter((v) => v > 8).length,
    medianDebt: median(debt24),
  };
}

interface CardProps {
  title: string;
  value: string;
  sub: string;
  trend?: "up" | "down" | "warn" | null;
  trendLabel?: string;
  icon: React.ReactNode;
  barColor: string;
  isLoading?: boolean;
}

function KpiCard({ title, value, sub, trend, trendLabel, icon, barColor, isLoading }: CardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl p-5 animate-pulse" style={{ background: "var(--bg-card)", border: "1px solid var(--bg-border)" }}>
        <div className="skeleton h-2.5 rounded w-28 mb-5" />
        <div className="skeleton h-8 rounded w-20 mb-3" />
        <div className="skeleton h-2.5 rounded w-40" />
      </div>
    );
  }

  const trendMeta: Record<string, { color: string; symbol: string }> = {
    up:   { color: "#10B981", symbol: "▲" },
    down: { color: "#EF4444", symbol: "▼" },
    warn: { color: "#F59E0B", symbol: "⚠" },
  };
  const meta = trend ? trendMeta[trend] : null;

  return (
    <div
      className="rounded-xl p-5 relative overflow-hidden group transition-all duration-200 animate-count-up"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--bg-border)",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--bg-card-raised)";
        (e.currentTarget as HTMLElement).style.borderColor = "#2A3A58";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(0,0,0,.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border)";
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
      }}
    >
      {/* Barre colorée en haut */}
      <div className={`absolute top-0 inset-x-0 h-[3px] ${barColor} opacity-90`} />

      {/* Reflet subtil */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <span
          className="text-[10px] font-mono font-semibold uppercase tracking-widest leading-tight"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </span>
        <span
          className="transition-colors duration-200"
          style={{ color: "var(--text-disabled)" }}
        >
          {icon}
        </span>
      </div>

      {/* Valeur principale */}
      <div className="flex items-baseline gap-2.5 mb-2">
        <span
          className="text-3xl font-extrabold font-mono tabular-nums tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
        {meta && trendLabel && (
          <span
            className="text-[11px] font-mono font-semibold flex items-center gap-0.5"
            style={{ color: meta.color }}
          >
            {meta.symbol} {trendLabel}
          </span>
        )}
      </div>

      {/* Sous-texte */}
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {sub}
      </p>
    </div>
  );
}

export function HeroKPIs() {
  const { isLoading, isFallback, medianGdp, medianGdpPrev, growingCount, total, medianInf, highInfCount, medianDebt } =
    useAggregates();

  const gdpTrend = medianGdp >= medianGdpPrev ? "up" : "down";

  return (
    <div className="space-y-1">
      {isFallback && (
        <p className="text-[10px] font-mono text-amber-400/60 text-right pr-1">
          ⚠ Données de démonstration · FMI WEO Oct 2024
        </p>
      )}
    <div className="grid grid-cols-4 gap-4">
      <KpiCard
        title="Croissance PIB médiane"
        value={`${medianGdp.toFixed(1)}%`}
        sub={`Afrique · 54 économies · 2024e`}
        trend={gdpTrend}
        trendLabel={`${medianGdpPrev.toFixed(1)}% en 2023`}
        icon={<TrendingUp size={14} />}
        barColor="bg-[#00D4AA]"
        isLoading={isLoading}
      />
      <KpiCard
        title="Pays en forte croissance"
        value={String(growingCount || "—")}
        sub={`${total ? Math.round((growingCount / total) * 100) : 0}% des pays affichent >3% · 2024e`}
        trend="up"
        trendLabel={`/ ${total} pays`}
        icon={<Globe size={14} />}
        barColor="bg-blue-500"
        isLoading={isLoading}
      />
      <KpiCard
        title="Inflation médiane"
        value={`${medianInf.toFixed(1)}%`}
        sub={`${highInfCount} pays avec inflation >8% — risque élevé`}
        trend={medianInf > 8 ? "warn" : null}
        icon={<BarChart3 size={14} />}
        barColor={medianInf > 8 ? "bg-amber-500" : "bg-green-500"}
        isLoading={isLoading}
      />
      <KpiCard
        title="Dette publique médiane"
        value={`${medianDebt.toFixed(0)}%`}
        sub="Médiane Afrique · % du PIB · 2024e"
        trend={medianDebt > 60 ? "warn" : null}
        trendLabel={medianDebt > 60 ? "Seuil DSA >60%" : undefined}
        icon={<Landmark size={14} />}
        barColor={medianDebt > 60 ? "bg-red-500" : "bg-purple-500"}
        isLoading={isLoading}
      />
    </div>
    </div>
  );
}
