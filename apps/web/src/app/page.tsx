"use client";

import { useState } from "react";
import {
  Search, Calendar, Download, Zap,
  Flame, Droplets, Satellite, Anchor, TrendingUp,
  Globe2, Activity, BarChart3, RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api";
import { MacroKPIGrid }        from "@/components/dashboard/MacroKPIGrid";
import { MacroTable }          from "@/components/macro-table/MacroTable";
import { MarketTicker }        from "@/components/dashboard/MarketTicker";
import { HeroKPIs }            from "@/components/dashboard/HeroKPIs";
import { CommandPalette }      from "@/components/dashboard/CommandPalette";
import { ExportModal }         from "@/components/common/ExportModal";
import type { ExportRow }      from "@/lib/export-utils";

const HF_ALERTS = [
  { flag: "🇪🇹", country: "Éthiopie",   msg: "Conflit +34%",   color: "#EF4444", icon: Flame    },
  { flag: "🇰🇪", country: "Kenya",      msg: "Inondations",     color: "#F59E0B", icon: Droplets },
  { flag: "🇳🇬", country: "Nigeria",    msg: "NGN –8.2%",       color: "#EF4444", icon: Zap      },
  { flag: "🇸🇴", country: "Somalie",    msg: "IPC Phase 3+",   color: "#F97316", icon: Flame    },
  { flag: "🇪🇬", country: "Égypte",     msg: "Port –12%",      color: "#6366F1", icon: Anchor   },
  { flag: "🇨🇩", country: "RD Congo",   msg: "NLI +6.8pts",    color: "#10B981", icon: Satellite},
];

/* ── KPI stats pour la hero section ── */
const PLATFORM_STATS = [
  { label: "Économies africaines", value: "54",    icon: Globe2,    color: "#00D4AA" },
  { label: "Indicateurs disponibles", value: "141", icon: BarChart3, color: "#3B82F6" },
  { label: "Sources de données", value: "14",      icon: Activity,  color: "#8B5CF6" },
  { label: "Mise à jour quotidienne", value: "FMI · BM", icon: RefreshCw, color: "#F59E0B" },
];

function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
}

