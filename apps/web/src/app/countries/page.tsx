"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Globe, TrendingUp, Filter, BarChart2, X, CheckCircle2 } from "lucide-react";
import { macroApi } from "@/lib/api";

interface Country {
  id: string;
  iso2: string;
  name_en: string;
  name_fr: string | null;
  region: string | null;
  currency_code: string | null;
  coverage_tier: number;
  flag_emoji: string | null;
}

const REGION_LABELS: Record<string, string> = {
  "All": "Tous",
  "West Africa": "Afrique de l'Ouest",
  "East Africa": "Afrique de l'Est",
  "North Africa": "Afrique du Nord",
  "Central Africa": "Afrique Centrale",
  "Southern Africa": "Afrique Australe",
};
const REGIONS = Object.keys(REGION_LABELS);

const TIER_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Complet", color: "text-emerald-400 bg-emerald-400/10" },
  2: { label: "Modéré",  color: "text-amber-400 bg-amber-400/10"    },
  3: { label: "Basique", color: "text-gray-400 bg-gray-400/10"      },
};

/* ── Données comparateur (baseline prototype) ─────────────────────── */
const MACRO_BASELINE: Record<string, {
  growth: number; inflation: number; debt: number; fiscal: number; ca: number;
}> = {
  NGA: { growth: 3.1, inflation: 32.5, debt: 46,  fiscal: -4.6, ca:  0.8 },
  EGY: { growth: 2.7, inflation: 28.3, debt: 90,  fiscal: -7.2, ca: -5.4 },
  ZAF: { growth: 1.1, inflation:  4.6, debt: 75,  fiscal: -5.0, ca: -1.6 },
  ETH: { growth: 6.5, inflation: 24.1, debt: 38,  fiscal: -2.6, ca: -3.1 },
  KEN: { growth: 5.0, inflation:  6.5, debt: 70,  fiscal: -5.5, ca: -4.0 },
  GHA: { growth: 3.1, inflation: 22.3, debt: 83,  fiscal: -4.6, ca: -2.0 },
  CIV: { growth: 6.5, inflation:  3.8, debt: 57,  fiscal: -4.0, ca: -3.7 },
  MAR: { growth: 3.2, inflation:  2.4, debt: 69,  fiscal: -4.1, ca: -1.2 },
  TZA: { growth: 5.4, inflation:  3.1, debt: 42,  fiscal: -3.0, ca: -3.5 },
  SEN: { growth: 8.3, inflation:  2.8, debt: 73,  fiscal: -4.9, ca:-12.1 },
  RWA: { growth: 7.0, inflation:  5.8, debt: 68,  fiscal: -6.0, ca:-11.4 },
  AGO: { growth: 2.4, inflation: 28.2, debt: 73,  fiscal: -1.0, ca:  4.5 },
};

const COMPARE_COLORS = ["#00D4AA","#3B82F6","#F59E0B","#A78BFA","#F87171","#34D399","#FB923C","#60A5FA"];
const COMPARE_INDICATORS = [
  { code: "growth",    label: "Croissance PIB (%)" },
  { code: "inflation", label: "Inflation (%)" },
  { code: "debt",      label: "Dette publique (% PIB)" },
  { code: "fiscal",    label: "Solde budgétaire (% PIB)" },
  { code: "ca",        label: "Compte courant (% PIB)" },
];

