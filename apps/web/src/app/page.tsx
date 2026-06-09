"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, Search, Calendar, Download, Zap,
  Flame, Droplets, Satellite, Anchor,
} from "lucide-react";

import { api } from "@/lib/api";
import { AfricaHeatmap }       from "@/components/dashboard/AfricaHeatmap";
import { TopCountriesTable }   from "@/components/dashboard/CountrySparklines";
import { MacroKPIGrid }        from "@/components/dashboard/MacroKPIGrid";
import { MarketTicker }        from "@/components/dashboard/MarketTicker";
import { HeroKPIs }            from "@/components/dashboard/HeroKPIs";
import { SmartChart }          from "@/components/dashboard/SmartChart";
import { NewsPanel }           from "@/components/dashboard/NewsPanel";
import { CommandPalette }      from "@/components/dashboard/CommandPalette";
import { ExportModal }         from "@/components/common/ExportModal";
import type { ExportRow }      from "@/lib/export-utils";

const INDICATORS = [
  { code: "NGDP_RPCH",    label: "Croissance PIB réel"  },
  { code: "PCPIPCH",      label: "Inflation IPC"         },
  { code: "GGXCNL_NGDP", label: "Solde budgétaire"      },
  { code: "GGXWDG_NGDP", label: "Dette publique"         },
  { code: "BCA_NGDPD",   label: "Compte courant"         },
  { code: "ASSDRESES",   label: "Réserves (mois import)" },
  { code: "LUR",         label: "Chômage"                },
];

/* Signaux HF à afficher dans la barre du dashboard */
const HF_ALERTS = [
  { flag: "🇪🇹", country: "Éthiopie",   msg: "Conflit +34%",   color: "#EF4444", icon: Flame    },
  { flag: "🇰🇪", country: "Kenya",      msg: "Inondations",     color: "#F59E0B", icon: Droplets },
  { flag: "🇳🇬", country: "Nigeria",    msg: "NGN –8.2%",       color: "#EF4444", icon: Zap      },
  { flag: "🇸🇴", country: "Somalie",    msg: "IPC Phase 3+",   color: "#F97316", icon: Flame    },
  { flag: "🇪🇬", country: "Égypte",     msg: "Port –12%",      color: "#6366F1", icon: Anchor   },
  { flag: "🇨🇩", country: "RD Congo",   msg: "NLI +6.8pts",    color: "#10B981", icon: Satellite},
];

function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
}

export default function DashboardPage() {
  const [indicator,   setIndicator]   = useState("NGDP_RPCH");
  const [year,        setYear]        = useState(2024);
  const [exportOpen,  setExportOpen]  = useState(false);

  const { data: heatmap, isLoading: heatmapLoading, refetch, isFetching } = useQuery({
    queryKey: ["heatmap", indicator, year],
    queryFn:  () => api.get(`/macro/heatmap/africa?indicator=${indicator}&year=${year}`),
    staleTime: 1000 * 60 * 30,
  });

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
      // Fallback : données heatmap actuelles
      return (heatmap?.data ?? []).map((d: Record<string, unknown>) => ({
        country: d.country_id as string,
        indicator_code: indicator,
        value: d.value as number,
        period: String(year),
        source: "IMF",
      }));
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

        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Terminal Macro-Africain
            </h1>
            <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
              54 économies · IMF · World Bank · WHO · EIA · EM-DAT · NASA VIIRS · {new Date().getFullYear()}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openCommandPalette}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono rounded-lg border transition-colors"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }}
            >
              <Search size={11} />
              Recherche
              <kbd className="text-[10px] border rounded px-1 ml-1"
                   style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>⌃K</kbd>
            </button>

            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer border"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
            >
              {INDICATORS.map((ind) => (
                <option key={ind.code} value={ind.code}>{ind.label}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer border"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
            >
              {[2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={() => refetch()}
              title="Actualiser"
              className="p-1.5 rounded-lg border transition-colors"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }}
            >
              <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg border transition-all mansa-btn-ghost"
            >
              <Download size={11} />
              Exporter
            </button>

            <div className="flex items-center gap-1 text-[10px] font-mono"
                 style={{ color: "var(--text-muted)" }}>
              <Calendar size={10} />
              {now}
            </div>
          </div>
        </div>

        {/* ── Barre signaux HF ── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-2 overflow-x-auto border"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--mansa-green)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--mansa-green)" }}>Signaux HF</span>
          </div>
          {HF_ALERTS.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.country}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0 text-[11px] font-medium"
                style={{ background: `color-mix(in srgb, ${a.color} 10%, transparent)`, color: a.color }}
              >
                <span>{a.flag}</span>
                <Icon size={10} />
                <span>{a.country}</span>
                <span className="opacity-80 font-normal">{a.msg}</span>
              </div>
            );
          })}
          <a href="/signals" className="ml-auto flex-shrink-0 text-xs hover:underline"
             style={{ color: "var(--mansa-green)" }}>
            Voir tous →
          </a>
        </div>

        {/* ── Hero KPIs ── */}
        <HeroKPIs />

        {/* ── Main 3-column grid ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5">
            <AfricaHeatmap
              data={heatmap?.data ?? []}
              indicator={indicator}
              year={year}
              isLoading={heatmapLoading}
            />
          </div>
          <div className="col-span-4">
            <SmartChart />
          </div>
          <div className="col-span-3">
            <NewsPanel />
          </div>
        </div>

        {/* ── Data sources strip ── */}
        <div className="rounded-xl px-4 py-3 border" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Sources actives :</span>
            {[
              { label: "IMF WEO",        cls: "source-badge-imf"      },
              { label: "World Bank",     cls: "source-badge-wb"       },
              { label: "WHO GHO",        cls: "source-badge-who"      },
              { label: "ILO",            cls: "source-badge-ilo"      },
              { label: "FAO",            cls: "source-badge-fao"      },
              { label: "EIA",            cls: "source-badge-eia"      },
              { label: "NASA VIIRS",     cls: "source-badge-nasa"     },
              { label: "EM-DAT",         cls: "source-badge-emdat"    },
              { label: "UN Comtrade",    cls: "source-badge-comtrade" },
              { label: "IMF PortWatch",  cls: "source-badge-imf"      },
              { label: "IPC/CH",         cls: "source-badge-fao"      },
              { label: "OECD DAC",       cls: "source-badge-comtrade" },
              { label: "WB PIP",         cls: "source-badge-wb"       },
              { label: "MANSA Research", cls: "source-badge-mansa"    },
            ].map((s) => (
              <span key={s.label} className={s.cls}>{s.label}</span>
            ))}
          </div>
        </div>

        {/* ── Bottom: top movers + KPI grid ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4">
            <TopCountriesTable
              data={heatmap?.data ?? []}
              indicator={heatmap?.indicator_name ?? indicator}
              isLoading={heatmapLoading}
            />
          </div>
          <div className="col-span-8">
            <MacroKPIGrid />
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
