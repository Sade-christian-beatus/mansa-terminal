"use client";

export { TopCountriesTable } from "./AfricaHeatmap";

import { useRouter } from "next/navigation";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { macroApi } from "@/lib/api";

const SPARKLINE_COUNTRIES = [
  { id: "NGA", name: "Nigeria",        flag: "🇳🇬" },
  { id: "ZAF", name: "Afrique du Sud", flag: "🇿🇦" },
  { id: "EGY", name: "Égypte",         flag: "🇪🇬" },
  { id: "KEN", name: "Kenya",          flag: "🇰🇪" },
  { id: "ETH", name: "Éthiopie",       flag: "🇪🇹" },
];

// Données statiques de croissance PIB 2018-2024 (FMI WEO)
const STATIC_GROWTH: Record<string, { year: string; value: number }[]> = {
  NGA: [
    { year: "2018", value:  1.9 }, { year: "2019", value:  2.2 }, { year: "2020", value: -1.8 },
    { year: "2021", value:  3.6 }, { year: "2022", value:  3.3 }, { year: "2023", value:  2.9 }, { year: "2024", value:  3.1 },
  ],
  ZAF: [
    { year: "2018", value:  0.7 }, { year: "2019", value:  0.3 }, { year: "2020", value: -6.3 },
    { year: "2021", value:  4.9 }, { year: "2022", value:  1.9 }, { year: "2023", value:  0.7 }, { year: "2024", value:  1.1 },
  ],
  EGY: [
    { year: "2018", value:  5.3 }, { year: "2019", value:  5.6 }, { year: "2020", value:  3.6 },
    { year: "2021", value:  3.3 }, { year: "2022", value:  6.6 }, { year: "2023", value:  3.8 }, { year: "2024", value:  2.7 },
  ],
  KEN: [
    { year: "2018", value:  6.3 }, { year: "2019", value:  5.4 }, { year: "2020", value: -0.3 },
    { year: "2021", value:  7.6 }, { year: "2022", value:  4.8 }, { year: "2023", value:  5.6 }, { year: "2024", value:  5.0 },
  ],
  ETH: [
    { year: "2018", value:  7.7 }, { year: "2019", value:  9.0 }, { year: "2020", value:  6.1 },
    { year: "2021", value:  5.6 }, { year: "2022", value:  6.4 }, { year: "2023", value:  7.2 }, { year: "2024", value:  6.8 },
  ],
};

function SparklineCard({ country }: { country: typeof SPARKLINE_COUNTRIES[0] }) {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["sparkline", country.id],
    queryFn: () => macroApi.getCountryMacro(country.id, {
      indicators: "NGDP_RPCH",
      from_year: 2018,
      to_year: 2024,
    }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const apiData = (data?.indicators?.NGDP_RPCH || []).map((p: { period: string; value: number }) => ({
    year: p.period,
    value: p.value,
  }));

  const chartData = apiData.length > 0 ? apiData : (STATIC_GROWTH[country.id] ?? []);
  const isDemo    = apiData.length === 0 && chartData.length > 0;

  const latest     = chartData[chartData.length - 1]?.value;
  const isPositive = (latest ?? 0) >= 0;

  return (
    <div
      onClick={() => router.push(`/countries/${country.id}`)}
      className="mansa-card mansa-card-hover rounded-xl p-4 cursor-pointer transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{country.flag}</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{country.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {isDemo && (
            <span className="text-[9px] px-1 py-0.5 rounded font-bold"
                  style={{ background: "color-mix(in srgb, #F59E0B 15%, transparent)", color: "#F59E0B" }}>
              DEMO
            </span>
          )}
          {!isLoading && (
            <span className="text-sm font-bold font-mono"
                  style={{ color: isPositive ? "#10B981" : "#EF4444" }}>
              {isPositive ? "+" : ""}{latest?.toFixed(1) ?? "–"}%
            </span>
          )}
        </div>
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
                background: "var(--dropdown-bg)",
                border: "1px solid var(--bg-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              itemStyle={{ color: "var(--text-secondary)" }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, "Croissance PIB"]}
              labelFormatter={(l) => `Année: ${l}`}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
        Croissance PIB réel · FMI WEO
      </p>
    </div>
  );
}

export function CountrySparklines() {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
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
