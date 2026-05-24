"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const COUNTRIES = [
  { iso3: "NGA", name: "Nigeria",       color: "#00D4AA" },
  { iso3: "ZAF", name: "Afr. du Sud",   color: "#3B82F6" },
  { iso3: "EGY", name: "Égypte",        color: "#F59E0B" },
  { iso3: "KEN", name: "Kenya",         color: "#A78BFA" },
  { iso3: "ETH", name: "Éthiopie",      color: "#F87171" },
];

const INDICATORS = [
  { code: "NGDP_RPCH",    label: "Croissance PIB réel (%)" },
  { code: "PCPIPCH",      label: "Inflation IPC (%)" },
  { code: "GGXCNL_NGDP", label: "Solde budgétaire (% PIB)" },
  { code: "GGXWDG_NGDP", label: "Dette publique (% PIB)" },
  { code: "BCA_NGDPD",   label: "Compte courant (% PIB)" },
];

const RANGES = [
  { label: "3A", years: ["2022","2023","2024"] },
  { label: "5A", years: ["2020","2021","2022","2023","2024"] },
  { label: "10A", years: ["2015","2016","2017","2018","2019","2020","2021","2022","2023","2024"] },
];

interface ImfData {
  values: Record<string, Record<string, number | null>>;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0F1E] border border-[#2A3A52] rounded-lg p-3 shadow-2xl text-xs">
      <p className="text-gray-500 font-mono mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 font-mono">
          <span style={{ color: p.color }}>■</span>
          <span className="text-gray-400">{p.name}</span>
          <span className="text-white font-semibold ml-auto pl-3">
            {p.value != null ? p.value.toFixed(2) : "n/d"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SmartChart() {
  const [indicator, setIndicator] = useState("NGDP_RPCH");
  const [rangeIdx, setRangeIdx] = useState(1);
  const [active, setActive] = useState<Set<string>>(new Set(COUNTRIES.map((c) => c.iso3)));

  const range = RANGES[rangeIdx];

  const { data, isLoading } = useQuery<ImfData>({
    queryKey: ["smart-chart", indicator, range.label],
    queryFn: () =>
      fetch(`/api/imf?indicator=${indicator}&periods=${range.years.join(",")}`).then((r) => r.json()),
    staleTime: 1000 * 60 * 60,
  });

  const chartData = useMemo(() => {
    if (!data?.values) return [];
    return range.years.map((year) => {
      const pt: Record<string, number | string> = { year };
      for (const c of COUNTRIES) {
        if (active.has(c.iso3)) {
          const v = data.values[c.iso3]?.[year];
          if (v != null) pt[c.iso3] = v;
        }
      }
      return pt;
    });
  }, [data, range.years, active]);

  function toggleCountry(iso3: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(iso3) && next.size > 1) next.delete(iso3);
      else next.add(iso3);
      return next;
    });
  }

  return (
    <div className="bg-[#0D1426] border border-[#1E2A42] rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E2A42]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />
          <span className="text-white text-xs font-semibold">Analyse comparative</span>
        </div>
        <div className="flex items-center gap-0.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                rangeIdx === i
                  ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/25"
                  : "text-gray-600 hover:text-gray-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Indicator picker */}
      <div className="px-3 pt-2.5">
        <select
          value={indicator}
          onChange={(e) => setIndicator(e.target.value)}
          className="w-full bg-[#080D1A] border border-[#1E2A42] text-gray-300 text-[11px] font-mono
                     rounded px-2 py-1.5 focus:outline-none focus:border-[#00D4AA]/40 cursor-pointer"
        >
          {INDICATORS.map((ind) => (
            <option key={ind.code} value={ind.code}>{ind.label}</option>
          ))}
        </select>
      </div>

      {/* Country toggles */}
      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        {COUNTRIES.map((c) => {
          const on = active.has(c.iso3);
          return (
            <button
              key={c.iso3}
              onClick={() => toggleCountry(c.iso3)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all"
              style={{
                border: `1px solid ${c.color}${on ? "40" : "20"}`,
                background: on ? `${c.color}12` : "transparent",
                opacity: on ? 1 : 0.4,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: on ? c.color : "#475569" }}
              />
              <span style={{ color: on ? c.color : "#64748B" }}>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="flex-1 px-2 pb-2 pt-1 min-h-0">
        {isLoading ? (
          <div className="w-full h-[180px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#1E2A42] border-t-[#00D4AA] rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="#1E2A42" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v.toFixed(0)}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#2A3A52" strokeDasharray="3 3" />
              {COUNTRIES.filter((c) => active.has(c.iso3)).map((c) => (
                <Line
                  key={c.iso3}
                  type="monotone"
                  dataKey={c.iso3}
                  name={c.name}
                  stroke={c.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: c.color, stroke: "#0D1426", strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
