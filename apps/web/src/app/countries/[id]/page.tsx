"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { macroApi } from "@/lib/api";
import { ErrorCard } from "@/components/common/ErrorCard";
import { CATALOG_BY_ID } from "@/lib/indicator-catalog";

const INDICATOR_COLORS: Record<string, string> = {
  NGDP_RPCH:   "#00D4AA",
  PCPIPCH:     "#F59E0B",
  GGXCNL_NGDP: "#3B82F6",
  GGXWDG_NGDP: "#8B5CF6",
  BCA_NGDPD:   "#EC4899",
  NGDPDPC:     "#10B981",
  LUR:         "#EF4444",
};

function getIndicatorMeta(code: string) {
  const ind = CATALOG_BY_ID[code];
  if (ind) {
    const unitMap: Record<string, string> = {
      "gdp_growth": "%", "inflation_cpi": "%", "fiscal_balance": "% PIB",
      "public_debt": "% PIB", "current_account": "% PIB", "gdp_per_capita": "USD",
      "unemployment": "%",
    };
    const unit =
      code === "NGDPDPC" ? "USD" :
      code.endsWith("_NGDP") || code.endsWith("_NGDPD") ? "% PIB" : "%";
    return { label: ind.name_fr, unit, color: INDICATOR_COLORS[code] ?? "#00D4AA" };
  }
  const fallback: Record<string, { label: string; unit: string }> = {
    NGDP_RPCH:   { label: "Croissance PIB réel",  unit: "%" },
    PCPIPCH:     { label: "Inflation IPC",         unit: "%" },
    GGXCNL_NGDP: { label: "Solde budgétaire",      unit: "% PIB" },
    GGXWDG_NGDP: { label: "Dette publique",        unit: "% PIB" },
    BCA_NGDPD:   { label: "Compte courant",        unit: "% PIB" },
    NGDPDPC:     { label: "PIB par habitant",      unit: "USD" },
    LUR:         { label: "Taux de chômage",       unit: "%" },
  };
  const fb = fallback[code];
  return { label: fb?.label ?? code, unit: fb?.unit ?? "", color: INDICATOR_COLORS[code] ?? "#00D4AA" };
}

const REGION_LABELS: Record<string, string> = {
  "West Africa": "Afrique de l'Ouest",
  "East Africa": "Afrique de l'Est",
  "North Africa": "Afrique du Nord",
  "Central Africa": "Afrique Centrale",
  "Southern Africa": "Afrique Australe",
};

const TIER_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Couverture complète",  color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  2: { label: "Couverture modérée",   color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  3: { label: "Couverture basique",   color: "text-gray-400 bg-gray-400/10 border-gray-400/20" },
};

