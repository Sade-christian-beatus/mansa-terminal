"use client";

import { useQuery } from "@tanstack/react-query";
import { Leaf, Zap, Wind, TrendingUp, TrendingDown } from "lucide-react";
import { climateApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

interface CountryClimate {
  country_id: string;
  name: string;
  flag: string;
  indicators: {
    CO2_PC?: number;
    ELEC_ACC?: number;
    REN_PCT?: number;
    CLIM_FIN_USD?: number;
  };
}

interface ClimateSummary {
  continent_averages: {
    co2_per_capita: number;
    electricity_access: number;
    renewables_share: number;
    total_climate_finance_m_usd: number;
  };
  leaders: {
    cleanest_energy:  { country: string; value: number; flag: string };
    best_elec_access: { country: string; value: number; flag: string };
    lowest_co2_pc:    { country: string; value: number; flag: string };
  };
}

function KpiStat({
  icon: Icon, label, value, unit, color, sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white font-mono">
        {value}<span className="text-sm text-gray-500 ml-1">{unit}</span>
      </p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 bg-[#1E2A42] rounded-full overflow-hidden flex-1">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function ClimatePage() {
  const { data: climateData, isLoading: climateLoading } = useQuery({
    queryKey: ["climate-indicators"],
    queryFn: () => climateApi.getIndicators(),
    staleTime: 1000 * 60 * 60,
  });

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["climate-summary"],
    queryFn: () => climateApi.getSummary(),
    staleTime: 1000 * 60 * 60,
  });

  const countries: CountryClimate[] = (climateData as any)?.data ?? [];
  const summary: ClimateSummary | null = summaryData as any ?? null;

  // Préparer les données pour les graphiques
  const co2Data = [...countries]
    .filter((c) => c.indicators.CO2_PC != null)
    .sort((a, b) => (b.indicators.CO2_PC ?? 0) - (a.indicators.CO2_PC ?? 0))
    .slice(0, 12)
    .map((c) => ({ name: c.country_id, value: c.indicators.CO2_PC!, flag: c.flag }));

  const renewablesSorted = [...countries]
    .filter((c) => c.indicators.REN_PCT != null)
    .sort((a, b) => (b.indicators.REN_PCT ?? 0) - (a.indicators.REN_PCT ?? 0));

  const electricityByRegion = [...countries]
    .filter((c) => c.indicators.ELEC_ACC != null)
    .sort((a, b) => (b.indicators.ELEC_ACC ?? 0) - (a.indicators.ELEC_ACC ?? 0));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Leaf size={22} className="text-emerald-400" />
          Climat & ESG
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          CO₂ · Accès électricité · Énergies renouvelables · Finance climatique · 54 pays africains
        </p>
      </div>

      {/* KPI continentaux */}
      {summaryLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mansa-card rounded-xl h-28 skeleton" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiStat
            icon={Wind}
            label="CO₂ moyen / habitant"
            value={summary.continent_averages.co2_per_capita.toFixed(2)}
            unit="t"
            color="#EF4444"
            sub="Moyenne Afrique vs 4.7t monde"
          />
          <KpiStat
            icon={Zap}
            label="Accès électricité"
            value={summary.continent_averages.electricity_access.toFixed(1)}
            unit="%"
            color="#F59E0B"
            sub="Population avec accès"
          />
          <KpiStat
            icon={Leaf}
            label="Mix renouvelables"
            value={summary.continent_averages.renewables_share.toFixed(1)}
            unit="%"
            color="#10B981"
            sub="Part dans la production"
          />
          <KpiStat
            icon={TrendingUp}
            label="Finance climatique"
            value={`$${(summary.continent_averages.total_climate_finance_m_usd / 1000).toFixed(1)}B`}
            unit=""
            color="#3B82F6"
            sub="Total reçu (réf. 2022)"
          />
        </div>
      )}

      {/* Leaders */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: "Énergie la plus propre",    key: "cleanest_energy",  color: "#10B981", unit: "% renouvelables" },
            { title: "Meilleur accès électrique",  key: "best_elec_access", color: "#F59E0B", unit: "% population" },
            { title: "Empreinte CO₂ la plus basse",key: "lowest_co2_pc",   color: "#3B82F6", unit: "t CO₂/habitant" },
          ].map(({ title, key, color, unit }) => {
            const leader = summary.leaders[key as keyof typeof summary.leaders];
            return (
              <div key={key} className="mansa-card rounded-xl p-4 flex items-center gap-4">
                <span className="text-3xl">{leader.flag}</span>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{title}</p>
                  <p className="text-sm font-bold text-white">{leader.country}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color }}>
                    {leader.value.toFixed(1)} {unit}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Graphiques */}
      {climateLoading ? (
        <div className="grid grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="mansa-card rounded-xl h-72 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CO2 par habitant */}
          <div className="mansa-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-4">
              Émissions CO₂ par habitant (tonnes)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={co2Data} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A42" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#9CA3AF", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ background: "#141B2E", border: "1px solid #1E2A42", borderRadius: "8px", fontSize: 12 }}
                  itemStyle={{ color: "#94A3B8" }}
                  formatter={(v: number) => [`${v.toFixed(2)} t`, "CO₂/habitant"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {co2Data.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.value > 3 ? "#EF4444" : entry.value > 1 ? "#F59E0B" : "#10B981"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Renouvelables top 10 */}
          <div className="mansa-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-4">
              Part des énergies renouvelables (%)
            </h3>
            <div className="space-y-2 overflow-y-auto max-h-[220px]">
              {renewablesSorted.map((c) => (
                <div key={c.country_id} className="flex items-center gap-3">
                  <span className="text-sm w-6">{c.flag}</span>
                  <span className="text-xs text-gray-400 w-24 truncate">{c.name}</span>
                  <ProgressBar value={c.indicators.REN_PCT ?? 0} color="#10B981" />
                  <span className="text-xs font-mono text-emerald-400 w-12 text-right">
                    {(c.indicators.REN_PCT ?? 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Accès électricité */}
      {!climateLoading && (
        <div className="mansa-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">
            Accès à l'électricité par pays (% population)
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
            {electricityByRegion.map((c) => (
              <div key={c.country_id} className="flex items-center gap-2">
                <span className="text-sm">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-gray-400 truncate">{c.name}</span>
                    <span className={`text-xs font-mono ml-2 flex-shrink-0 ${
                      (c.indicators.ELEC_ACC ?? 0) > 80 ? "text-emerald-400" :
                      (c.indicators.ELEC_ACC ?? 0) > 50 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {(c.indicators.ELEC_ACC ?? 0).toFixed(0)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={c.indicators.ELEC_ACC ?? 0}
                    color={
                      (c.indicators.ELEC_ACC ?? 0) > 80 ? "#10B981" :
                      (c.indicators.ELEC_ACC ?? 0) > 50 ? "#F59E0B" : "#EF4444"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-700 pb-4">
        Sources : Banque Mondiale WDI · IEA · IRENA · Climate Policy Initiative · MANSA Terminal
      </p>
    </div>
  );
}
