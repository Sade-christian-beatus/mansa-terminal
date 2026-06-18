"use client";

import { useState } from "react";
import { X, Download, FileText, FileJson, FileSpreadsheet, Printer, Check, Loader2 } from "lucide-react";
import { exportData, ExportFormat, ExportRow } from "@/lib/export-utils";

export interface DataSource {
  id: string;
  label: string;
  badge: string;
  badgeClass: string;
  description: string;
  available: boolean;
}

export const ALL_DATA_SOURCES: DataSource[] = [
  { id: "IMF",           label: "IMF WEO / IFS / GFS",      badge: "IMF",       badgeClass: "source-badge-imf",      description: "PIB, inflation, balance fiscale, dette, compte courant",   available: true  },
  { id: "WorldBank",     label: "World Bank WDI",            badge: "WB",        badgeClass: "source-badge-wb",       description: "70 indicateurs : santé, éducation, gouvernance, énergie",  available: true  },
  { id: "WorldBank_PIP", label: "World Bank PIP",            badge: "PIP",       badgeClass: "source-badge-wb",       description: "Pauvreté $2.15/jour, coefficient GINI",                     available: true  },
  { id: "ILO_ILOSTAT",   label: "ILO ILOSTAT",               badge: "ILO",       badgeClass: "source-badge-ilo",      description: "Chômage, participation, emploi informel",                   available: true  },
  { id: "FAO_FAOSTAT",   label: "FAO FAOSTAT",               badge: "FAO",       badgeClass: "source-badge-fao",      description: "Production alimentaire, sécurité nutritionnelle",           available: true  },
  { id: "WHO_GHO",       label: "WHO Global Health Obs.",    badge: "WHO",       badgeClass: "source-badge-who",      description: "VIH, paludisme, tuberculose, mortalité",                    available: true  },
  { id: "ClimateWatch_WRI", label: "Climate Watch (WRI)",   badge: "CW",        badgeClass: "source-badge-mansa",    description: "Émissions GHG, NDC, secteur énergétique",                  available: true  },
  { id: "OECD_DAC",      label: "OECD DAC CRS",              badge: "OECD",      badgeClass: "source-badge-comtrade", description: "Aide publique au développement nette",                      available: true  },
  { id: "EIA_International", label: "EIA International",    badge: "EIA",       badgeClass: "source-badge-eia",      description: "Production pétrole, gaz, charbon, électricité",             available: true  },
  { id: "NASA_VIIRS",    label: "NASA VIIRS Nightlights",    badge: "NASA",      badgeClass: "source-badge-nasa",     description: "Indice lumière nocturne — proxy activité économique",       available: true  },
  { id: "EMDAT_CRED",    label: "EM-DAT (CRED)",             badge: "EM-DAT",    badgeClass: "source-badge-emdat",    description: "Catastrophes naturelles — décès, affectés, dommages",       available: true  },
  { id: "UN_Comtrade",   label: "UN Comtrade",               badge: "TRAD",      badgeClass: "source-badge-comtrade", description: "Exports, imports, balance commerciale",                     available: true  },
  { id: "IMF_PortWatch", label: "IMF PortWatch",             badge: "PORT",      badgeClass: "source-badge-imf",      description: "Trafic maritime, appels de navires par port",               available: true  },
  { id: "IPC_CH",        label: "IPC / CH Food Security",    badge: "IPC",       badgeClass: "source-badge-fao",      description: "Insécurité alimentaire aiguë Phase 3+",                     available: true  },
  { id: "Google_Trends", label: "Google Trends",             badge: "GTREND",    badgeClass: "source-badge-mansa",    description: "Proxy activité économique — recherches en ligne",           available: true  },
  { id: "MANSA_Research", label: "MANSA Research",           badge: "MANSA",     badgeClass: "source-badge-mansa",    description: "Rapports et données propriétaires MANSA Terminal",         available: true  },
];

const FORMATS: { id: ExportFormat; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "csv",  label: "CSV",   icon: FileText,        desc: "Compatible avec tous les tableurs" },
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet, desc: "Format Microsoft Excel (.xlsx)"    },
  { id: "json", label: "JSON",  icon: FileJson,        desc: "Format structuré pour API / dev"   },
  { id: "pdf",  label: "PDF",   icon: Printer,         desc: "Rapport imprimable"                },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i);

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-filtered data ready to export (all periods, all sources) */
  getData: (sources: string[], yearFrom: number, yearTo: number) => Promise<ExportRow[]>;
  defaultFilename?: string;
  title?: string;
  subtitle?: string;
  preSelectedSources?: string[];
}

