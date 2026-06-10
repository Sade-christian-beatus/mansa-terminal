"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { GitBranch, TrendingDown, TrendingUp, Info, Sliders } from "lucide-react";

// ── Données de base statiques (top 15 pays africains) ────────────────────────
const BASE_DATA: Record<string, {
  name: string; flag: string; region: string;
  growth: number; inflation: number; debt: number;
  oil_exporter: boolean; agri_pct: number; ext_debt_usd: number;
}> = {
  NGA: { name: "Nigeria",       flag: "🇳🇬", region: "Afrique de l'Ouest", growth: 3.1,  inflation: 32.5, debt: 46.0, oil_exporter: true,  agri_pct: 24, ext_debt_usd: 42.0 },
  ZAF: { name: "Afrique du Sud",flag: "🇿🇦", region: "Afrique Australe",   growth: 1.1,  inflation: 4.6,  debt: 75.0, oil_exporter: false, agri_pct: 2,  ext_debt_usd: 165.0 },
  EGY: { name: "Égypte",        flag: "🇪🇬", region: "Afrique du Nord",    growth: 3.8,  inflation: 28.0, debt: 95.0, oil_exporter: false, agri_pct: 11, ext_debt_usd: 165.0 },
  DZA: { name: "Algérie",       flag: "🇩🇿", region: "Afrique du Nord",    growth: 3.7,  inflation: 7.2,  debt: 55.0, oil_exporter: true,  agri_pct: 12, ext_debt_usd: 6.0  },
  MAR: { name: "Maroc",         flag: "🇲🇦", region: "Afrique du Nord",    growth: 3.2,  inflation: 3.9,  debt: 70.0, oil_exporter: false, agri_pct: 14, ext_debt_usd: 58.0 },
  ETH: { name: "Éthiopie",      flag: "🇪🇹", region: "Afrique de l'Est",   growth: 6.4,  inflation: 25.0, debt: 28.0, oil_exporter: false, agri_pct: 35, ext_debt_usd: 28.0 },
  KEN: { name: "Kenya",         flag: "🇰🇪", region: "Afrique de l'Est",   growth: 5.0,  inflation: 6.3,  debt: 72.0, oil_exporter: false, agri_pct: 22, ext_debt_usd: 39.0 },
  GHA: { name: "Ghana",         flag: "🇬🇭", region: "Afrique de l'Ouest", growth: 3.5,  inflation: 23.0, debt: 90.0, oil_exporter: false, agri_pct: 19, ext_debt_usd: 31.0 },
  CIV: { name: "Côte d'Ivoire", flag: "🇨🇮", region: "Afrique de l'Ouest", growth: 6.2,  inflation: 4.0,  debt: 60.0, oil_exporter: false, agri_pct: 28, ext_debt_usd: 15.0 },
  TZA: { name: "Tanzanie",      flag: "🇹🇿", region: "Afrique de l'Est",   growth: 5.3,  inflation: 4.5,  debt: 40.0, oil_exporter: false, agri_pct: 26, ext_debt_usd: 24.0 },
  SEN: { name: "Sénégal",       flag: "🇸🇳", region: "Afrique de l'Ouest", growth: 7.1,  inflation: 5.0,  debt: 76.0, oil_exporter: true,  agri_pct: 17, ext_debt_usd: 14.0 },
  CMR: { name: "Cameroun",      flag: "🇨🇲", region: "Afrique Centrale",   growth: 3.8,  inflation: 5.5,  debt: 45.0, oil_exporter: true,  agri_pct: 16, ext_debt_usd: 14.0 },
  MLI: { name: "Mali",          flag: "🇲🇱", region: "Sahel",              growth: 3.5,  inflation: 3.5,  debt: 50.0, oil_exporter: false, agri_pct: 37, ext_debt_usd: 8.0  },
  BFA: { name: "Burkina Faso",  flag: "🇧🇫", region: "Sahel",              growth: 2.5,  inflation: 3.8,  debt: 58.0, oil_exporter: false, agri_pct: 30, ext_debt_usd: 6.0  },
  NER: { name: "Niger",         flag: "🇳🇪", region: "Sahel",              growth: 5.8,  inflation: 3.2,  debt: 55.0, oil_exporter: false, agri_pct: 40, ext_debt_usd: 7.0  },
};

