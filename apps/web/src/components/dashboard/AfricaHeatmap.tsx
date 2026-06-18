"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { WORLD_TOPO, NUM_TO_ISO3, AFRICAN_NUMERIC } from "@/lib/africa-geo";

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

function getColor(value: number | null, min: number, max: number): string {
  if (value === null) return "#1A1300";
  if (value >= 0) {
    const t = max > 0 ? Math.min(value / max, 1) : 0;
    const a = Math.round((0.25 + t * 0.75) * 255).toString(16).padStart(2, "0");
    return `#0ea5a0${a}`;
  }
  const t = min < 0 ? Math.min(Math.abs(value) / Math.abs(min), 1) : 0;
  const a = Math.round((0.25 + t * 0.75) * 255).toString(16).padStart(2, "0");
  return `#EF4444${a}`;
}

interface TooltipState {
  x: number;
  y: number;
  content: string;
}

export function AfricaHeatmap({ data, indicator, year, isLoading }: AfricaHeatmapProps) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const dataByIso3 = useMemo(() => {
    const m = new Map<string, HeatmapEntry>();
    for (const d of data) m.set(d.country_id, d);
    return m;
  }, [data]);

  const { min, max } = useMemo(() => {
    const vals = data.filter((d) => d.value !== null).map((d) => d.value as number);
    if (vals.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 0) };
  }, [data]);

  if (isLoading) {
    return (
      <div className="mansa-card rounded-xl p-4 h-96">
        <div className="h-4 w-48 skeleton rounded mb-4" />
        <div className="h-80 skeleton rounded-lg" />
      </div>
    );
  }

  return (
    <div className="mansa-card rounded-xl p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Afrique — {indicator} · {year}
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{data.length} pays</span>
      </div>

      {/* Tooltip flottant */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg px-3 py-2 text-xs shadow-xl whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, background: "var(--dropdown-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}
        >
          {tooltip.content}
        </div>
      )}

      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 340, center: [22, 3] }}
          width={500}
          height={500}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
            <Geographies geography={WORLD_TOPO}>
              {({ geographies }: { geographies: any[] }) =>
                geographies
                  .filter((geo: any) => AFRICAN_NUMERIC.has(String(geo.id).padStart(3, "0")))
                  .map((geo: any) => {
                    const numId = String(geo.id).padStart(3, "0");
                    const iso3  = NUM_TO_ISO3[numId];
                    const entry = iso3 ? dataByIso3.get(iso3) : undefined;
                    const color = getColor(entry?.value ?? null, min, max);

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={color}
                        stroke="#0F1629"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: "none", cursor: iso3 ? "pointer" : "default" },
                          hover:   { outline: "none", fill: "#0ea5a099" },
                          pressed: { outline: "none" },
                        }}
                        onMouseMove={(evt: React.MouseEvent) => {
                          const rect = (evt.currentTarget as SVGElement)
                            .closest("div")
                            ?.getBoundingClientRect();
                          const x = rect ? evt.clientX - rect.left : evt.clientX;
                          const y = rect ? evt.clientY - rect.top  : evt.clientY;
                          const val = entry?.value;
                          setTooltip({
                            x, y,
                            content: entry
                              ? `${entry.flag} ${entry.country_name} : ${
                                  val !== null && val !== undefined
                                    ? `${val > 0 ? "+" : ""}${val.toFixed(1)}%`
                                    : "N/D"
                                }`
                              : iso3 ?? "",
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          if (iso3) router.push(`/countries/${iso3}`);
                        }}
                      />
                    );
                  })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Légende */}
      <div className="flex items-center justify-between mt-1 px-1">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 rounded bg-gradient-to-r from-red-500/20 to-red-500" />
          <span className="text-xs text-gray-600">Négatif</span>
        </div>
        <span className="text-xs text-gray-700">Cliquer sur un pays</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Positif</span>
          <div className="w-16 h-2 rounded bg-gradient-to-r from-[#0ea5a0]/20 to-[#0ea5a0]" />
        </div>
      </div>
    </div>
  );
}


// ─── TopCountriesTable ────────────────────────────────────────────────────────

interface TopCountriesTableProps {
  data: HeatmapEntry[];
  indicator: string;
  isLoading?: boolean;
}

export function TopCountriesTable({ data, indicator, isLoading }: TopCountriesTableProps) {
  const router = useRouter();

  const sorted = [...data]
    .filter((d) => d.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  if (isLoading) {
    return (
      <div className="mansa-card rounded-xl p-4 h-96">
        <div className="h-4 w-48 skeleton rounded mb-4" />
        {[1, 2, 3, 4, 5].map((k) => (
          <div key={k} className="h-10 skeleton rounded mb-2" />
        ))}
      </div>
    );
  }

  const absMax = Math.max(...sorted.map((d) => Math.abs(d.value ?? 0)), 1);

  return (
    <div className="mansa-card rounded-xl p-4 h-full flex flex-col">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Classement — {indicator}
      </h3>
      <div className="space-y-1 overflow-y-auto flex-1">
        {sorted.map((d, i) => {
          const barWidth  = (Math.abs(d.value ?? 0) / absMax) * 100;
          const isPositive = (d.value ?? 0) >= 0;

          return (
            <div
              key={d.country_id}
              onClick={() => router.push(`/countries/${d.country_id}`)}
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg mansa-card-hover transition-colors cursor-pointer group"
            >
              <span className="text-xs w-5 text-right font-mono" style={{ color: "var(--text-muted)" }}>
                {i + 1}
              </span>
              <span className="text-sm">{d.flag}</span>
              <span className="text-xs w-20 truncate transition-colors" style={{ color: "var(--text-secondary)" }}>
                {d.country_name}
              </span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: isPositive ? "var(--mansa-green)" : "#EF4444",
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