export function ExportModal({
  isOpen,
  onClose,
  getData,
  defaultFilename = "mansa-export",
  title = "Exporter les données",
  subtitle = "Choisissez vos sources, la période et le format",
  preSelectedSources,
}: ExportModalProps) {
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(preSelectedSources ?? ALL_DATA_SOURCES.filter((s) => s.available).map((s) => s.id))
  );
  const [yearFrom, setYearFrom] = useState(2015);
  const [yearTo,   setYearTo]   = useState(CURRENT_YEAR);
  const [format,   setFormat]   = useState<ExportFormat>("csv");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  if (!isOpen) return null;

  const toggleSource = (id: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSources.size === ALL_DATA_SOURCES.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(ALL_DATA_SOURCES.map((s) => s.id)));
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const rows = await getData(Array.from(selectedSources), yearFrom, yearTo);
      const filename = `${defaultFilename}-${yearFrom}-${yearTo}`;
      exportData(rows, format, filename, title, subtitle);
      setDone(true);
      setTimeout(() => { setDone(false); onClose(); }, 1500);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden animate-fade-in"
        style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
             style={{ borderColor: "var(--bg-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)" }}>
              <Download size={17} style={{ color: "var(--mansa-green)" }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}>
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* ── Sélecteur de sources ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Sources de données
              </h3>
              <button
                onClick={toggleAll}
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--mansa-green)" }}
              >
                {selectedSources.size === ALL_DATA_SOURCES.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_DATA_SOURCES.map((src) => {
                const checked = selectedSources.has(src.id);
                return (
                  <button
                    key={src.id}
                    onClick={() => toggleSource(src.id)}
                    disabled={!src.available}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-150"
                    style={{
                      background: checked ? "color-mix(in srgb, var(--mansa-green) 8%, transparent)" : "var(--input-bg)",
                      borderColor: checked ? "var(--mansa-green)" : "var(--input-border)",
                      opacity: src.available ? 1 : 0.4,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center mt-0.5 flex-shrink-0 transition-all"
                      style={{
                        background: checked ? "var(--mansa-green)" : "var(--bg-border)",
                        border: `1px solid ${checked ? "var(--mansa-green)" : "var(--text-muted)"}`,
                      }}
                    >
                      {checked && <Check size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {src.label}
                        </span>
                        <span className={src.badgeClass}>{src.badge}</span>
                      </div>
                      <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>
                        {src.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Période ── */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Période</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>De</label>
                <select
                  value={yearFrom}
                  onChange={(e) => setYearFrom(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                >
                  {YEARS.slice().reverse().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="text-lg mt-4" style={{ color: "var(--text-muted)" }}>→</div>
              <div className="flex-1">
                <label className="text-xs mb-1 block" style={{ color: "var(--text-muted)" }}>À</label>
                <select
                  value={yearTo}
                  onChange={(e) => setYearTo(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Format ── */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Format d&apos;export</h3>
            <div className="grid grid-cols-4 gap-2">
              {FORMATS.map((f) => {
                const Icon    = f.icon;
                const active  = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150"
                    style={{
                      background: active ? "color-mix(in srgb, var(--mansa-green) 10%, transparent)" : "var(--input-bg)",
                      borderColor: active ? "var(--mansa-green)" : "var(--input-border)",
                    }}
                  >
                    <Icon size={18} style={{ color: active ? "var(--mansa-green)" : "var(--text-secondary)" }} />
                    <span className="text-xs font-bold" style={{ color: active ? "var(--mansa-green)" : "var(--text-primary)" }}>
                      {f.label}
                    </span>
                    <span className="text-[10px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>
                      {f.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between"
             style={{ borderColor: "var(--bg-border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {selectedSources.size} source{selectedSources.size > 1 ? "s" : ""} · {yearFrom}–{yearTo} · Format {format.toUpperCase()}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="mansa-btn-ghost text-sm px-4 py-2"
            >
              Annuler
            </button>
            <button
              onClick={handleExport}
              disabled={loading || selectedSources.size === 0}
              className="mansa-btn-primary text-sm px-5 py-2 min-w-[120px] justify-center"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : done ? (
                <><Check size={15} /> Exporté !</>
              ) : (
                <><Download size={15} /> Exporter</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
