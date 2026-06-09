"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { macroApi } from "@/lib/api";

// ── Données statiques de fallback (FMI WEO 2024e) ────────────────────────────
const STATIC_MACRO: Record<string, { growth: number; inflation: number; fiscal: number; gdp: number }> = {
  NGA: { growth:  3.1, inflation: 32.5, fiscal: -4.6, gdp: 477  },
  ZAF: { growth:  1.1, inflation:  4.6, fiscal: -5.0, gdp: 381  },
  KEN: { growth:  5.0, inflation:  6.5, fiscal: -5.5, gdp: 110  },
  GHA: { growth:  3.1, inflation: 22.3, fiscal: -4.6, gdp:  77  },
  SEN: { growth:  8.3, inflation:  2.8, fiscal: -4.9, gdp:  32  },
};

const KEY_COUNTRIES = [
  { id: "NGA", name: "Nigeria",        flag: "🇳🇬", region: "Afrique de l'Ouest"  },
  { id: "ZAF", name: "Afrique du Sud", flag: "🇿🇦", region: "Afrique Australe"    },
  { id: "KEN", name: "Kenya",          flag: "🇰🇪", region: "Afrique de l'Est"    },
  { id: "GHA", name: "Ghana",          flag: "🇬🇭", region: "Afrique de l'Ouest"  },
  { id: "SEN", name: "Sénégal",        flag: "🇸🇳", region: "Afrique de l'Ouest"  },
];

function TrendIcon({ value }: { value: number | null }) {
  if (value === null) return <Minus size={12} style={{ color: "var(--text-muted)" }} />;
  if (value > 0)      return <TrendingUp size={12} className="text-emerald-400" />;
  return                     <TrendingDown size={12} className="text-red-400" />;
}

function fmt(v: number | null, unit: string): string {
  if (v === null || v === undefined) return "N/A";
  const prefix = v > 0 ? "+" : "";
  return unit === "%" ? `${prefix}${v.toFixed(1)}%` : `${v.toFixed(1)}`;
}

function CountryKPICard({ country }: { country: typeof KEY_COUNTRIES[0] }) {
  const router = useRouter();

  // Essayer de charger depuis l'API, utiliser les données statiques comme fallback
  const { data, isLoading } = useQuery({
    queryKey: ["macro", country.id, "kpi"],
    queryFn: () => macroApi.getCountryMacro(country.id, {
      indicators: "NGDP_RPCH,PCPIPCH,GGXCNL_NGDP",
      from_year: 2023,
      to_year: 2024,
    }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const apiData = data?.indicators;
  const apiGrowth    = apiData?.NGDP_RPCH?.[apiData.NGDP_RPCH.length - 1]?.value;
  const apiInflation = apiData?.PCPIPCH?.[apiData.PCPIPCH.length - 1]?.value;
  const apiFiscal    = apiData?.GGXCNL_NGDP?.[apiData.GGXCNL_NGDP.length - 1]?.value;

  // Fallback sur données statiques si l'API ne répond pas
  const staticFallback = STATIC_MACRO[country.id];
  const growth    = apiGrowth    ?? staticFallback?.growth    ?? null;
  const inflation = apiInflation ?? staticFallback?.inflation ?? null;
  const fiscal    = apiFiscal    ?? staticFallback?.fiscal    ?? null;
  const gdp       = staticFallback?.gdp ?? null;

  return (
    <div
      onClick={() => router.push(`/countries/${country.id}`)}
      className="mansa-card mansa-card-hover rounded-xl p-4 cursor-pointer transition-all"
      style={{ borderColor: "var(--card-border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{country.flag}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {country.name}
          </div>
          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{country.region}</div>
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-4 skeleton rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Croissance PIB */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Croissance PIB</span>
            <div className="flex items-center gap-1">
              <TrendIcon value={growth} />
              <span className="text-xs font-mono font-bold"
                    style={{ color: (growth ?? 0) >= 4 ? "#10B981" : (growth ?? 0) >= 2 ? "#F59E0B" : "#EF4444" }}>
                {fmt(growth, "%")}
              </span>
            </div>
          </div>

          {/* Inflation */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Inflation IPC</span>
            <span className="text-xs font-mono font-bold"
                  style={{ color: (inflation ?? 0) > 15 ? "#EF4444" : (inflation ?? 0) > 7 ? "#F59E0B" : "#10B981" }}>
              {fmt(inflation, "%")}
            </span>
          </div>

          {/* Solde budgétaire */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Solde budgétaire</span>
            <span className="text-xs font-mono font-bold"
                  style={{ color: (fiscal ?? 0) < -5 ? "#EF4444" : (fiscal ?? 0) < -3 ? "#F59E0B" : "#10B981" }}>
              {fmt(fiscal, "%")}
            </span>
          </div>

          {/* Séparateur + PIB */}
          {gdp !== null && (
            <>
              <div className="border-t" style={{ borderColor: "var(--bg-border)" }} />
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>PIB nominal</span>
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
                  ${gdp.toFixed(0)} Mds
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-[10px] mt-3 text-right" style={{ color: "var(--mansa-green)", opacity: 0.7 }}>
        Voir le profil →
      </p>
    </div>
  );
}

export function MacroKPIGrid() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Économies clés · Indicateurs 2025e
        </h3>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Source : FMI WEO · Banque Mondiale
        </span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {KEY_COUNTRIES.map((country) => (
          <CountryKPICard key={country.id} country={country} />
        ))}
      </div>
    </div>
  );
}
