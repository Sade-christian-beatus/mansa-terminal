"use client";

export { TopCountriesTable } from "./AfricaHeatmap";

import { useRouter } from "next/navigation";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { macroApi } from "@/lib/api";

const SPARKLINE_COUNTRIES = [
  { id: "NGA", name: "Nigeria",      flag: "🇳🇬" },
  { id: "ZAF", name: "South Africa", flag: "🇿🇦" },
  { id: "EGY", name: "Egypt",        flag: "🇪🇬" },
  { id: "KEN", name: "Kenya",        flag: "🇰🇪" },
  { id: "ETH", name: "Ethiopia",     flag: "🇪🇹" },
];

function SparklineCard({ country }: { country: typeof SPARKLINE_COUNTRIES[0] }) {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["sparkline", country.id],
    queryFn: () =>
      macroApi.getCountryMacro(country.id, {
        indicators: "NGDP_RPCH",
        from_year: 2018,
        to_year: 2024,
      }),
    staleTime: 1000 * 60 * 60,
  });

  const chartData = (data?.indicators?.NGDP_RPCH || []).map((p: { period: string; value: number }) => ({
    year: p.period,
    value: p.value,
  }));

  const latest = chartData[chartData.length - 1]?.value;
  const isPositive = (latest ?? 0) >= 0;

  return (
    <div
      onClick={() => router.push(`/countries/${country.id}`)}
      className="mansa-card mansa-card-hover rounded-xl p-4 cursor-pointer
                 hover:border-[#00D4AA]/40 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{country.flag}</span>
          <span className="text-sm font-medium text-white">{country.name}</span>
        </div>
        {!isLoading && (
          <span className={`text-sm font-bold font-mono ${
            isPositive ? "text-emerald-400" : "text-red-400"
          }`}>
            {isPositive ? "+" : ""}{latest?.toFixed(1) ?? "–"}%
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="h-12 skeleton rounded" />
      ) : (
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#00D4AA" : "#EF4444"}
              strokeWidth={1.5}
              dot={false}
            />
            <Tooltip
              contentStyle={{
                background: "#141B2E",
                border: "1px solid #1E2A42",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ color: "#94A3B8" }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "Croissance PIB"]}
              labelFormatter={(l) => `Année: ${l}`}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <p className="text-[10px] text-gray-600 mt-2">
        Croissance PIB réel · FMI WEO
      </p>
    </div>
  );
}

export function CountrySparklines() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
        Top Économies — Tendance croissance PIB
      </h2>
      <div className="grid grid-cols-5 gap-4">
        {SPARKLINE_COUNTRIES.map((c) => (
          <SparklineCard key={c.id} country={c} />
        ))}
      </div>
    </div>
  );
}
