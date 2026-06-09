"use client";

import { useState, useMemo } from "react";
import { Database, Search, Filter, CheckCircle2, Clock, Lock, Download } from "lucide-react";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";
import {
  INDICATOR_CATALOG,
  THEMES,
  type ThemeId,
  type IndicatorDef,
} from "@/lib/indicator-catalog";

const PHASE_CONFIG = {
  1: { label: "Phase 1 · Disponible", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2 },
  2: { label: "Phase 2 · En cours",   color: "text-amber-400 bg-amber-400/10 border-amber-400/20",   icon: Clock },
  3: { label: "Phase 3 · Planifié",   color: "text-gray-500 bg-gray-500/10 border-gray-500/20",      icon: Lock },
} as const;

const API_BADGE: Record<string, { label: string; color: string }> = {
  yes:     { label: "API libre",   color: "text-emerald-400 bg-emerald-400/10" },
  partial: { label: "Partielle",   color: "text-amber-400 bg-amber-400/10" },
  no:      { label: "Non dispo",   color: "text-red-400 bg-red-400/10" },
  paid:    { label: "Payante",     color: "text-blue-400 bg-blue-400/10" },
};

const THEME_COLORS: Record<ThemeId, string> = {
  real_sector: "#00D4AA",
  fiscal_debt: "#3B82F6",
  external:    "#F59E0B",
  financial:   "#8B5CF6",
  mining:      "#EF4444",
  climate:     "#10B981",
  social:      "#EC4899",
  private:     "#06B6D4",
  trade:       "#F97316",
};

function IndicatorRow({ ind }: { ind: IndicatorDef }) {
  const phase = PHASE_CONFIG[ind.phase];
  const api   = API_BADGE[ind.api] ?? API_BADGE.no;
  const PhaseIcon = phase.icon;

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 items-center
                    px-4 py-3 border-b border-[#1E2A42] hover:bg-[#141B2E]
                    transition-colors text-sm group">
      <div>
        <p className="text-gray-200 font-medium group-hover:text-white transition-colors">
          {ind.name_fr}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">{ind.name_en}</p>
      </div>
      <div>
        <p className="text-gray-400 text-xs font-medium">{ind.source_primary}</p>
        {ind.sources_secondary.length > 0 && (
          <p className="text-gray-700 text-xs mt-0.5 truncate">
            +{ind.sources_secondary[0]}
          </p>
        )}
      </div>
      <span className="text-xs text-gray-500">{ind.frequency}</span>
      <span className="text-xs text-gray-500">{ind.lag}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${api.color}`}>
        {api.label}
      </span>
      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border w-fit ${phase.color}`}>
        <PhaseIcon size={10} />
        {ind.phase === 1 ? "Dispo" : `Phase ${ind.phase}`}
      </span>
    </div>
  );
}

