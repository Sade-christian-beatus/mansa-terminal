"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { WORLD_TOPO, AFRICAN_NUMERIC, geoToIso3 } from "@/lib/africa-geo";

interface MemberMeta {
  name?: string;
  flag?: string;
  /** Valeur de coloration (ex. croissance %) — optionnelle. */
  value?: number;
}

interface RegionMapProps {
  /** Pays membres de la CER (ISO-3). Seuls ceux-ci sont mis en avant. */
  countryIds: string[];
  /** Métadonnées par pays (nom, drapeau, valeur). */
  meta?: Record<string, MemberMeta>;
  /** Couleur d'accent de la CER. */
  color: string;
  /** Libellé de la valeur affichée dans le tooltip (ex. "Croissance"). */
  valueLabel?: string;
  /** Unité de la valeur (ex. "%"). */
  valueUnit?: string;
}

interface TooltipState { x: number; y: number; content: string }

export function RegionMap({ countryIds, meta = {}, color, valueLabel = "Croissance", valueUnit = "%" }: RegionMapProps) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const members = useMemo(() => new Set(countryIds.map((c) => c.toUpperCase())), [countryIds]);

  // Échelle d'intensité sur la valeur des membres (pour la saturation)
  const { min, max } = useMemo(() => {
    const vals = countryIds.map((c) => meta[c]?.value).filter((v): v is number => typeof v === "number");
    if (!vals.length) return { min: 0, max: 1 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [countryIds, meta]);

  const memberFill = (iso3: string): string => {
    const v = meta[iso3]?.value;
    if (typeof v !== "number") return `color-mix(in srgb, ${color} 55%, transparent)`;
    const t = max === min ? 0.6 : (v - min) / (max - min);
    const pct = Math.round((0.35 + t * 0.55) * 100);
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
  };

  return (
    <div className="mansa-card rounded-2xl p-4 relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Carte de la zone
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{members.size} pays</span>
      </div>

      {tooltip && (
        <div className="pointer-events-none absolute z-50 rounded-lg px-3 py-2 text-xs shadow-xl whitespace-nowrap"
             style={{ left: tooltip.x + 12, top: tooltip.y - 8, background: "var(--dropdown-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }}>
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
          <Geographies geography={WORLD_TOPO}>
            {({ geographies }: { geographies: any[] }) =>
              geographies
                .filter((geo: any) => AFRICAN_NUMERIC.has(String(geo.id).padStart(3, "0")))
                .map((geo: any) => {
                  const iso3 = geoToIso3(geo.id);
                  const isMember = !!iso3 && members.has(iso3);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isMember ? memberFill(iso3!) : "color-mix(in srgb, var(--text-muted) 12%, transparent)"}
                      stroke={isMember ? color : "var(--bg-border)"}
                      strokeWidth={isMember ? 0.7 : 0.3}
                      style={{
                        default: { outline: "none", cursor: isMember ? "pointer" : "default", opacity: isMember ? 1 : 0.45 },
                        hover:   { outline: "none", fill: isMember ? color : "color-mix(in srgb, var(--text-muted) 12%, transparent)" },
                        pressed: { outline: "none" },
                      }}
                      onMouseMove={(evt: React.MouseEvent) => {
                        if (!isMember || !iso3) { setTooltip(null); return; }
                        const rect = (evt.currentTarget as SVGElement).closest("div")?.getBoundingClientRect();
                        const x = rect ? evt.clientX - rect.left : evt.clientX;
                        const y = rect ? evt.clientY - rect.top : evt.clientY;
                        const m = meta[iso3];
                        const valStr = typeof m?.value === "number" ? ` · ${valueLabel} ${m.value > 0 ? "+" : ""}${m.value.toFixed(1)}${valueUnit}` : "";
                        setTooltip({ x, y, content: `${m?.flag ?? ""} ${m?.name ?? iso3}${valStr}` });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => { if (isMember && iso3) router.push(`/countries/${iso3}`); }}
                    />
                  );
                })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <div className="flex items-center justify-between mt-1 px-1">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="w-3 h-2 rounded" style={{ background: color }} /> Membres de la zone
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Cliquer pour ouvrir le pays</span>
      </div>
    </div>
  );
}
