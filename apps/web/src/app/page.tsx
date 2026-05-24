"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, Calendar } from "lucide-react";

import { api } from "@/lib/api";
import { AfricaHeatmap } from "@/components/dashboard/AfricaHeatmap";
import { TopCountriesTable } from "@/components/dashboard/CountrySparklines";
import { MacroKPIGrid } from "@/components/dashboard/MacroKPIGrid";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { HeroKPIs } from "@/components/dashboard/HeroKPIs";
import { SmartChart } from "@/components/dashboard/SmartChart";
import { NewsPanel } from "@/components/dashboard/NewsPanel";
import { CommandPalette } from "@/components/dashboard/CommandPalette";

const INDICATORS = [
  { code: "NGDP_RPCH",    label: "Croissance PIB réel" },
  { code: "PCPIPCH",      label: "Inflation IPC" },
  { code: "GGXCNL_NGDP", label: "Solde budgétaire" },
  { code: "GGXWDG_NGDP", label: "Dette publique" },
  { code: "BCA_NGDPD",   label: "Compte courant" },
];

function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })
  );
}

export default function DashboardPage() {
  const [indicator, setIndicator] = useState("NGDP_RPCH");
  const [year, setYear] = useState(2024);

  const { data: heatmap, isLoading: heatmapLoading, refetch, isFetching } = useQuery({
    queryKey: ["heatmap", indicator, year],
    queryFn: () => api.get(`/macro/heatmap/africa?indicator=${indicator}&year=${year}`),
    staleTime: 1000 * 60 * 30,
  });

  const now = new Date().toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <CommandPalette />

      {/* Pull ticker to full bleed by cancelling AppShell padding */}
      <div className="-mx-6 -mt-6">
        <MarketTicker />
      </div>

      <div className="mt-5 space-y-5 animate-fade-in">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Terminal Macro-Africain
            </h1>
            <p className="text-gray-600 text-[11px] font-mono mt-0.5">
              54 économies · IMF WEO · World Bank WDI · 2024e
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Command palette trigger */}
            <button
              onClick={openCommandPalette}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D1426] border border-[#1E2A42]
                         text-gray-500 text-[11px] font-mono rounded-lg hover:border-[#2A3A52]
                         hover:text-gray-300 transition-colors"
            >
              <Search size={11} />
              <span>Recherche</span>
              <kbd className="text-[10px] border border-[#2A3A52] rounded px-1 text-gray-600">⌃K</kbd>
            </button>

            {/* Indicator */}
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="bg-[#0D1426] border border-[#1E2A42] text-gray-300 text-[11px] font-mono
                         rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00D4AA]/40 cursor-pointer"
            >
              {INDICATORS.map((ind) => (
                <option key={ind.code} value={ind.code}>{ind.label}</option>
              ))}
            </select>

            {/* Year */}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-[#0D1426] border border-[#1E2A42] text-gray-300 text-[11px] font-mono
                         rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00D4AA]/40 cursor-pointer"
            >
              {[2024, 2023, 2022, 2021, 2020].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              title="Actualiser"
              className="p-1.5 bg-[#0D1426] border border-[#1E2A42] rounded-lg text-gray-500
                         hover:text-white hover:border-[#2A3A52] transition-colors"
            >
              <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            </button>

            {/* Timestamp */}
            <div className="flex items-center gap-1 text-gray-700 text-[10px] font-mono">
              <Calendar size={10} />
              <span>{now}</span>
            </div>
          </div>
        </div>

        {/* ── Hero KPIs ── */}
        <HeroKPIs />

        {/* ── Main 3-column grid ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Africa choropleth map */}
          <div className="col-span-5">
            <AfricaHeatmap
              data={heatmap?.data ?? []}
              indicator={indicator}
              year={year}
              isLoading={heatmapLoading}
            />
          </div>

          {/* Interactive comparison chart */}
          <div className="col-span-4">
            <SmartChart />
          </div>

          {/* News feed */}
          <div className="col-span-3">
            <NewsPanel />
          </div>
        </div>

        {/* ── Bottom: top movers + KPI cards ── */}
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
    </>
  );
}