export default function IndicatorsPage() {
  const [search, setSearch]               = useState("");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId | "all">("all");
  const [selectedPhase, setSelectedPhase] = useState<1 | 2 | 3 | 0>(0);
  const [exportOpen,    setExportOpen]    = useState(false);

  const themes = Object.entries(THEMES) as [ThemeId, (typeof THEMES)[ThemeId]][];

  const filtered = useMemo(() => {
    return INDICATOR_CATALOG.filter((ind) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        ind.name_fr.toLowerCase().includes(q) ||
        ind.name_en.toLowerCase().includes(q) ||
        ind.id.toLowerCase().includes(q) ||
        ind.source_primary.toLowerCase().includes(q) ||
        ind.use_case.toLowerCase().includes(q);
      const matchTheme = selectedTheme === "all" || ind.theme === selectedTheme;
      const matchPhase = selectedPhase === 0 || ind.phase === selectedPhase;
      return matchSearch && matchTheme && matchPhase;
    });
  }, [search, selectedTheme, selectedPhase]);

  const byTheme = useMemo(() => {
    const map = new Map<ThemeId, IndicatorDef[]>();
    for (const ind of filtered) {
      if (!map.has(ind.theme)) map.set(ind.theme, []);
      map.get(ind.theme)!.push(ind);
    }
    return map;
  }, [filtered]);

  const phase1Count = INDICATOR_CATALOG.filter((i) => i.phase === 1).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <Database size={22} style={{ color: "var(--mansa-green)" }} />
            Catalogue des indicateurs
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {INDICATOR_CATALOG.length} indicateurs · 9 domaines thématiques · 54 pays africains
            · IMF · World Bank · WHO · ILO · FAO · EIA · NASA · EM-DAT · UN Comtrade
          </p>
        </div>

        {/* Stats phases + export */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExportOpen(true)}
            className="mansa-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            <Download size={12} /> Exporter
          </button>
          {([1, 2, 3] as const).map((ph) => {
            const cnt = INDICATOR_CATALOG.filter((i) => i.phase === ph).length;
            const cfg = PHASE_CONFIG[ph];
            const Icon = cfg.icon;
            return (
              <button
                key={ph}
                onClick={() => setSelectedPhase(selectedPhase === ph ? 0 : ph)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs
                           font-medium transition-all ${
                             selectedPhase === ph
                               ? cfg.color
                               : "text-gray-500 border-[#1E2A42] hover:border-gray-600"
                           }`}
              >
                <Icon size={11} />
                Phase {ph} — {cnt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barre de couverture */}
      <div className="mansa-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
          <span>Couverture Phase 1 : {phase1Count}/{INDICATOR_CATALOG.length} indicateurs disponibles</span>
          <span className="font-mono text-[#00D4AA]">
            {Math.round((phase1Count / INDICATOR_CATALOG.length) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-[#1E2A42] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00D4AA] to-[#3B82F6] rounded-full transition-all"
            style={{ width: `${(phase1Count / INDICATOR_CATALOG.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 bg-[#0F1629] border border-[#1E2A42]
                        rounded-lg px-3 py-2 max-w-sm">
          <Search size={14} className="text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un indicateur, une source..."
            className="bg-transparent text-sm text-gray-300 placeholder-gray-600
                       focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-gray-500" />
          <button
            onClick={() => setSelectedTheme("all")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedTheme === "all"
                ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                : "bg-[#0F1629] border border-[#1E2A42] text-gray-400 hover:text-gray-200"
            }`}
          >
            Tous
          </button>
          {themes.map(([id, theme]) => (
            <button
              key={id}
              onClick={() => setSelectedTheme(selectedTheme === id ? "all" : id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedTheme === id
                  ? "border"
                  : "bg-[#0F1629] border border-[#1E2A42] text-gray-400 hover:text-gray-200"
              }`}
              style={
                selectedTheme === id
                  ? {
                      backgroundColor: `${THEME_COLORS[id]}15`,
                      color: THEME_COLORS[id],
                      borderColor: `${THEME_COLORS[id]}40`,
                    }
                  : undefined
              }
            >
              {theme.name_fr}
            </button>
          ))}
        </div>
      </div>

      {/* Résultats */}
      <div className="text-xs text-gray-600 pb-1">
        {filtered.length} indicateur{filtered.length !== 1 ? "s" : ""} affiché{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* Tableau par thème */}
      {filtered.length === 0 ? (
        <div className="mansa-card rounded-xl p-8 text-center text-gray-500 text-sm">
          Aucun indicateur trouvé pour &quot;{search}&quot;
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byTheme.entries()).map(([themeId, indicators]) => {
            const theme = THEMES[themeId];
            const color = THEME_COLORS[themeId];
            return (
              <div key={themeId} className="mansa-card rounded-xl overflow-hidden">
                {/* Entête thème */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-[#1E2A42]"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-white">
                      {theme.name_fr}
                    </h2>
                    <span className="text-xs text-gray-500">
                      {indicators.length} indicateur{indicators.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${PHASE_CONFIG[theme.phase].color}`}
                  >
                    {PHASE_CONFIG[theme.phase].label}
                  </span>
                </div>

                {/* En-têtes colonnes */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4
                                px-4 py-2 border-b border-[#1E2A42] bg-[#080E1C]">
                  {["Indicateur", "Source", "Fréquence", "Décalage", "API", "Statut"].map((h) => (
                    <span key={h} className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                      {h}
                    </span>
                  ))}
                </div>

                {/* Lignes */}
                {indicators.map((ind) => (
                  <IndicatorRow key={ind.id} ind={ind} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs pb-4" style={{ color: "var(--text-muted)" }}>
        Sources : FMI WEO/IFS/GFS · Banque Mondiale WDI/PIP · WHO GHO · ILO ILOSTAT · FAO FAOSTAT ·
        EIA International · NASA VIIRS · EM-DAT CRED · UN Comtrade · IMF PortWatch ·
        OECD DAC · IPC/CH · BCEAO · BEAC · MANSA Terminal Research
      </p>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={async (_sources, _yFrom, _yTo): Promise<ExportRow[]> =>
          filtered.map((ind) => ({
            id: ind.id,
            nom_fr: ind.name_fr,
            name_en: ind.name_en,
            theme: ind.theme,
            source_primaire: ind.source_primary,
            frequence: ind.frequency,
            decalage: ind.lag,
            api: ind.api,
            phase: ind.phase,
            cas_usage: ind.use_case,
          }))
        }
        defaultFilename="mansa-indicators-catalog"
        title="Exporter le catalogue"
        subtitle={`${filtered.length} indicateurs sélectionnés`}
      />
    </div>
  );
}
