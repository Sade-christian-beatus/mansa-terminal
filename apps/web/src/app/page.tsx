"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, Search, Calendar, Download, Zap,
  Flame, Droplets, Satellite, Anchor, TrendingUp,
  TrendingDown, Globe2, Activity, BarChart3,
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
  { code: "NGDP_RPCH",    label: "Croissance PIB"        },
  { code: "PCPIPCH",      label: "Inflation IPC"          },
  { code: "GGXCNL_NGDP", label: "Solde budgétaire"       },
  { code: "GGXWDG_NGDP", label: "Dette publique"          },
  { code: "BCA_NGDPD",   label: "Compte courant"          },
  { code: "ASSDRESES",   label: "Réserves import."        },
  { code: "LUR",         label: "Chômage"                 },
];

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
  { label: "Mise à jour quotidienne", value: "IMF · WB", icon: RefreshCw, color: "#F59E0B" },
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

        {/* ── Hero Header — Slogan MANSA + actions ── */}
        <div
          className="rounded-2xl px-6 py-5 border relative overflow-hidden"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          {/* Gradient orb décoratif */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-5"
               style={{ background: "radial-gradient(circle, var(--mansa-green), transparent)" }} />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-5"
               style={{ background: "radial-gradient(circle, var(--mansa-blue), transparent)" }} />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--mansa-green)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--mansa-green)" }}>
                  Live · {now}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Africa&apos;s AI-Powered
              </h1>
              <h1 className="text-2xl font-bold tracking-tight"
                  style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Macro-Fiscal Intelligence
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
                54 économies · IMF WEO · World Bank · WHO · EM-DAT · NASA VIIRS · EIA
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

            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer border transition-colors"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
            >
              {INDICATORS.map((ind) => (
                <option key={ind.code} value={ind.code}>{ind.label}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer border transition-colors"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
            >
              {[2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={() => refetch()}
              title="Actualiser"
              className="p-1.5 rounded-lg border transition-all hover:border-[var(--mansa-green)]"
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

        {/* ── Sources actives ── */}
        <div className="rounded-xl px-4 py-3 border" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--mansa-green)" }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sources intégrées</span>
            </div>
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
