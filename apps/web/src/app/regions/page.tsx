"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, MinusCircle, RefreshCw, TrendingUp, Globe2,
} from "lucide-react";
import { macroApi } from "@/lib/api";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";

type Zone = "UEMOA" | "CEMAC" | "SSA";

const ZONE_CONFIG = {
  UEMOA: {
    label: "UEMOA",
    fullName: "Union Économique et Monétaire Ouest-Africaine",
    currency: "XOF (Franc CFA)",
    bank: "BCEAO",
    countries: ["SEN", "CIV", "MLI", "BFA", "NER", "TGO", "BEN", "GNB"],
    color: "#00D4AA",
    description: "8 pays d'Afrique de l'Ouest partageant le franc CFA XOF",
  },
  CEMAC: {
    label: "CEMAC",
    fullName: "Communauté Économique et Monétaire de l'Afrique Centrale",
    currency: "XAF (Franc CFA)",
    bank: "BEAC",
    countries: ["CMR", "TCD", "CAF", "COG", "GAB", "GNQ"],
    color: "#8B5CF6",
    description: "6 pays d'Afrique Centrale partageant le franc CFA XAF",
  },
  SSA: {
    label: "Afrique Subsaharienne",
    fullName: "Afrique Subsaharienne (hors Afrique du Nord)",
    currency: "Multi-devises",
    bank: "Multiple banques centrales",
    countries: [],
    color: "#F59E0B",
    description: "Vue d'ensemble de l'Afrique subsaharienne",
  },
};

const INDICATOR_LABELS: Record<string, { label: string; unit: string }> = {
  NGDP_RPCH:    { label: "Croissance PIB", unit: "%" },
  PCPIPCH:      { label: "Inflation",       unit: "%" },
  GGXCNL_NGDP: { label: "Solde budgétaire",unit: "% PIB" },
  GGXWDG_NGDP: { label: "Dette publique",  unit: "% PIB" },
  BCA_NGDPD:   { label: "Compte courant",  unit: "% PIB" },
  NGDPDPC:     { label: "PIB/habitant",    unit: "USD" },
  LUR:         { label: "Chômage",         unit: "%" },
  GGR_NGDP:   { label: "Recettes",        unit: "% PIB" },
};

function StatusIcon({ status }: { status: "ok" | "breach" | "no_data" }) {
  if (status === "ok")      return <CheckCircle2 size={15} color="#00D4AA" />;
  if (status === "breach")  return <XCircle size={15} color="#ef4444" />;
  return <MinusCircle size={15} color="#6b7280" />;
}

function IndicatorCell({ value }: { value: number | undefined }) {
  if (value === undefined || value === null)
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const formatted = Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toFixed(1);
  return <span>{formatted}</span>;
}

export default function RegionsPage() {
  const [zone, setZone] = useState<Zone>("UEMOA");
  const [year, setYear] = useState(2024);

  const { data, isLoading } = useQuery({
    queryKey: ["region", zone, year],
    queryFn: () => macroApi.getRegion(zone, year),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const config = ZONE_CONFIG[zone];
  const countries = data?.countries ?? [];
  const criteria  = data?.convergence_criteria ?? {};
  const isLive    = data ? countries.length > 0 : false;

  // Stats de convergence
  const criteriaKeys = Object.keys(criteria);
  const compliance = criteriaKeys.length > 0
    ? countries.map((c: any) => {
        const ok = criteriaKeys.filter((k) => c.convergence?.[k] === "ok").length;
        return { ...c, compliant: ok, total: criteriaKeys.length };
      })
    : countries;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Analyse Régionale
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Critères de convergence et agrégats macro par zone monétaire
          </p>
        </div>
        <DataSourceBadge isLive={isLive} />
      </div>

      {/* Onglets zones */}
      <div className="flex gap-2">
        {(["UEMOA", "CEMAC", "SSA"] as Zone[]).map((z) => {
          const cfg = ZONE_CONFIG[z];
          const isActive = zone === z;
          return (
            <button
              key={z}
              onClick={() => setZone(z)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: isActive
                  ? `color-mix(in srgb, ${cfg.color} 15%, transparent)`
                  : "var(--card-bg)",
                color: isActive ? cfg.color : "var(--text-muted)",
                border: `1px solid ${isActive ? cfg.color : "var(--bg-border)"}`,
              }}
            >
              {cfg.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Année :
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-2 py-1 rounded-lg text-xs"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
          >
            {[2024, 2023, 2022, 2021].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Infos zone */}
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: `color-mix(in srgb, ${config.color} 6%, var(--card-bg))`,
          borderColor: `color-mix(in srgb, ${config.color} 20%, var(--bg-border))`,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: config.color }}>{config.fullName}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{config.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Monnaie</div>
            <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{config.currency}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Banque centrale : {config.bank}</div>
          </div>
        </div>

        {/* Critères de convergence */}
        {criteriaKeys.length > 0 && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: `color-mix(in srgb, ${config.color} 20%, var(--bg-border))` }}>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              CRITÈRES DE CONVERGENCE {zone}
            </div>
            <div className="flex flex-wrap gap-2">
              {criteriaKeys.map((k) => (
                <span
                  key={k}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--bg-border)" }}
                >
                  {criteria[k].label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tableau des pays */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--card-bg)" }} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--bg-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--bg-border)" }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>Pays</th>
                  {criteriaKeys.length > 0 && (
                    <th className="px-4 py-3 text-center font-semibold" style={{ color: "var(--text-muted)" }}>
                      Convergence
                    </th>
                  )}
                  {["NGDP_RPCH", "PCPIPCH", "GGXCNL_NGDP", "GGXWDG_NGDP", "BCA_NGDPD"].map((code) => (
                    <th key={code} className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text-muted)" }}>
                      {INDICATOR_LABELS[code]?.label ?? code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compliance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                      <Globe2 size={32} className="mx-auto mb-2 opacity-30" />
                      Aucune donnée — lancez le pipeline Dagster pour charger les données réelles
                    </td>
                  </tr>
                ) : (
                  compliance.map((country: any, idx: number) => (
                    <tr
                      key={country.country_id}
                      style={{
                        borderBottom: idx < compliance.length - 1 ? "1px solid var(--bg-border)" : "none",
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{country.flag}</span>
                          <div>
                            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{country.name}</div>
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{country.country_id}</div>
                          </div>
                        </div>
                      </td>

                      {criteriaKeys.length > 0 && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {criteriaKeys.map((k) => (
                              <StatusIcon key={k} status={country.convergence?.[k] ?? "no_data"} />
                            ))}
                          </div>
                          <div className="text-[10px] text-center mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {country.compliant ?? 0}/{country.total ?? criteriaKeys.length} critères
                          </div>
                        </td>
                      )}

                      {["NGDP_RPCH", "PCPIPCH", "GGXCNL_NGDP", "GGXWDG_NGDP", "BCA_NGDPD"].map((code) => {
                        const val = country.indicators?.[code];
                        const isNeg = val !== undefined && val < 0;
                        return (
                          <td
                            key={code}
                            className="px-4 py-3 text-right font-semibold tabular-nums"
                            style={{
                              color: val === undefined
                                ? "var(--text-muted)"
                                : isNeg ? "#ef4444" : "var(--text-primary)",
                            }}
                          >
                            <IndicatorCell value={val} />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Note */}
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Source : MANSA Database · FMI WEO {year} · Critères de convergence officiels {zone}.
        Les valeurs négatives sont affichées en rouge.
      </p>
    </div>
  );
}
