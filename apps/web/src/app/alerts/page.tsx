"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, TrendingDown, TrendingUp, Shield, RefreshCw,
  ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { alertsApi } from "@/lib/api";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";

const SEVERITY_CONFIG = {
  critical: { label: "Critique",  color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  icon: AlertTriangle },
  high:     { label: "Élevé",    color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", icon: TrendingDown  },
  medium:   { label: "Modéré",   color: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)", icon: TrendingUp    },
};

const INDICATOR_LABELS: Record<string, string> = {
  PCPIPCH:        "Inflation IPC",
  GGXCNL_NGDP:   "Solde budgétaire",
  GGXWDG_NGDP:   "Dette publique",
  NGDP_RPCH:      "Croissance PIB",
  BCA_NGDPD:      "Compte courant",
};

interface Alert {
  id: string;
  country_id: string;
  country_name: string;
  flag: string;
  indicator_code: string;
  indicator_label: string;
  value: number;
  unit: string;
  threshold: number;
  severity: "critical" | "high" | "medium";
  message: string;
  period: string;
  generated_at: string;
}

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<string>("critical,high,medium");
  const [year, setYear] = useState(2024);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["macro-alerts", severityFilter, year],
    queryFn: () => alertsApi.getMacroAlerts({ severity: severityFilter, year, limit: 100 }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const alerts: Alert[] = data?.alerts ?? [];
  const summary = data?.summary ?? { critical: 0, high: 0, medium: 0, total: 0 };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Alertes Macro
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Surveillance automatique des seuils critiques — 54 pays africains
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceBadge isLive={data?.is_live ?? false} />
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-secondary)" }}
          >
            <RefreshCw size={12} /> Actualiser
          </button>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { key: "critical", label: "Critiques", value: summary.critical },
          { key: "high",     label: "Élevés",    value: summary.high     },
          { key: "medium",   label: "Modérés",   value: summary.medium   },
          { key: "total",    label: "Total",      value: summary.total    },
        ].map(({ key, label, value }) => {
          const cfg = SEVERITY_CONFIG[key as keyof typeof SEVERITY_CONFIG];
          return (
            <div
              key={key}
              className="rounded-2xl p-4 border"
              style={{
                background: cfg ? cfg.bg : "var(--card-bg)",
                borderColor: cfg ? cfg.border : "var(--bg-border)",
              }}
            >
              <div className="text-3xl font-bold" style={{ color: cfg?.color ?? "var(--text-primary)" }}>
                {isLoading ? "—" : value}
              </div>
              <div className="text-xs mt-1 font-medium" style={{ color: cfg?.color ?? "var(--text-secondary)" }}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <Filter size={12} /> Sévérité :
        </div>
        {[
          { value: "critical,high,medium", label: "Toutes" },
          { value: "critical",             label: "Critique" },
          { value: "critical,high",        label: "Critique + Élevé" },
          { value: "medium",               label: "Modéré" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSeverityFilter(opt.value)}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: severityFilter === opt.value ? "var(--mansa-green)" : "var(--input-bg)",
              color: severityFilter === opt.value ? "#000" : "var(--text-secondary)",
              border: "1px solid var(--input-border)",
            }}
          >
            {opt.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Année :
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
          >
            {[2024, 2023, 2022].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Liste des alertes */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--card-bg)" }} />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          <Shield size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Aucune alerte pour les critères sélectionnés</p>
          <p className="text-sm mt-1">
            {data?.is_live
              ? "Toutes les économies sont dans les seuils normaux."
              : "Lancez le pipeline Dagster pour analyser les données réelles."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.medium;
            const Icon = cfg.icon;
            const isExpanded = expandedId === alert.id;
            return (
              <div
                key={alert.id}
                className="rounded-2xl border transition-all"
                style={{ background: "var(--card-bg)", borderColor: isExpanded ? cfg.color : "var(--bg-border)" }}
              >
                <button
                  className="w-full flex items-center gap-4 px-4 py-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                >
                  {/* Sévérité */}
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    <Icon size={15} />
                  </span>

                  {/* Pays */}
                  <span className="flex items-center gap-2 w-48 flex-shrink-0">
                    <span className="text-xl">{alert.flag}</span>
                    <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {alert.country_name}
                    </span>
                  </span>

                  {/* Indicateur */}
                  <span className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {alert.message}
                  </span>

                  {/* Valeur */}
                  <span className="font-bold text-sm w-24 text-right" style={{ color: cfg.color }}>
                    {alert.value.toFixed(1)}{alert.unit}
                  </span>

                  {/* Badge sévérité */}
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 w-20 text-center"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  >
                    {cfg.label}
                  </span>

                  <span style={{ color: "var(--text-muted)" }}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {isExpanded && (
                  <div
                    className="px-4 pb-4 pt-1 grid grid-cols-3 gap-4 text-xs border-t"
                    style={{ borderColor: "var(--bg-border)" }}
                  >
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Indicateur</div>
                      <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                        {alert.indicator_label} ({alert.indicator_code})
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Valeur observée</div>
                      <div className="font-bold mt-0.5" style={{ color: cfg.color }}>
                        {alert.value.toFixed(2)} {alert.unit}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Seuil d'alerte</div>
                      <div className="font-semibold mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {alert.threshold} {alert.unit}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Année de référence</div>
                      <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                        {alert.period}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Pays</div>
                      <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                        {alert.flag} {alert.country_name} ({alert.country_id})
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-muted)" }}>Source</div>
                      <div className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>
                        MANSA Database · FMI WEO
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
