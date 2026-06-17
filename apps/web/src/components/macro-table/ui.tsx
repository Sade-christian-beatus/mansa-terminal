"use client";

import Image from "next/image";
import { ISO3_TO_ISO2, type BadgeInfo } from "./data";

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
