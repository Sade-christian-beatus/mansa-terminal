"use client";

import { useState, useMemo } from "react";
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
import { MacroDataTable }      from "@/components/dashboard/MacroDataTable";
import { MarketTicker }        from "@/components/dashboard/MarketTicker";
import { HeroKPIs }            from "@/components/dashboard/HeroKPIs";
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

// ── Données heatmap statiques (fallback quand l'API est indisponible) ──────
const STATIC_HEATMAP: Record<string, Record<string, number>> = {
  NGDP_RPCH:    { NGA:3.1, ZAF:1.1, EGY:2.7, ETH:6.8, KEN:5.0, MAR:3.2, GHA:3.1, CIV:6.5, SEN:8.3, TZA:5.4, CMR:4.1, AGO:2.4, DZA:3.6, MOZ:5.5, ZMB:4.8, RWA:7.0, TUN:1.8, UGA:6.1, LBY:4.0, COD:6.3, NER:12.3, BEN:6.4, MLI:4.0, TGO:6.0, GIN:6.5, BWA:3.5, NAM:3.6 },
  PCPIPCH:      { NGA:32.5, ZAF:4.6, EGY:28.3, ETH:24.1, KEN:6.5, MAR:2.4, GHA:22.3, CIV:3.8, SEN:2.8, TZA:3.1, CMR:7.4, AGO:28.2, DZA:9.2, MOZ:6.2, ZMB:13.0, RWA:5.8, TUN:9.3, UGA:3.8, LBY:2.8, COD:23.6, NER:3.9, BEN:2.7, MLI:2.5, TGO:4.0 },
  GGXWDG_NGDP:  { NGA:46, ZAF:75, EGY:90, ETH:38, KEN:70, MAR:69, GHA:83, CIV:57, SEN:73, TZA:42, CMR:48, AGO:73, DZA:60, MOZ:100, ZMB:137, RWA:68, TUN:80, UGA:50, LBY:84, COD:15 },
  GGXCNL_NGDP:  { NGA:-4.6, ZAF:-5.0, EGY:-7.2, ETH:-2.6, KEN:-5.5, MAR:-4.1, GHA:-4.6, CIV:-4.0, SEN:-4.9, TZA:-3.0, CMR:-2.5, AGO:-1.0, DZA:-5.8, MOZ:-5.0, ZMB:-7.6, RWA:-6.0 },
  BCA_NGDPD:    { NGA:0.8, ZAF:-1.6, EGY:-5.4, ETH:-3.1, KEN:-4.0, MAR:-1.2, GHA:-2.0, CIV:-3.7, SEN:-12.1, TZA:-3.5, AGO:4.5, DZA:2.4, LBY:13.3 },
};

const STATIC_FLAGS: Record<string, { flag: string; name: string }> = {
  NGA:{flag:"🇳🇬",name:"Nigeria"}, ZAF:{flag:"🇿🇦",name:"Afrique du Sud"}, EGY:{flag:"🇪🇬",name:"Égypte"},
  ETH:{flag:"🇪🇹",name:"Éthiopie"}, KEN:{flag:"🇰🇪",name:"Kenya"}, MAR:{flag:"🇲🇦",name:"Maroc"},
  GHA:{flag:"🇬🇭",name:"Ghana"}, CIV:{flag:"🇨🇮",name:"Côte d'Ivoire"}, SEN:{flag:"🇸🇳",name:"Sénégal"},
  TZA:{flag:"🇹🇿",name:"Tanzanie"}, CMR:{flag:"🇨🇲",name:"Cameroun"}, AGO:{flag:"🇦🇴",name:"Angola"},
  DZA:{flag:"🇩🇿",name:"Algérie"}, MOZ:{flag:"🇲🇿",name:"Mozambique"}, ZMB:{flag:"🇿🇲",name:"Zambie"},
  RWA:{flag:"🇷🇼",name:"Rwanda"}, TUN:{flag:"🇹🇳",name:"Tunisie"}, UGA:{flag:"🇺🇬",name:"Ouganda"},
  LBY:{flag:"🇱🇾",name:"Libye"}, COD:{flag:"🇨🇩",name:"Congo RDC"}, NER:{flag:"🇳🇪",name:"Niger"},
  BEN:{flag:"🇧🇯",name:"Bénin"}, MLI:{flag:"🇲🇱",name:"Mali"}, TGO:{flag:"🇹🇬",name:"Togo"},
  GIN:{flag:"🇬🇳",name:"Guinée"}, BWA:{flag:"🇧🇼",name:"Botswana"}, NAM:{flag:"🇳🇦",name:"Namibie"},
};

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
  const [indicator,   setIndicator]   = useState("NGDP_RPCH");
  const [year,        setYear]        = useState(2024);
  const [exportOpen,  setExportOpen]  = useState(false);

  const { data: heatmap, isLoading: heatmapLoading, refetch, isFetching } = useQuery({
    queryKey: ["heatmap", indicator, year],
    queryFn:  () => api.get(`/macro/heatmap/africa?indicator=${indicator}&year=${year}`),
    staleTime: 1000 * 60 * 30,
  });

  // Données heatmap effectives (API ou fallback statique)
  const effectiveHeatmapData = useMemo(() => {
    const apiData = heatmap?.data ?? [];
    if (apiData.length > 0) return apiData;
    // Fallback statique
    const staticVals = STATIC_HEATMAP[indicator] ?? {};
    return Object.entries(staticVals).map(([id, value]) => ({
      country_id:   id,
      country_name: STATIC_FLAGS[id]?.name ?? id,
      flag:         STATIC_FLAGS[id]?.flag ?? "🌍",
      value,
    }));
  }, [heatmap, indicator]);

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

              {/* Nouveau titre — accroche produit */}
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

            {/* Filtre source */}
            <select
              className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer border transition-colors"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
              defaultValue=""
            >
              <option value="" disabled>Source</option>
              <option value="IMF">FMI WEO</option>
              <option value="WB">Banque Mondiale</option>
              <option value="WHO">OMS</option>
              <option value="EMDAT">EM-DAT</option>
              <option value="EIA">EIA</option>
              <option value="NASA">NASA VIIRS</option>
              <option value="Comtrade">UN Comtrade</option>
              <option value="BCEAO">BCEAO</option>
              <option value="AU">Union Africaine</option>
            </select>

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

        {/* ── Main 2-column grid ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <AfricaHeatmap
              data={effectiveHeatmapData}
              indicator={indicator}
              year={year}
              isLoading={heatmapLoading}
            />
          </div>
          <div className="col-span-4">
            <NewsPanel />
          </div>
        </div>

        {/* ── Bottom: top movers + KPI grid ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4">
            <TopCountriesTable
              data={effectiveHeatmapData}
              indicator={heatmap?.indicator_name ?? indicator}
              isLoading={heatmapLoading}
            />
          </div>
          <div className="col-span-8">
            <MacroKPIGrid />
          </div>
        </div>

        {/* ── Tableau macro interactif ── */}
        <MacroDataTable />

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
