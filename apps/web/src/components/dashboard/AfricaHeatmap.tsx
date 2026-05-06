"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

// GeoJSON monde Natural Earth — on filtre uniquement les pays africains
const WORLD_TOPO =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO-3166 numeric → ISO-3 (pays africains uniquement)
const NUM_TO_ISO3: Record<string, string> = {
  "012": "DZA", "024": "AGO", "204": "BEN", "072": "BWA", "854": "BFA",
  "108": "BDI", "132": "CPV", "120": "CMR", "140": "CAF", "148": "TCD",
  "174": "COM", "180": "COD", "178": "COG", "384": "CIV", "262": "DJI",
  "818": "EGY", "226": "GNQ", "232": "ERI", "231": "ETH", "266": "GAB",
  "270": "GMB", "288": "GHA", "324": "GIN", "624": "GNB", "404": "KEN",
  "426": "LSO", "430": "LBR", "434": "LBY", "450": "MDG", "454": "MWI",
  "466": "MLI", "478": "MRT", "480": "MUS", "504": "MAR", "508": "MOZ",
  "516": "NAM", "562": "NER", "566": "NGA", "646": "RWA", "678": "STP",
  "686": "SEN", "694": "SLE", "706": "SOM", "710": "ZAF", "728": "SSD",
  "729": "SDN", "748": "SWZ", "834": "TZA", "768": "TGO", "788": "TUN",
  "800": "UGA", "894": "ZMB", "716": "ZWE",
};

const AFRICAN_NUMERIC = new Set(Object.keys(NUM_TO_ISO3));

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
  if (value === null) return "#1E2A42";
  if (value >= 0) {
    const t = max > 0 ? Math.min(value / max, 1) : 0;
    const a = Math.round((0.25 + t * 0.75) * 255).toString(16).padStart(2, "0");
    return `#00D4AA${a}`;
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
        <h3 className="text-sm font-semibold text-white">
          Afrique — {indicator} · {year}
        </h3>
        <span className="text-xs text-gray-500">{data.length} pays</span>
      </div>

      {/* Tooltip flottant */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 bg-[#141B2E] border
                     border-[#1E2A42] rounded-lg px-3 py-2 text-xs text-gray-200
                     shadow-xl whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
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
                          hover:   { outline: "none", fill: "#00D4AA99" },
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
          <div className="w-16 h-2 rounded bg-gradient-to-r from-[#00D4AA]/20 to-[#00D4AA]" />
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
      <h3 className="text-sm font-semibold text-white mb-4">
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
              className="flex items-center gap-3 py-1.5 px-2 rounded-lg
                         hover:bg-[#141B2E] transition-colors cursor-pointer group"
            >
              <span className="text-xs text-gray-600 w-5 text-right font-mono">
                {i + 1}
              </span>
              <span className="text-sm">{d.flag}</span>
              <span className="text-xs text-gray-300 w-20 truncate
                               group-hover:text-white transition-colors">
                {d.country_name}
              </span>
              <div className="flex-1 h-1.5 bg-[#1E2A42] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${barWidth}%`,
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
