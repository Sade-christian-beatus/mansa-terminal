"use client";

import { useState } from "react";
import { MacroKPIGrid } from "@/components/dashboard/MacroKPIGrid";
import { AfricaHeatmap } from "@/components/dashboard/AfricaHeatmap";
import { TopCountriesTable } from "@/components/dashboard/CountrySparklines";
import { CountrySparklines } from "@/components/dashboard/CountrySparklines";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const INDICATORS = [
  { code: "NGDP_RPCH", label: "GDP Growth" },
  { code: "PCPIPCH", label: "Inflation" },
  { code: "GGXCNL_NGDP", label: "Fiscal Balance" },
  { code: "GGXWDG_NGDP", label: "Public Debt" },
  { code: "BCA_NGDPD", label: "Current Account" },
];

export default function DashboardPage() {
  const [selectedIndicator, setSelectedIndicator] = useState("NGDP_RPCH");
  const [selectedYear, setSelectedYear] = useState(2024);

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ["heatmap", selectedIndicator, selectedYear],
    queryFn: () =>
      api.get(`/macro/heatmap/africa?indicator=${selectedIndicator}&year=${selectedYear}`),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Africa Macro Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            54 economies · Real-time data · IMF / World Bank
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sélecteur d'indicateur */}
          <select
            value={selectedIndicator}
            onChange={(e) => setSelectedIndicator(e.target.value)}
            className="bg-[#141B2E] border border-[#1E2A42] text-gray-300
                       text-sm rounded-lg px-3 py-2 focus:outline-none
                       focus:border-[#00D4AA]"
          >
            {INDICATORS.map((ind) => (
              <option key={ind.code} value={ind.code}>
                {ind.label}
              </option>
            ))}
          </select>

          {/* Sélecteur d'année */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#141B2E] border border-[#1E2A42] text-gray-300
                       text-sm rounded-lg px-3 py-2 focus:outline-none
                       focus:border-[#00D4AA]"
          >
            {[2024, 2023, 2022, 2021, 2020].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards — vue rapide top 5 économies */}
      <MacroKPIGrid />

      {/* Heatmap Afrique + Table Top Économies */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <AfricaHeatmap
            data={heatmapData?.data || []}
            indicator={selectedIndicator}
            year={selectedYear}
            isLoading={heatmapLoading}
          />
        </div>
        <div className="col-span-5">
          <TopCountriesTable
            data={heatmapData?.data || []}
            indicator={heatmapData?.indicator_name || selectedIndicator}
            isLoading={heatmapLoading}
          />
        </div>
      </div>

      {/* Sparklines pays clés */}
      <CountrySparklines />
    </div>
  );
}