function KPICard({
  label, value, unit, trend,
}: {
  label: string; value: number | null; unit: string; trend?: number | null;
}) {
  const trendPositive = (trend ?? 0) >= 0;
  return (
    <div className="mansa-card rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono text-white">
        {value != null ? `${value.toFixed(1)}${unit === "USD" ? "" : unit}` : "–"}
        {unit === "USD" && value != null && (
          <span className="text-sm text-gray-400 ml-1">USD</span>
        )}
      </p>
      {trend != null && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-mono
                         ${trendPositive ? "text-emerald-400" : "text-red-400"}`}>
          {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendPositive ? "+" : ""}{trend.toFixed(1)}{unit !== "USD" ? unit : "%"} vs an préc.
        </div>
      )}
    </div>
  );
}

function IndicatorChart({
  code, points,
}: {
  code: string;
  points: { period: string; value: number }[];
}) {
  const meta = getIndicatorMeta(code);
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));

  return (
    <div className="mansa-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">{meta.label}</p>
        <span className="text-xs text-gray-500 font-mono">{meta.unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2A42" />
          <XAxis
            dataKey="period"
            tick={{ fill: "#6B7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6B7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "#141B2E",
              border: "1px solid #1E2A42",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            itemStyle={{ color: "#94A3B8" }}
            formatter={(v: number) => [`${v.toFixed(2)} ${meta.unit}`, meta.label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={meta.color}
            strokeWidth={2}
            dot={{ r: 3, fill: meta.color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const countryId = id.toUpperCase();

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const {
    data: macro,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["country-macro", countryId],
    queryFn: () =>
      macroApi.getCountryMacro(countryId, { from_year: 2015, to_year: 2024 }),
    staleTime: 1000 * 60 * 30,
  });

  const meta = countries?.find((c: { id: string }) => c.id === countryId);

  if (isError) {
    return (
      <ErrorCard
        title="Pays introuvable"
        message={`Aucune donnée disponible pour le code pays "${countryId}".`}
        reset={() => router.push("/countries")}
      />
    );
  }

  // KPIs — dernière valeur + variation
  const getLatestAndTrend = (code: string) => {
    const pts = macro?.indicators?.[code] ?? [];
    if (pts.length === 0) return { latest: null, trend: null };
    const sorted = [...pts].sort((a: { period: string }, b: { period: string }) =>
      b.period.localeCompare(a.period)
    );
    const latest = sorted[0].value;
    const prev = sorted[1]?.value ?? null;
    return { latest, trend: prev != null ? latest - prev : null };
  };

  const gdp = getLatestAndTrend("NGDP_RPCH");
  const inf = getLatestAndTrend("PCPIPCH");
  const fis = getLatestAndTrend("GGXCNL_NGDP");
  const dbt = getLatestAndTrend("GGXWDG_NGDP");

  const tier = meta ? TIER_LABEL[meta.coverage_tier as number] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/countries")}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-200
                     text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={14} />
          Retour aux pays
        </button>

        <div className="flex items-center gap-4">
          <span className="text-5xl">{meta?.flag_emoji ?? "🌍"}</span>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {macro?.country_name ?? countryId}
            </h1>
            {meta?.name_fr && meta.name_fr !== macro?.country_name && (
              <p className="text-gray-500 text-sm">{meta.name_fr}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-mono text-gray-500 bg-[#1E2A42]
                               px-2 py-0.5 rounded">
                {countryId}
              </span>
              {meta?.region && (
                <span className="text-xs text-gray-500">
                  {REGION_LABELS[meta.region] ?? meta.region}
                </span>
              )}
              {meta?.currency_code && (
                <span className="text-xs text-gray-500 font-mono">
                  {meta.currency_code}
                </span>
              )}
              {tier && (
                <span className={`text-xs px-2 py-0.5 rounded border font-medium
                                  ${tier.color}`}>
                  {tier.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mansa-card rounded-xl p-4 h-24 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="Croissance PIB" value={gdp.latest} unit="%" trend={gdp.trend} />
          <KPICard label="Inflation" value={inf.latest} unit="%" trend={inf.trend} />
          <KPICard label="Solde budgétaire" value={fis.latest} unit="% PIB" trend={fis.trend} />
          <KPICard label="Dette publique" value={dbt.latest} unit="% PIB" trend={dbt.trend} />
        </div>
      )}

      {/* Graphiques par indicateur */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Séries temporelles 2015–2024
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mansa-card rounded-xl p-4 h-52 skeleton" />
            ))}
          </div>
        ) : Object.values(macro?.indicators ?? {}).some((pts) => (pts as []).length > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(macro?.indicators ?? {}).map(([code, pts]) =>
              (pts as { period: string; value: number }[]).length > 0 ? (
                <IndicatorChart
                  key={code}
                  code={code}
                  points={pts as { period: string; value: number }[]}
                />
              ) : null
            )}
          </div>
        ) : (
          <div className="mansa-card rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm font-medium mb-1">
              Aucune série temporelle disponible pour ce pays.
            </p>
            <p className="text-gray-600 text-xs">
              Les données macro-fiscales sont chargées par les pipelines Dagster (IMF WEO · World Bank WDI).
              Lancez <code className="text-[#00D4AA] bg-[#00D4AA]/10 px-1 rounded">dagster job execute -j full_historical_refresh</code> pour les charger.
            </p>
          </div>
        )}
      </div>

      {/* Source */}
      <p className="text-xs text-gray-700 pb-4">
        Sources : FMI World Economic Outlook · Banque Mondiale WDI · MANSA Terminal
      </p>
    </div>
  );
}