export default function DashboardPage() {
  const [exportOpen, setExportOpen] = useState(false);

  const now = new Date().toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleExport = async (sources: string[], yFrom: number, yTo: number): Promise<ExportRow[]> => {
    try {
      const resp = await api.get(
        `/macro/export?sources=${sources.join(",")}&year_from=${yFrom}&year_to=${yTo}`
      );
      return resp.data ?? [];
    } catch {
      return [];
    }
  };

  return (
    <>
      <CommandPalette />

      {/* Market ticker full-bleed */}
      <div className="-mx-6 -mt-6">
        <MarketTicker />
      </div>

      <div className="mt-5 space-y-5 animate-fade-in">

        {/* ── Hero Header — Slogan MANSA + actions ── */}
        <div
          className="rounded-2xl px-6 py-5 border relative overflow-hidden"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          {/* Logo MANSA en fond — watermark visible */}
          <div className="absolute inset-0 flex items-center justify-end pointer-events-none select-none pr-10 opacity-[0.18]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-44 w-auto object-contain"
                 style={{ filter: "sepia(1) saturate(2) hue-rotate(5deg) brightness(1.4)" }} />
          </div>
          {/* Gradient subtil à gauche pour lisibilité du texte */}
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: "linear-gradient(to right, var(--card-bg) 55%, transparent 85%)" }} />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              {/* Badge LIVE */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--mansa-green)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--mansa-green)" }}>
                  Live · {now}
                </span>
              </div>

              {/* Titre — accroche produit */}
              <h1 className="text-2xl font-bold tracking-tight leading-snug max-w-xl"
                  style={{ color: "var(--text-primary)" }}>
                La plateforme qui transforme les{" "}
                <span style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  données africaines
                </span>{" "}
                en décisions stratégiques.
              </h1>

              {/* Slogan */}
              <p className="text-sm mt-2 font-medium italic"
                 style={{ color: "var(--mansa-green)", opacity: 0.85 }}>
                &ldquo;Comprendre l&apos;Afrique. Décider avec confiance.&rdquo;
              </p>
            </div>

            {/* Stats plateforme */}
            <div className="flex items-center gap-3 flex-wrap">
              {PLATFORM_STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label}
                       className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                       style={{ background: `color-mix(in srgb, ${stat.color} 8%, var(--card-bg))`, borderColor: `color-mix(in srgb, ${stat.color} 25%, transparent)` }}>
                    <Icon size={13} style={{ color: stat.color }} />
                    <div>
                      <div className="text-sm font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="text-[9px] mt-0.5 leading-none" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contrôles */}
          <div className="relative mt-4 flex items-center gap-2 flex-wrap">
            {/* Barre de recherche */}
            <button
              onClick={openCommandPalette}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg border transition-colors hover:border-[var(--mansa-green)]"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }}
            >
              <Search size={11} />
              Recherche pays, indicateurs...
              <kbd className="text-[10px] border rounded px-1 ml-1"
                   style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>⌃K</kbd>
            </button>

            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg border transition-all mansa-btn-ghost"
            >
              <Download size={11} />
              Exporter
            </button>

            <div className="flex items-center gap-1 text-[10px] font-mono ml-auto"
                 style={{ color: "var(--text-muted)" }}>
              <Calendar size={10} />
              {now}
            </div>
          </div>
        </div>

        {/* ── Barre signaux HF ── */}
        <div
          className="rounded-xl px-4 py-2.5 flex items-center gap-2 overflow-x-auto border"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#EF4444" }} />
            <span className="text-xs font-semibold" style={{ color: "#EF4444" }}>LIVE HF</span>
          </div>
          {HF_ALERTS.map((a) => {
            const Icon = a.icon;
            return (
              <a
                key={a.country}
                href="/signals"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0 text-[11px] font-medium transition-all hover:scale-105 cursor-pointer"
                style={{ background: `color-mix(in srgb, ${a.color} 10%, transparent)`, color: a.color, textDecoration: "none" }}
              >
                <span>{a.flag}</span>
                <Icon size={10} />
                <span>{a.country}</span>
                <span className="opacity-80 font-normal">{a.msg}</span>
              </a>
            );
          })}
          <a href="/signals" className="ml-auto flex-shrink-0 text-xs flex items-center gap-1 hover:underline"
             style={{ color: "var(--mansa-green)" }}>
            Tous les signaux <TrendingUp size={10} />
          </a>
        </div>

        {/* ── Hero KPIs ── */}
        <HeroKPIs />

        {/* ── Grille KPI macro ── */}
        <MacroKPIGrid />

        {/* ── Module Macroeconomic Table ── */}
        <MacroTable />

        {/* ── Sources actives ── */}
        <div className="rounded-xl px-4 py-3 border" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--mansa-green)" }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sources intégrées</span>
            </div>
            {[
              { label: "FMI WEO",           cls: "source-badge-imf"      },
              { label: "Banque Mondiale",    cls: "source-badge-wb"       },
              { label: "OMS GHO",           cls: "source-badge-who"      },
              { label: "OIT",               cls: "source-badge-ilo"      },
              { label: "FAO",               cls: "source-badge-fao"      },
              { label: "EIA",               cls: "source-badge-eia"      },
              { label: "NASA VIIRS",        cls: "source-badge-nasa"     },
              { label: "EM-DAT",            cls: "source-badge-emdat"    },
              { label: "UN Comtrade",       cls: "source-badge-comtrade" },
              { label: "FMI PortWatch",     cls: "source-badge-imf"      },
              { label: "IPC/CH",            cls: "source-badge-fao"      },
              { label: "OCDE DAC",          cls: "source-badge-comtrade" },
              { label: "BM PIP",            cls: "source-badge-wb"       },
              { label: "MANSA Research",    cls: "source-badge-mansa"    },
            ].map((s) => (
              <span key={s.label} className={s.cls}>{s.label}</span>
            ))}
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExport}
        defaultFilename="mansa-dashboard"
        title="Exporter les données du dashboard"
        subtitle="Toutes les sources macro · 54 pays africains"
      />
    </>
  );
}
