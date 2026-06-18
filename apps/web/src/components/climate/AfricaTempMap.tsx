"use client";

import { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { WORLD_TOPO, AFRICAN_NUMERIC, geoToIso3 } from "@/lib/africa-geo";

/** Région NASA POWER de chaque pays africain. */
const REGION_OF: Record<string, string> = {
  // North Africa
  DZA: "North", EGY: "North", LBY: "North", MAR: "North", TUN: "North",
  // West Africa
  BEN: "West", BFA: "West", CPV: "West", CIV: "West", GMB: "West", GHA: "West",
  GIN: "West", GNB: "West", LBR: "West", MLI: "West", MRT: "West", NER: "West",
  NGA: "West", SEN: "West", SLE: "West", TGO: "West",
  // Central Africa
  AGO: "Central", CMR: "Central", CAF: "Central", TCD: "Central", COG: "Central",
  COD: "Central", GNQ: "Central", GAB: "Central", STP: "Central",
  // East Africa
  BDI: "East", COM: "East", DJI: "East", ERI: "East", ETH: "East", KEN: "East",
  MDG: "East", MWI: "East", MUS: "East", RWA: "East", SYC: "East", SOM: "East",
  SSD: "East", SDN: "East", TZA: "East", UGA: "East",
  // Southern Africa
  BWA: "South", LSO: "South", MOZ: "South", NAM: "South", ZAF: "South",
  SWZ: "South", ZMB: "South", ZWE: "South",
};

interface RegionInfo { label: string; temp: number; precip: number }

const REGION_INFO: Record<string, RegionInfo> = {
  North:   { label: "Afrique du Nord",    temp: 38, precip: 2 },
  West:    { label: "Afrique de l'Ouest", temp: 32, precip: 180 },
  Central: { label: "Afrique Centrale",   temp: 28, precip: 220 },
  East:    { label: "Afrique de l'Est",   temp: 24, precip: 45 },
  South:   { label: "Afrique Australe",   temp: 14, precip: 30 },
};

/** Échelle bleu (froid) → rouge (chaud) sur 12–40 °C. */
function tempColor(temp: number): string {
  const stops: [number, string][] = [
    [12, "#3B82F6"], [18, "#22D3EE"], [24, "#10B981"],
    [28, "#F59E0B"], [34, "#F97316"], [40, "#EF4444"],
  ];
  if (temp <= stops[0][0]) return stops[0][1];
  if (temp >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (temp >= t0 && temp <= t1) {
      const f = (temp - t0) / (t1 - t0);
      const lerp = (a: string, b: string) => {
        const ai = parseInt(a.slice(1), 16), bi = parseInt(b.slice(1), 16);
        const ar = ai >> 16, ag = (ai >> 8) & 255, ab = ai & 255;
        const br = bi >> 16, bg = (bi >> 8) & 255, bb = bi & 255;
        const r = Math.round(ar + (br - ar) * f);
        const g = Math.round(ag + (bg - ag) * f);
        const b2 = Math.round(ab + (bb - ab) * f);
        return `rgb(${r},${g},${b2})`;
      };
      return lerp(c0, c1);
    }
  }
  return stops[stops.length - 1][1];
}

interface TooltipState { x: number; y: number; content: string }

/** Choroplèthe de température par grande région africaine (NASA POWER). */
export function AfricaTempMap() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  return (
    <div className="mansa-card rounded-xl p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Carte thermique régionale
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>°C · juin</span>
      </div>

      {tooltip && (
        <div className="pointer-events-none absolute z-50 rounded-lg px-3 py-2 text-xs shadow-xl whitespace-nowrap"
             style={{ left: tooltip.x + 12, top: tooltip.y - 8, background: "var(--dropdown-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}>
          {tooltip.content}
        </div>
      )}

      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <ComposableMap projection="geoMercator" projectionConfig={{ scale: 340, center: [22, 3] }}
                       width={500} height={500} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={WORLD_TOPO}>
            {({ geographies }: { geographies: any[] }) =>
              geographies
                .filter((geo: any) => AFRICAN_NUMERIC.has(String(geo.id).padStart(3, "0")))
                .map((geo: any) => {
                  const iso3 = geoToIso3(geo.id);
                  const reg = iso3 ? REGION_OF[iso3] : undefined;
                  const info = reg ? REGION_INFO[reg] : undefined;
                  const fill = info ? tempColor(info.temp) : "color-mix(in srgb, var(--text-muted) 14%, transparent)";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="var(--card-bg)"
                      strokeWidth={0.4}
                      style={{
                        default: { outline: "none", opacity: info ? 0.9 : 0.4 },
                        hover:   { outline: "none", opacity: 1 },
                        pressed: { outline: "none" },
                      }}
                      onMouseMove={(evt: React.MouseEvent) => {
                        if (!info) { setTooltip(null); return; }
                        const rect = (evt.currentTarget as SVGElement).closest("div")?.getBoundingClientRect();
                        const x = rect ? evt.clientX - rect.left : evt.clientX;
                        const y = rect ? evt.clientY - rect.top : evt.clientY;
                        setTooltip({ x, y, content: `${info.label} · ${info.temp}°C · ${info.precip} mm` });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Légende d'échelle */}
      <div className="flex items-center gap-2 mt-1 px-1">
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>12°C</span>
        <div className="flex-1 h-2 rounded-full"
             style={{ background: "linear-gradient(90deg, #3B82F6, #22D3EE, #10B981, #F59E0B, #F97316, #EF4444)" }} />
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>40°C</span>
      </div>
    </div>
  );
}
