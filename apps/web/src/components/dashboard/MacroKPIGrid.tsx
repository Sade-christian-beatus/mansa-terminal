"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { macroApi } from "@/lib/api";

const KEY_COUNTRIES = [
  { id: "NGA", name: "Nigeria",      flag: "🇳🇬" },
  { id: "ZAF", name: "South Africa", flag: "🇿🇦" },
  { id: "KEN", name: "Kenya",        flag: "🇰🇪" },
  { id: "GHA", name: "Ghana",        flag: "🇬🇭" },
  { id: "SEN", name: "Sénégal",      flag: "🇸🇳" },
];

function TrendIcon({ value }: { value: number | null }) {
  if (!value) return <Minus size={12} className="text-gray-500" />;
  if (value > 0) return <TrendingUp size={12} className="text-emerald-400" />;
  return <TrendingDown size={12} className="text-red-400" />;
}

function formatValue(value: number | null, unit: string): string {
  if (value === null || value === undefined) return "N/A";
  if (unit === "%") return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (unit === "USD_BN") return `$${value.toFixed(0)}B`;
  if (unit === "USD") return `$${value.toLocaleString()}`;
  return `${value.toFixed(1)}`;
}

function CountryKPICard({ country }: { country: typeof KEY_COUNTRIES[0] }) {
  const router = useRouter();

  const query = useQuery({
    queryKey: ["macro", country.id, "kpi"],
    queryFn: () =>
      macroApi.getCountryMacro(country.id, {
        indicators: "NGDP_RPCH,PCPIPCH,GGXCNL_NGDP",
        from_year: 2023,
        to_year: 2024,
      }),
    staleTime: 1000 * 60 * 30,
  });

  const data = query.data?.indicators;
  const gdpGrowth = data?.NGDP_RPCH?.[data?.NGDP_RPCH?.length - 1];
  const inflation = data?.PCPIPCH?.[data?.PCPIPCH?.length - 1];
  const fiscal    = data?.GGXCNL_NGDP?.[data?.GGXCNL_NGDP?.length - 1];

  return (
    <div
      onClick={() => router.push(`/countries/${country.id}`)}
      className="mansa-card mansa-card-hover rounded-xl p-4 cursor-pointer
                 hover:border-[#00D4AA]/40 transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{country.flag}</span>
        <div>
          <div className="text-sm font-semibold text-white group-hover:text-[#00D4AA]">
            {country.name}
          </div>
          <div className="text-xs text-gray-500">{country.id}</div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-4 skeleton rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Croissance PIB</span>
            <div className="flex items-center gap-1">
              <TrendIcon value={gdpGrowth?.value ?? null} />
              <span className={`text-xs font-mono font-medium ${
                (gdpGrowth?.value ?? 0) > 0 ? "text-emerald-400" : "text-red-400"
              }`}>
                {formatValue(gdpGrowth?.value ?? null, "%")}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Inflation</span>
            <span className={`text-xs font-mono font-medium ${
              (inflation?.value ?? 0) > 10
                ? "text-red-400"
                : (inflation?.value ?? 0) > 5
                ? "text-amber-400"
                : "text-emerald-400"
            }`}>
              {formatValue(inflation?.value ?? null, "%")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Solde budg.</span>
            <span className={`text-xs font-mono font-medium ${
              (fiscal?.value ?? 0) < -3 ? "text-red-400" : "text-gray-300"
            }`}>
              {formatValue(fiscal?.value ?? null, "%")}
            </span>
          </div>
        </div>
      )}

      <p className="text-[10px] text-[#00D4AA]/50 mt-3 text-right">
        Voir le profil →
      </p>
    </div>
  );
}

export function MacroKPIGrid() {
  return (
    <div className="grid grid-cols-5 gap-4">
      {KEY_COUNTRIES.map((country) => (
        <CountryKPICard key={country.id} country={country} />
      ))}
    </div>
  );
}
