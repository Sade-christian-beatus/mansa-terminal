"use client";

import { CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";

interface DataSourceBadgeProps {
  isLive: boolean;
  lastUpdated?: string | null;
  source?: string;
  className?: string;
  size?: "sm" | "md";
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 1) return "Il y a moins d'1h";
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 2) return "Hier";
    if (days < 7) return `Il y a ${days} jours`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function DataSourceBadge({
  isLive,
  lastUpdated,
  source,
  className = "",
  size = "sm",
}: DataSourceBadgeProps) {
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  const iconSize = size === "sm" ? 10 : 12;
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  if (isLive) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium ${textSize} ${padding} ${className}`}
        style={{
          background: "color-mix(in srgb, #00D4AA 12%, transparent)",
          color: "#00D4AA",
          border: "1px solid color-mix(in srgb, #00D4AA 25%, transparent)",
        }}
        title={lastUpdated ? `Mis à jour ${formatRelativeDate(lastUpdated)}` : undefined}
      >
        <CheckCircle2 size={iconSize} />
        <span>Live{source ? ` · ${source}` : ""}</span>
        {lastUpdated && (
          <span style={{ opacity: 0.75 }}>· {formatRelativeDate(lastUpdated)}</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${textSize} ${padding} ${className}`}
      style={{
        background: "color-mix(in srgb, #F59E0B 12%, transparent)",
        color: "#F59E0B",
        border: "1px solid color-mix(in srgb, #F59E0B 25%, transparent)",
      }}
      title="Ces données sont des données de démonstration. Lancez le pipeline Dagster pour charger les données réelles."
    >
      <AlertTriangle size={iconSize} />
      <span>Données démo</span>
    </span>
  );
}

// Version compacte pour les tableaux / cards
export function DataFreshnessPill({
  lastUpdated,
  isLive,
}: {
  lastUpdated?: string | null;
  isLive: boolean;
}) {
  if (!lastUpdated && !isLive) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium"
      style={{ color: "var(--text-muted)" }}
    >
      <Clock size={9} />
      {lastUpdated ? formatRelativeDate(lastUpdated) : "—"}
    </span>
  );
}
