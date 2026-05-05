// ============================================================
// AfricaHeatmap.tsx — Carte choroplèthe Afrique
// ============================================================
"use client";

interface HeatmapEntry {
  country_id: string;
  country_name: string;
  flag: string;
  value: number | null;
}

interface AfricaHeatmapProps {
  data: HeatmapEntry[];
  indicator: string;
  year: number;
  isLoading?: boolean;
}

export function AfricaHeatmap({
  data, indicator, year, isLoading
}: AfricaHeatmapProps) {
  if (isLoading) {
    return (
      <div className="mansa-card rounded-xl p-4 h-80">
        <div className="h-4 w-48 skeleton rounded mb-4" />
        <div className="h-64 skeleton rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mansa-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          Africa — {indicator} · {year}
        </h3>
        <span className="text-xs text-gray-500">{data.length} pays</span>
      </div>

      {/* Grid simplifié en attendant D3 choroplèthe */}
      <div className="grid grid-cols-6 gap-1.5">
        {data.map((d) => {
          const absMax = Math.max(...data.filter(x => x.value !== null)
            .map(x => Math.abs(x.value!)));
          const intensity = d.value !== null ? Math.abs(d.value) / absMax : 0;
          const isPositive = (d.value ?? 0) >= 0;

          return (
            <div
              key={d.country_id}
              title={`${d.country_name}: ${d.value?.toFixed(1) ?? "N/A"}%`}
              className="rounded cursor-pointer transition-transform
                         hover:scale-110 hover:z-10 relative"
              style={{
                backgroundColor: d.value === null
                  ? "#1E2A42"
                  : isPositive
                  ? `rgba(0, 212, 170, ${0.15 + intensity * 0.75})`
                  : `rgba(239, 68, 68, ${0.15 + intensity * 0.75})`,
                height: "36px",
              }}
            >
              <div className="absolute inset-0 flex flex-col items-center
                              justify-center p-0.5">
                <span className="text-[10px] leading-tight text-center
                                 font-mono text-white/80">
                  {d.country_id}
                </span>
                <span className={`text-[9px] font-bold leading-tight ${
                  isPositive ? "text-emerald-300" : "text-red-300"
                }`}>
                  {d.value !== null ? `${d.value.toFixed(1)}` : "–"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <div className="w-12 h-2 rounded bg-gradient-to-r from-red-500/20
                          to-red-500/90" />
          <span className="text-xs text-gray-600">Négatif</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Positif</span>
          <div className="w-12 h-2 rounded bg-gradient-to-r from-[#00D4AA]/20
                          to-[#00D4AA]/90" />
        </div>
      </div>
    </div>
  );
}


// ============================================================
// TopCountriesTable.tsx — Classement des pays
// ============================================================

interface TopCountriesTableProps {
  data: HeatmapEntry[];
  indicator: string;
  isLoading?: boolean;
}

export function TopCountriesTable({
  data, indicator, isLoading
}: TopCountriesTableProps) {
  const sorted = [...data]
    .filter((d) => d.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  if (isLoading) {
    return (
      <div className="mansa-card rounded-xl p-4 h-80">
        <div className="h-4 w-48 skeleton rounded mb-4" />
        {[1,2,3,4,5].map(k => (
          <div key={k} className="h-10 skeleton rounded mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="mansa-card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-4">
        Classement — {indicator}
      </h3>
      <div className="space-y-1 overflow-y-auto max-h-72">
        {sorted.map((d, i) => {
          const max = sorted[0]?.value ?? 1;
          const barWidth = ((d.value ?? 0) / max) * 100;
          const isPositive = (d.value ?? 0) >= 0;

          return (
            <div key={d.country_id} className="flex items-center gap-3 py-1.5
                           px-2 rounded-lg hover:bg-[#141B2E] transition-colors
                           cursor-pointer group">
              <span className="text-xs text-gray-600 w-5 text-right
                               font-mono">{i + 1}</span>
              <span className="text-sm">{d.flag}</span>
              <span className="text-xs text-gray-300 w-20 truncate">
                {d.country_name}
              </span>
              <div className="flex-1 h-1.5 bg-[#1E2A42] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.abs(barWidth)}%`,
                    backgroundColor: isPositive ? "#00D4AA" : "#EF4444",
                  }}
                />
              </div>
              <span className={`text-xs font-mono font-semibold w-14 text-right
                               ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {isPositive ? "+" : ""}{d.value?.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
