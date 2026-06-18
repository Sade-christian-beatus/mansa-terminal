"use client";

import Image from "next/image";
import { ISO3_TO_ISO2, type BadgeInfo } from "./data";

const GREEN = "#10B981";
const RED = "#EF4444";

/**
 * Mini-courbe SVG légère (sans recharts) — adaptée à un usage massif en cellules
 * de tableau. `points` est une liste de valeurs ; `area` active un dégradé.
 */
export function Sparkline({
  points, color, width = 56, height = 18, area = false, strokeWidth = 1.4,
}: {
  points: number[]; color: string; width?: number; height?: number; area?: boolean; strokeWidth?: number;
}) {
  if (!points || points.length < 2) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const rng = max - min || 1;
  const step = width / (points.length - 1);
  const pad = area ? 1.5 : 0.5;
  const usable = height - pad * 2;
  const coords = points.map((p, i) => [i * step, height - pad - ((p - min) / rng) * usable] as const);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const gid = `spk-${Math.round(coords[0][1] * 100)}-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }} aria-hidden>
      {area && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gid})`} stroke="none" />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
    </svg>
  );
}

/** Barre de score MANSA (0–100) avec valeur — utilisée dans la colonne Risque. */
export function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: 46, height: 6, background: "color-mix(in srgb, var(--text-muted) 22%, transparent)" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span className="font-mono font-semibold text-xs" style={{ color, fontVariantNumeric: "tabular-nums" }}>{score}</span>
    </div>
  );
}

/**
 * Couleur de fond "heatmap" d'une cellule selon la position de la valeur dans
 * la plage de la colonne. `invert` pour les indicateurs où "bas = mieux".
 * Renvoie `undefined` autour de la médiane (cellule neutre).
 */
export function heatBg(v: number, lo: number, hi: number, invert = false): string | undefined {
  if (hi === lo) return undefined;
  let t = (v - lo) / (hi - lo);
  t = Math.max(0, Math.min(1, t));
  if (invert) t = 1 - t;
  if (Math.abs(t - 0.5) < 0.06) return undefined;
  const a = 0.22;
  if (t > 0.5) return `rgba(16,185,129,${(a * (t - 0.5) * 2).toFixed(3)})`;
  return `rgba(239,68,68,${(a * (0.5 - t) * 2).toFixed(3)})`;
}

export { GREEN as SPARK_GREEN, RED as SPARK_RED };

/** Drapeau pays (flagcdn — largeur fixe valide). */
export function Flag({ iso3, w = 26, h = 18 }: { iso3: string; w?: number; h?: number }) {
  const iso2 = ISO3_TO_ISO2[iso3];
  if (!iso2) return <span style={{ fontSize: h }}>🌍</span>;
  return (
    <Image
      src={`https://flagcdn.com/w160/${iso2}.png`}
      alt={iso3}
      width={w}
      height={h}
      unoptimized
      className="rounded-sm object-cover flex-shrink-0 shadow-sm"
      style={{ width: w, height: h }}
    />
  );
}

/** Pastille de performance composite (🟢🟡🟠🔴). */
export function PerfBadge({ badge, showLabel = false }: { badge: BadgeInfo; showLabel?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{
        background: `color-mix(in srgb, ${badge.color} 14%, transparent)`,
        color: badge.color,
        border: `1px solid color-mix(in srgb, ${badge.color} 35%, transparent)`,
      }}
      title={`${badge.label} · score ${badge.score}/100`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
      {showLabel ? badge.label : badge.score}
    </span>
  );
}
