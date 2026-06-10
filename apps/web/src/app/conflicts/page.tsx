"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ConflictEvent {
  country_id: string;
  name: string;
  flag: string;
  region: string;
  events_2024: number;
  fatalities_2024: number;
  trend: string;
  trend_label: string;
  risk_level: string;
  risk_color: string;
  active_groups: string[];
  type_breakdown: Record<string, number>;
  notes: string;
}

interface ConflictSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total_events_2024: number;
  total_fatalities_2024: number;
  countries_covered: number;
}

const RISK_LABELS: Record<string, string> = {
  critical: "Critique",
  high:     "Élevé",
  medium:   "Modéré",
  low:      "Faible",
};

export default function ConflictsPage() {
  const [riskFilter, setRiskFilter]   = useState<string | null>(null);
  const [sortBy, setSortBy]           = useState<"fatalities_2024" | "events_2024">("fatalities_2024");
  const [expanded, setExpanded]       = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conflicts", riskFilter, sortBy],
    queryFn:  () => api.get(`/acled/events?sort_by=${sortBy}${riskFilter ? `&risk_level=${riskFilter}` : ""}&limit=54`).then(r => r.data),
    staleTime: 1000 * 60 * 30,
  });

  const events:  ConflictEvent[] = data?.events  ?? [];
  const summary: ConflictSummary = data?.summary  ?? { critical: 0, high: 0, medium: 0, low: 0, total_events_2024: 0, total_fatalities_2024: 0, countries_covered: 0 };

  const chartData = events.slice(0, 12).map(e => ({
    name:    e.flag + " " + e.name.split(" ")[0],
    value:   sortBy === "fatalities_2024" ? e.fatalities_2024 : e.events_2024,
    color:   e.risk_color,
  }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <ShieldAlert size={22} style={{ color: "#EF4444" }} />
            Conflits & Risques sécuritaires
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Source : ACLED (Armed Conflict Location & Event Data) · Données 2024 · {summary.countries_covered} pays
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-lg border"
                style={{ background: "color-mix(in srgb, #EF4444 8%, var(--card-bg))", borderColor: "color-mix(in srgb, #EF4444 25%, transparent)", color: "#EF4444" }}>
            ⚠ Données synthétiques — API ACLED live en Phase 2
          </span>
        </div>
      </div>

      {/* ── Cartes résumé ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pays niveau Critique",   value: summary.critical,               color: "#EF4444", key: "critical" },
          { label: "Pays niveau Élevé",      value: summary.high,                   color: "#F97316", key: "high" },
          { label: "Événements (2024)",      value: summary.total_events_2024?.toLocaleString("fr-FR"), color: "var(--mansa-green)", key: null },
          { label: "Décès estimés (2024)",   value: summary.total_fatalities_2024?.toLocaleString("fr-FR"), color: "#F59E0B", key: null },
        ].map(card => (
          <button
            key={card.label}
            onClick={() => card.key ? setRiskFilter(riskFilter === card.key ? null : card.key) : undefined}
            className={`mansa-card rounded-2xl p-4 text-left transition-all ${card.key ? "cursor-pointer hover:opacity-80" : ""}`}
            style={riskFilter === card.key ? { borderColor: card.color, borderWidth: 2 } : {}}
          >
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.key && (
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                {riskFilter === card.key ? "Cliquer pour tout afficher" : "Cliquer pour filtrer"}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* ── Graphique ── */}
      <div className="mansa-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Top 12 pays — {sortBy === "fatalities_2024" ? "Décès estimés" : "Événements"} 2024
          </h3>
          <div className="flex gap-2">
            {(["fatalities_2024", "events_2024"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="text-xs px-3 py-1 rounded-lg border transition-all"
                style={sortBy === s
                  ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                  : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }
                }
              >
                {s === "fatalities_2024" ? "Décès" : "Événements"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                   tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={60} />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString("fr-FR"), sortBy === "fatalities_2024" ? "Décès" : "Événements"]}
              contentStyle={{ background: "var(--dropdown-bg)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 11 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Risque :</span>
        {[null, "critical", "high", "medium", "low"].map(level => (
          <button
            key={level ?? "all"}
            onClick={() => setRiskFilter(level)}
            className="px-3 py-1 text-xs rounded-full border transition-all font-medium"
            style={riskFilter === level
              ? {
                  background: level ? `color-mix(in srgb, ${["critical","high","medium","low"].includes(level!) ? {"critical":"#EF4444","high":"#F97316","medium":"#F59E0B","low":"#10B981"}[level!] : "var(--mansa-green)"} 20%, transparent)` : "var(--mansa-green)",
                  borderColor: level ? {"critical":"#EF4444","high":"#F97316","medium":"#F59E0B","low":"#10B981"}[level!] : "var(--mansa-green)",
                  color: level ? {"critical":"#EF4444","high":"#F97316","medium":"#F59E0B","low":"#10B981"}[level!] : "#000",
                }
              : { background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }
            }
          >
            {level ? RISK_LABELS[level] : "Tous"}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{events.length} pays affichés</span>
      </div>

      {/* ── Liste pays ── */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)
          : events.map(event => {
              const isOpen = expanded === event.country_id;
              const TrendIcon = event.trend === "increasing" ? TrendingUp : event.trend === "decreasing" ? TrendingDown : Minus;
              const trendColor = event.trend === "increasing" ? "#EF4444" : event.trend === "decreasing" ? "#10B981" : "#F59E0B";

              return (
                <div key={event.country_id} className="mansa-card rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    onClick={() => setExpanded(isOpen ? null : event.country_id)}
                  >
                    {/* Niveau de risque */}
                    <div className="w-2.5 h-10 rounded-full flex-shrink-0"
                         style={{ background: event.risk_color }} />

                    <span className="text-2xl">{event.flag}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {event.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: `color-mix(in srgb, ${event.risk_color} 15%, transparent)`, color: event.risk_color }}>
                          {RISK_LABELS[event.risk_level]}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{event.region}</span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {event.notes}
                      </p>
                    </div>

                    <div className="hidden md:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Événements</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {event.events_2024.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Décès estimés</p>
                        <p className="text-sm font-bold" style={{ color: "#EF4444" }}>
                          {event.fatalities_2024.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{ color: trendColor }}>
                        <TrendIcon size={13} />
                        {event.trend_label}
                      </div>
                    </div>

                    {isOpen ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                  </button>

                  {/* ── Détails expandables ── */}
                  {isOpen && (
                    <div className="px-6 pb-4 border-t space-y-4" style={{ borderColor: "var(--card-border)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {/* Type d'événements */}
                        <div>
                          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                            Types d'incidents (%)
                          </p>
                          <div className="space-y-1.5">
                            {Object.entries(event.type_breakdown).map(([type, pct]) => (
                              <div key={type} className="flex items-center gap-2">
                                <div className="w-28 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                                  {type.replace(/_/g, " ")}
                                </div>
                                <div className="flex-1 h-2 rounded-full" style={{ background: "var(--bg-border)" }}>
                                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: event.risk_color }} />
                                </div>
                                <span className="text-xs w-8 text-right" style={{ color: "var(--text-primary)" }}>{pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Groupes armés actifs */}
                        <div>
                          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                            <Users size={10} className="inline mr-1" />Groupes armés actifs
                          </p>
                          {event.active_groups.length > 0
                            ? event.active_groups.map((g, i) => (
                                <div key={i} className="flex items-start gap-2 mb-1.5">
                                  <span className="text-xs mt-0.5" style={{ color: event.risk_color }}>▸</span>
                                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{g}</span>
                                </div>
                              ))
                            : <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun groupe armé actif identifié.</p>
                          }
                        </div>
                      </div>

                      {/* Note d'analyse */}
                      <div className="rounded-lg px-3 py-2.5 text-xs"
                           style={{ background: "var(--bg-border)", color: "var(--text-secondary)" }}>
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Analyse :</span>{" "}
                        {event.notes}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      <p className="text-xs text-center pb-2" style={{ color: "var(--text-muted)" }}>
        Données basées sur ACLED Annual Report 2024 · Pour les données live, configurer ACLED_API_KEY dans .env
      </p>
    </div>
  );
}
