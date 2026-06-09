"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Download, Shield } from "lucide-react";
import { macroApi } from "@/lib/api";
import { ErrorCard } from "@/components/common/ErrorCard";
import { CATALOG_BY_ID } from "@/lib/indicator-catalog";
import { ExportModal } from "@/components/common/ExportModal";
import type { ExportRow } from "@/lib/export-utils";
import { useState } from "react";

/* ── Types ───────────────────────────────────────────── */
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

/* ── Scorecard helpers (reproduit la logique du prototype) ── */
type ScoreStatus = "ok" | "warn" | "bad";
interface ScoreItem {
  label: string;
  status: ScoreStatus;
  value: string;
  threshold_ok: string;
  threshold_warn: string;
}

function buildScorecard(
  growth: number | null, inflation: number | null,
  debt: number | null, fiscal: number | null,
  ca: number | null, reserves: number | null,
): ScoreItem[] {
  const item = (label: string, ok: boolean, warn: boolean, val: string, tok: string, twarn: string): ScoreItem =>
    ({ label, status: ok ? "ok" : warn ? "warn" : "bad", value: val, threshold_ok: tok, threshold_warn: twarn });

  return [
    item("Croissance PIB",  (growth ?? 0) >= 4,    (growth ?? 0) >= 2,  growth   != null ? `${growth.toFixed(1)}%` : "—",     "≥ 4%",     "≥ 2%"),
    item("Inflation IPC",   (inflation ?? 99) < 6,  (inflation ?? 99) < 12, inflation != null ? `${inflation.toFixed(1)}%` : "—","< 6%",   "< 12%"),
    item("Dette / PIB",     (debt ?? 999) < 50,     (debt ?? 999) < 70,  debt     != null ? `${debt.toFixed(0)}%` : "—",       "< 50%",    "< 70%"),
    item("Solde budgétaire",(fiscal ?? -99) > -3,   (fiscal ?? -99) > -6, fiscal  != null ? `${fiscal.toFixed(1)}%` : "—",     "> –3%",    "> –6%"),
    item("Compte courant",  (ca ?? -99) > -2,       (ca ?? -99) > -6,    ca       != null ? `${ca.toFixed(1)}%` : "—",         "> –2%",    "> –6%"),
    item("Réserves change", (reserves ?? 0) >= 4,   (reserves ?? 0) >= 3, reserves != null ? `${reserves.toFixed(1)} mois` : "—","≥ 4 mois","≥ 3 mois"),
  ];
}

function compositeGrade(items: ScoreItem[]): { grade: string; label: string; color: string } {
  const score = items.reduce((s, c) => s + (c.status === "ok" ? 2 : c.status === "warn" ? 1 : 0), 0);
  const pct = score / (items.length * 2);
  if (pct >= 0.80) return { grade: "A", label: "Solide",             color: "#10B981" };
  if (pct >= 0.62) return { grade: "B", label: "Globalement sain",   color: "#22D39A" };
  if (pct >= 0.45) return { grade: "C", label: "Sous surveillance",  color: "#F59E0B" };
  if (pct >= 0.28) return { grade: "D", label: "Fragile",            color: "#FB923C" };
  return              { grade: "E", label: "À risque",              color: "#EF4444" };
}