function ComparePanel({ picked, countries, onRemove }: {
  picked: string[];
  countries: Country[];
  onRemove: (id: string) => void;
}) {
  const [indicator, setIndicator] = useState("growth");
  const indMeta = COMPARE_INDICATORS.find((i) => i.code === indicator)!;

  const rows = picked.map((id, idx) => {
    const c = countries.find((x) => x.id === id);
    const v = MACRO_BASELINE[id]?.[indicator as keyof typeof MACRO_BASELINE[string]];
    return { id, name: c?.name_fr ?? c?.name_en ?? id, flag: c?.flag_emoji ?? "🌍", color: COMPARE_COLORS[idx % COMPARE_COLORS.length], value: v };
  });

  const allVals  = rows.map((r) => r.value ?? 0);
  const maxAbs   = Math.max(...allVals.map(Math.abs), 0.1);

  return (
    <div className="mansa-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={15} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Comparateur pays — {picked.length} pays sélectionnés
          </h3>
        </div>
        <select
          value={indicator}
          onChange={(e) => setIndicator(e.target.value)}
          className="text-xs rounded-lg px-2 py-1 border focus:outline-none"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
        >
          {COMPARE_INDICATORS.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
        </select>
      </div>

      <div className="space-y-2.5">
        {rows.sort((a, b) => {
          // Sort by absolute value descending
          const av = a.value ?? 0; const bv = b.value ?? 0;
          return indicator === "inflation" || indicator === "debt" ? bv - av : bv - av;
        }).map((row) => {
          const pct = maxAbs > 0 ? Math.abs(row.value ?? 0) / maxAbs * 100 : 0;
          const isNeg = (row.value ?? 0) < 0;
          return (
            <div key={row.id} className="flex items-center gap-3">
              <span className="text-base">{row.flag}</span>
              <span className="text-xs w-28 truncate" style={{ color: "var(--text-secondary)" }}>{row.name}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative h-5 rounded" style={{ background: "var(--bg-border)" }}>
                  <div
                    className="absolute top-0 h-full rounded transition-all"
                    style={{
                      width: `${pct}%`,
                      background: isNeg ? "#EF4444" : row.color,
                      left: isNeg ? `${50 - pct / 2}%` : "0%",
                    }}
                  />
                </div>
                <span className="text-xs font-bold font-mono w-14 text-right"
                      style={{ color: isNeg ? "#EF4444" : row.color }}>
                  {row.value != null ? (row.value > 0 ? "+" : "") + row.value.toFixed(1) : "—"}
                </span>
              </div>
              <button onClick={() => onRemove(row.id)} style={{ color: "var(--text-muted)" }}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        {indMeta.label} · Données 2024e · Cliquez sur les pays pour les ajouter/retirer du comparateur
      </p>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────── */
export default function CountriesPage() {
  const [search,         setSearch]         = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("All");
  const [compareMode,    setCompareMode]    = useState(false);
  const [picked,         setPicked]         = useState<string[]>(["NGA","ZAF","EGY","KEN"]);

  const { data: countries = [], isLoading } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const filtered = useMemo(() => {
    return countries.filter((c) => {
      const matchSearch =
        !search ||
        c.name_en.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        (c.name_fr ?? "").toLowerCase().includes(search.toLowerCase());
      const matchRegion = selectedRegion === "All" || c.region === selectedRegion;
      return matchSearch && matchRegion;
    });
  }, [countries, search, selectedRegion]);

  const byRegion = useMemo(() => {
    if (selectedRegion !== "All") return { [selectedRegion]: filtered };
    return filtered.reduce<Record<string, Country[]>>((acc, c) => {
      const r = c.region ?? "Other";
      if (!acc[r]) acc[r] = [];
      acc[r].push(c);
      return acc;
    }, {});
  }, [filtered, selectedRegion]);

  const togglePick = (id: string) => {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 8 ? [...prev, id] : prev
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <Globe size={22} style={{ color: "var(--mansa-green)" }} />
            Couverture des pays
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {countries.length} économies africaines · FMI / Banque Mondiale · Niveaux 1–3
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCompareMode((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-all"
            style={
              compareMode
                ? { background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
            }
          >
            <BarChart2 size={13} />
            Comparateur
            {compareMode && picked.length > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: "var(--mansa-green)" }}>{picked.length}</span>
            )}
          </button>
          {[1, 2, 3].map((tier) => {
            const count = countries.filter((c) => c.coverage_tier === tier).length;
            const t = TIER_LABEL[tier];
            return (
              <div key={tier} className="mansa-card rounded-lg px-3 py-1.5 text-xs">
                <span className={`font-semibold ${t.color.split(" ")[0]}`}>Tier {tier}</span>
                <span className="ml-1" style={{ color: "var(--text-muted)" }}>{count} pays</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparateur */}
      {compareMode && (
        <div className="space-y-3">
          <ComparePanel picked={picked} countries={countries} onRemove={(id) => togglePick(id)} />
          {picked.length < 8 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Cliquez sur un pays dans la liste ci-dessous pour l&apos;ajouter au comparateur (max 8). Actuellement : {picked.length}/8
            </p>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 max-w-sm border"
             style={{ background: "var(--input-bg)", borderColor: "var(--input-border)" }}>
          <Search size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un pays..."
            className="bg-transparent text-sm focus:outline-none w-full"
            style={{ color: "var(--text-secondary)" }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "var(--text-muted)" }} />
          <div className="flex gap-1.5 flex-wrap">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRegion(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                style={
                  selectedRegion === r
                    ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", color: "var(--mansa-green)", borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)" }
                    : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
                }
              >
                {r === "All" ? "Tous" : REGION_LABELS[r]?.split(" ")[0] ?? r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mansa-card rounded-xl p-4 h-28 skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          Aucun pays trouvé pour &quot;{search}&quot;
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byRegion)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([region, regionCountries]) => (
              <div key={region}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {REGION_LABELS[region] ?? region}
                  </h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>({regionCountries.length})</span>
                  <div className="flex-1 h-px" style={{ background: "var(--bg-border)" }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {regionCountries.map((country) => (
                    <CountryCard
                      key={country.id}
                      country={country}
                      compareMode={compareMode}
                      isPicked={picked.includes(country.id)}
                      onToggle={() => togglePick(country.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function CountryCard({ country, compareMode, isPicked, onToggle }: {
  country: Country;
  compareMode?: boolean;
  isPicked?: boolean;
  onToggle?: () => void;
}) {
  const tier = TIER_LABEL[country.coverage_tier];
  const macro = MACRO_BASELINE[country.id];

  if (compareMode) {
    return (
      <button
        onClick={onToggle}
        className="mansa-card rounded-xl p-4 text-left transition-all w-full"
        style={{
          borderColor: isPicked ? "var(--mansa-green)" : undefined,
          background: isPicked ? "color-mix(in srgb, var(--mansa-green) 6%, var(--card-bg))" : undefined,
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-2xl">{country.flag_emoji ?? "🌍"}</span>
          {isPicked && <CheckCircle2 size={14} className="text-emerald-400" />}
        </div>
        <div className="font-semibold text-sm leading-tight mb-1" style={{ color: isPicked ? "var(--mansa-green)" : "var(--text-primary)" }}>
          {country.name_fr ?? country.name_en}
        </div>
        {macro && (
          <div className="text-xs font-mono mt-2" style={{ color: "var(--text-muted)" }}>
            PIB: <span style={{ color: macro.growth >= 4 ? "#10B981" : macro.growth >= 2 ? "#F59E0B" : "#EF4444" }}>
              +{macro.growth.toFixed(1)}%
            </span>
          </div>
        )}
      </button>
    );
  }

  return (
    <Link
      href={`/countries/${country.id}`}
      className="mansa-card rounded-xl p-4 mansa-card-hover cursor-pointer block"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{country.flag_emoji ?? "🌍"}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tier.color}`}>
          T{country.coverage_tier}
        </span>
      </div>
      <div className="font-semibold text-sm leading-tight mb-1 transition-colors"
           style={{ color: "var(--text-primary)" }}>
        {country.name_en}
      </div>
      {country.name_fr && country.name_fr !== country.name_en && (
        <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{country.name_fr}</div>
      )}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{country.id}</span>
        {macro && (
          <span className="text-xs font-mono font-bold"
                style={{ color: macro.growth >= 4 ? "#10B981" : macro.growth >= 2 ? "#F59E0B" : "#EF4444" }}>
            +{macro.growth.toFixed(1)}%
          </span>
        )}
      </div>
    </Link>
  );
}