// ── Définition des scénarios ──────────────────────────────────────────────────
const SCENARIOS = {
  oil_shock: {
    id: "oil_shock",
    label: "Choc pétrolier +20%",
    icon: TrendingUp,
    color: "#F59E0B",
    description: "Simulation d'une hausse du prix du baril de 20%. Bénéfice pour les exportateurs, pression pour les importateurs.",
    params: [
      { key: "oil_pct", label: "Variation prix pétrole (%)", min: -50, max: 100, default: 20, step: 5 },
    ],
    compute: (country: typeof BASE_DATA[string], params: Record<string, number>) => {
      const shock = params.oil_pct / 100;
      const growthDelta = country.oil_exporter
        ? shock * 0.3
        : -shock * 0.1 * (1 - country.agri_pct / 100);
      const inflationDelta = country.oil_exporter ? -0.5 : shock * 1.5;
      return { growthDelta, inflationDelta, debtDelta: 0 };
    },
  },
  fed_rate: {
    id: "fed_rate",
    label: "Hausse taux Fed +100bps",
    icon: TrendingDown,
    color: "#8B5CF6",
    description: "Impact d'une hausse de 100 points de base du taux directeur de la Fed sur les économies africaines (flux de capitaux, dette externe).",
    params: [
      { key: "bps", label: "Hausse taux Fed (bps)", min: 25, max: 300, default: 100, step: 25 },
    ],
    compute: (country: typeof BASE_DATA[string], params: Record<string, number>) => {
      const shock = params.bps / 100;
      const growthDelta = -0.2 * shock - (country.ext_debt_usd / 100) * 0.05 * shock;
      const inflationDelta = 0.3 * shock;
      const debtDelta = (country.ext_debt_usd / 100) * shock * 2;
      return { growthDelta, inflationDelta, debtDelta };
    },
  },
  drought_sahel: {
    id: "drought_sahel",
    label: "Sécheresse Sahel",
    icon: TrendingDown,
    color: "#ef4444",
    description: "Impact d'une sécheresse sévère sur les pays du Sahel et les économies à forte dépendance agricole.",
    params: [
      { key: "agri_loss_pct", label: "Perte agricole (%)", min: 5, max: 50, default: 20, step: 5 },
    ],
    compute: (country: typeof BASE_DATA[string], params: Record<string, number>) => {
      const shock = (params.agri_loss_pct / 100) * (country.agri_pct / 100);
      const growthDelta = -shock * 2.5;
      const inflationDelta = shock * 8;
      const debtDelta = shock * 5;
      return { growthDelta, inflationDelta, debtDelta };
    },
  },
};

type ScenarioKey = keyof typeof SCENARIOS;

const COLORS_BAR = { positive: "#00D4AA", negative: "#ef4444" };

