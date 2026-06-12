"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ForecastResult, HistoricalPoint, ForecastPoint } from "@/lib/api";

interface Props {
  result: ForecastResult;
  height?: number;
  showLegend?: boolean;
}

interface ChartRow {
  year:      number;
  value?:    number;
  forecast?: number;
  band80?:   [number, number];
  band95?:   [number, number];
  isForcast: boolean;
}

function formatVal(v: number, unit: string | null) {
  if (!unit) return v.toFixed(1);
  const abs = Math.abs(v);
  if (abs >= 1e9)  return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${(v / 1e6).toFixed(1)}M`;
  return v.toFixed(1);
}

export default function ForecastChart({ result, height = 240, showLegend = false }: Props) {
  const { historical, forecast, last_historical_year, unit, indicator_name, model } = result;

  const rows: ChartRow[] = [
    ...historical.map((h: HistoricalPoint) => ({
      year:      h.year,
      value:     h.value,
      isForcast: false,
    })),
    ...forecast.map((f: ForecastPoint) => ({
      year:      f.year,
      forecast:  f.value,
      band80:    [f.lower_80, f.upper_80] as [number, number],
      band95:    [f.lower_95, f.upper_95] as [number, number],
      isForcast: true,
    })),
  ];

  const allValues = [
    ...historical.map((h) => h.value),
    ...forecast.flatMap((f) => [f.lower_95, f.upper_95]),
  ];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const pad    = (maxVal - minVal) * 0.12 || 1;
  const domain: [number, number] = [
    parseFloat((minVal - pad).toFixed(1)),
    parseFloat((maxVal + pad).toFixed(1)),
  ];

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={domain}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatVal(v, unit)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            itemStyle={{ color: "var(--text-secondary)" }}
            labelFormatter={(label) => `${label}`}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                value:    "Historique",
                forecast: "Prévision",
                band95:   "IC 95%",
                band80:   "IC 80%",
              };
              return [formatVal(value, unit), labels[name] ?? name] as [string, string];
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 10, color: "var(--text-muted)" }}
              formatter={(value: string) => {
                const m: Record<string, string> = { value: "Historique", forecast: "Prévision" };
                return m[value] ?? value;
              }}
            />
          )}

          {/* IC 95% (bande la plus large) */}
          <Area
            dataKey="band95"
            stroke="none"
            fill="var(--mansa-green)"
            fillOpacity={0.08}
            connectNulls
            isAnimationActive={false}
          />
          {/* IC 80% (bande intérieure) */}
          <Area
            dataKey="band80"
            stroke="none"
            fill="var(--mansa-green)"
            fillOpacity={0.15}
            connectNulls
            isAnimationActive={false}
          />

          {/* Ligne historique */}
          <Line
            dataKey="value"
            stroke="var(--mansa-green)"
            strokeWidth={2}
            dot={{ fill: "var(--mansa-green)", r: 2 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Ligne prévision (pointillée) */}
          <Line
            dataKey="forecast"
            stroke="var(--mansa-green)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ fill: "var(--mansa-green)", r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Séparateur historique/prévision */}
          <ReferenceLine
            x={last_historical_year}
            stroke="var(--text-muted)"
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: "Projection →",
              position: "insideTopRight",
              fill: "var(--text-muted)",
              fontSize: 9,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-[9px] mt-1 text-right" style={{ color: "var(--text-muted)" }}>
        Modèle : {model} · {unit ?? ""} · {indicator_name}
      </p>
    </div>
  );
}