function generateNarrative(countryName: string, growth: number | null, inflation: number | null,
  debt: number | null, fiscal: number | null, ca: number | null, reserves: number | null): string {
  const g = growth ?? 0; const inf = inflation ?? 0; const dbt = debt ?? 0;
  const res = reserves ?? 0; const cur_ca = ca ?? 0;
  const accel = g >= 4 ? "solide" : g >= 2 ? "modérée" : "faible";
  const infTxt = inf > 15 ? "une inflation très élevée" : inf > 10 ? "une inflation élevée" : inf > 6 ? "une inflation modérée" : "une inflation maîtrisée";
  const debtTxt = dbt >= 80 ? "un endettement préoccupant" : dbt >= 60 ? "une dette au-dessus du seuil DSA (60%)" : "une dette soutenable";
  const extTxt = res < 3 ? "des réserves de change tendues" : cur_ca < -6 ? "un déficit courant important" : "une position extérieure relativement confortable";
  return `${countryName} affiche une croissance ${accel} de ${growth?.toFixed(1) ?? "N/A"}%. Le pays connaît ${infTxt} (${inflation?.toFixed(1) ?? "N/A"}%) et ${debtTxt} (${debt?.toFixed(0) ?? "N/A"}% du PIB). Sur le plan extérieur, on observe ${extTxt}${res < 3 ? ` (${reserves?.toFixed(1)} mois d'importations)` : ""}.`;
}

/* ── Sous-composants UI ──────────────────────────────── */
function KPICard({ label, value, unit, trend }: {
  label: string; value: number | null; unit: string; trend?: number | null;
}) {
  const trendPositive = (trend ?? 0) >= 0;
  return (
    <div className="mansa-card rounded-xl p-4">
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
        {value != null ? `${value.toFixed(1)}${unit === "USD" ? "" : unit}` : "–"}
        {unit === "USD" && value != null && <span className="text-sm ml-1" style={{ color: "var(--text-muted)" }}>USD</span>}
      </p>
      {trend != null && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-mono ${trendPositive ? "text-emerald-400" : "text-red-400"}`}>
          {trendPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendPositive ? "+" : ""}{trend.toFixed(1)}{unit !== "USD" ? unit : "%"} vs an préc.
        </div>
      )}
    </div>
  );
}

function IndicatorChart({ code, points }: { code: string; points: { period: string; value: number }[] }) {
  const meta = getIndicatorMeta(code);
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  return (
    <div className="mansa-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{meta.label}</p>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{meta.unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
          <XAxis dataKey="period" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "8px", fontSize: "12px" }}
            itemStyle={{ color: "var(--text-secondary)" }}
            formatter={(v: number) => [`${v.toFixed(2)} ${meta.unit}`, meta.label]}
          />
          <Line type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} dot={{ r: 3, fill: meta.color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Scorecard component ─────────────────────────────── */
function Scorecard({ items, grade }: { items: ScoreItem[]; grade: ReturnType<typeof compositeGrade> }) {
  const STATUS_CONFIG: Record<ScoreStatus, { bg: string; text: string; label: string }> = {
    ok:   { bg: "rgba(16,185,129,0.12)",  text: "#10B981", label: "✓ OK"   },
    warn: { bg: "rgba(245,158,11,0.12)",  text: "#F59E0B", label: "⚠ Vigilance" },
    bad:  { bg: "rgba(239,68,68,0.12)",   text: "#EF4444", label: "✗ Risque" },
  };
  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={15} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Scorecard macro — Note composite
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-4xl font-bold leading-none" style={{ color: grade.color }}>{grade.grade}</p>
            <p className="text-xs mt-1" style={{ color: grade.color }}>{grade.label}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          return (
            <div key={item.label} className="flex items-center gap-3 py-2 border-b last:border-0"
                 style={{ borderColor: "var(--bg-border)" }}>
              <span className="text-sm flex-1" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
              <span className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>{item.value}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium w-28 text-center"
                    style={{ background: cfg.bg, color: cfg.text }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────── */
export default function CountryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const countryId = id.toUpperCase();
  const [exportOpen, setExportOpen] = useState(false);

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const { data: macro, isLoading, isError, refetch } = useQuery({
    queryKey: ["country-macro", countryId],
    queryFn: () => macroApi.getCountryMacro(countryId, { from_year: 2015, to_year: 2024 }),
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

  const getLatestAndTrend = (code: string) => {
    const pts = macro?.indicators?.[code] ?? [];
    if (pts.length === 0) return { latest: null, trend: null };
    const sorted = [...pts].sort((a: { period: string }, b: { period: string }) => b.period.localeCompare(a.period));
    const latest = sorted[0].value;
    const prev = sorted[1]?.value ?? null;
    return { latest, trend: prev != null ? latest - prev : null };
  };

  const gdp  = getLatestAndTrend("NGDP_RPCH");
  const inf  = getLatestAndTrend("PCPIPCH");
  const fis  = getLatestAndTrend("GGXCNL_NGDP");
  const dbt  = getLatestAndTrend("GGXWDG_NGDP");
  const ca   = getLatestAndTrend("BCA_NGDPD");
  const res  = getLatestAndTrend("ASSDRESES");
  const gdppc = getLatestAndTrend("NGDPDPC");

  const scoreItems  = buildScorecard(gdp.latest, inf.latest, dbt.latest, fis.latest, ca.latest, res.latest);
  const grade       = compositeGrade(scoreItems);
  const narrative   = !isLoading
    ? generateNarrative(macro?.country_name ?? countryId, gdp.latest, inf.latest, dbt.latest, fis.latest, ca.latest, res.latest)
    : null;

  const tier = meta ? TIER_LABEL[meta.coverage_tier as number] : null;

  const handleExport = async (): Promise<ExportRow[]> => {
    const rows: ExportRow[] = [];
    Object.entries(macro?.indicators ?? {}).forEach(([code, pts]) => {
      (pts as { period: string; value: number }[]).forEach((p) => {
        rows.push({ country: countryId, indicator: code, period: p.period, value: p.value });
      });
    });
    return rows;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + Header */}
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/countries")}
            className="flex items-center gap-2 text-sm mb-4 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={14} />
            Retour aux pays
          </button>
          <button onClick={() => setExportOpen(true)} className="mansa-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5 mb-4">
            <Download size={12} /> Exporter
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-5xl">{meta?.flag_emoji ?? "🌍"}</span>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              {macro?.country_name ?? countryId}
            </h1>
            {meta?.name_fr && meta.name_fr !== macro?.country_name && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{meta.name_fr}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                {countryId}
              </span>
              {meta?.region && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {REGION_LABELS[meta.region] ?? meta.region}
                </span>
              )}
              {meta?.currency_code && (
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{meta.currency_code}</span>
              )}
              {tier && (
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${tier.color}`}>
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
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="mansa-card rounded-xl p-4 h-24 skeleton" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard label="Croissance PIB"   value={gdp.latest}   unit="%"     trend={gdp.trend}  />
          <KPICard label="Inflation"         value={inf.latest}   unit="%"     trend={inf.trend}  />
          <KPICard label="Solde budgétaire"  value={fis.latest}   unit="% PIB" trend={fis.trend}  />
          <KPICard label="Dette publique"    value={dbt.latest}   unit="% PIB" trend={dbt.trend}  />
        </div>
      )}

      {/* Scorecard + Narrative */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Scorecard items={scoreItems} grade={grade} />

          <div className="space-y-4">
            {/* Narrative */}
            {narrative && (
              <div className="mansa-card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--mansa-green)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Synthèse macro-fiscale
                  </h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {narrative}
                </p>
              </div>
            )}

            {/* PIB par habitant + chômage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>PIB par habitant</p>
                <p className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {gdppc.latest != null ? `$${gdppc.latest.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}` : "—"}
                </p>
              </div>
              <div className="mansa-card rounded-xl p-4">
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Note composite</p>
                <p className="text-xl font-bold font-mono" style={{ color: grade.color }}>
                  {grade.grade} — {grade.label}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graphiques */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
          Séries temporelles 2015–2024
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mansa-card rounded-xl p-4 h-52 skeleton" />)}
          </div>
        ) : Object.values(macro?.indicators ?? {}).some((pts) => (pts as []).length > 0) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(macro?.indicators ?? {}).map(([code, pts]) =>
              (pts as { period: string; value: number }[]).length > 0 ? (
                <IndicatorChart key={code} code={code} points={pts as { period: string; value: number }[]} />
              ) : null
            )}
          </div>
        ) : (
          <div className="mansa-card rounded-xl p-8 text-center">
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Aucune série temporelle disponible pour ce pays.
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Les données macro-fiscales sont chargées par les pipelines Dagster (IMF WEO · World Bank WDI).
              Lancez <code className="text-[#00D4AA] bg-[#00D4AA]/10 px-1 rounded">dagster job execute -j full_historical_refresh</code> pour les charger.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs pb-4" style={{ color: "var(--text-muted)" }}>
        Sources : FMI World Economic Outlook · Banque Mondiale WDI · MANSA Terminal
      </p>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        getData={handleExport}
        defaultFilename={`mansa-country-${countryId.toLowerCase()}`}
        title={`Exporter ${macro?.country_name ?? countryId}`}
        subtitle="Toutes les séries temporelles macro-fiscales disponibles"
      />
    </div>
  );
}