export default function ScenariosPage() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("oil_shock");
  const [params, setParams] = useState<Record<string, number>>({
    oil_pct: 20, bps: 100, agri_loss_pct: 20,
  });
  const [selectedMetric, setSelectedMetric] = useState<"growth" | "inflation" | "debt">("growth");

  const scenario = SCENARIOS[selectedScenario];

  const results = useMemo(() => {
    return Object.entries(BASE_DATA).map(([id, country]) => {
      const { growthDelta, inflationDelta, debtDelta } = scenario.compute(country, params);
      return {
        id,
        name: country.name,
        flag: country.flag,
        region: country.region,
        base: {
          growth: country.growth,
          inflation: country.inflation,
          debt: country.debt,
        },
        scenario: {
          growth: Math.round((country.growth + growthDelta) * 10) / 10,
          inflation: Math.round((country.inflation + inflationDelta) * 10) / 10,
          debt: Math.round((country.debt + debtDelta) * 10) / 10,
        },
        delta: {
          growth: Math.round(growthDelta * 10) / 10,
          inflation: Math.round(inflationDelta * 10) / 10,
          debt: Math.round(debtDelta * 10) / 10,
        },
        oil_exporter: country.oil_exporter,
      };
    }).sort((a, b) => b.delta[selectedMetric] - a.delta[selectedMetric]);
  }, [selectedScenario, params, selectedMetric]);

  const metricLabel = { growth: "Croissance PIB (%)", inflation: "Inflation (%)", debt: "Dette % PIB" };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <GitBranch size={24} style={{ color: "var(--mansa-green)" }} />
            Analyse de Scénarios
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Simulation de chocs macroéconomiques — impact sur les 15 principales économies africaines
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          Données de référence 2024
        </span>
      </div>

      {/* Sélecteur de scénario */}
      <div className="grid grid-cols-3 gap-3">
        {Object.values(SCENARIOS).map((sc) => {
          const Icon = sc.icon;
          const isActive = selectedScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => setSelectedScenario(sc.id as ScenarioKey)}
              className="p-4 rounded-2xl text-left transition-all border"
              style={{
                background: isActive ? `color-mix(in srgb, ${sc.color} 10%, var(--card-bg))` : "var(--card-bg)",
                borderColor: isActive ? sc.color : "var(--bg-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: sc.color }} />
                <span className="text-sm font-bold" style={{ color: sc.color }}>{sc.label}</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sc.description}</p>
            </button>
          );
        })}
      </div>

      {/* Paramètres du scénario */}
      <div className="rounded-2xl border p-5" style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={15} style={{ color: "var(--mansa-green)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Paramètres</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {scenario.params.map((p) => (
            <div key={p.key}>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{p.label}</label>
                <span className="text-xs font-bold" style={{ color: "var(--mansa-green)" }}>
                  {params[p.key] > 0 ? "+" : ""}{params[p.key]}
                </span>
              </div>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={params[p.key]}
                onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: Number(e.target.value) }))}
                className="w-full accent-[#00D4AA]"
              />
              <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                <span>{p.min}</span>
                <span>{p.max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sélecteur de métrique */}
      <div className="flex gap-2">
        {(["growth", "inflation", "debt"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMetric(m)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: selectedMetric === m ? "var(--mansa-green)" : "var(--input-bg)",
              color: selectedMetric === m ? "#000" : "var(--text-secondary)",
              border: "1px solid var(--input-border)",
            }}
          >
            {metricLabel[m]}
          </button>
        ))}
      </div>

      {/* Graphique impact */}
      <div className="rounded-2xl border p-5" style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
          Impact scénario sur {metricLabel[selectedMetric].toLowerCase()}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={results} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <XAxis
              dataKey="flag"
              tick={{ fontSize: 18 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
            />
            <Tooltip
              contentStyle={{ background: "var(--dropdown-bg)", border: "1px solid var(--bg-border)", borderRadius: 12, fontSize: 12 }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
              formatter={(val: number) => [`${val > 0 ? "+" : ""}${val}`, "Variation"]}
            />
            <ReferenceLine y={0} stroke="var(--bg-border)" />
            <Bar dataKey={`delta.${selectedMetric}`} radius={[4, 4, 0, 0]}>
              {results.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={(entry.delta[selectedMetric] ?? 0) >= 0 ? COLORS_BAR.positive : COLORS_BAR.negative}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau détaillé */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--bg-border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--bg-border)" }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>Pays</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text-muted)" }}>Croissance base</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: "#F59E0B" }}>→ Scénario</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text-muted)" }}>Inflation base</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: "#F59E0B" }}>→ Scénario</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: "var(--text-muted)" }}>Dette base</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: "#F59E0B" }}>→ Scénario</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: idx < results.length - 1 ? "1px solid var(--bg-border)" : "none" }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{r.flag}</span>
                      <div>
                        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{r.name}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.region}</div>
                      </div>
                    </div>
                  </td>
                  {(["growth", "inflation", "debt"] as const).map((m) => (
                    <>
                      <td key={`base-${m}`} className="px-4 py-3 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {r.base[m].toFixed(1)}%
                      </td>
                      <td key={`sc-${m}`} className="px-4 py-3 text-right tabular-nums font-semibold">
                        <span style={{ color: r.delta[m] >= 0 ? "#00D4AA" : "#ef4444" }}>
                          {r.scenario[m].toFixed(1)}%
                        </span>
                        <span className="text-[10px] ml-1" style={{ color: r.delta[m] >= 0 ? "#00D4AA" : "#ef4444" }}>
                          ({r.delta[m] >= 0 ? "+" : ""}{r.delta[m].toFixed(1)})
                        </span>
                      </td>
                    </>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        <Info size={10} className="inline mr-1" />
        Modèle de simulation simplifié basé sur les élasticités macro standard (FMI/BM). Résultats indicatifs — non substituables à une analyse DSA formelle.
      </p>
    </div>
  );
}
