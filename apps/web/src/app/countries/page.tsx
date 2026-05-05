"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Globe, TrendingUp, Filter } from "lucide-react";
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

const REGIONS = [
  "All",
  "West Africa",
  "East Africa",
  "North Africa",
  "Central Africa",
  "Southern Africa",
];

const TIER_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Full", color: "text-emerald-400 bg-emerald-400/10" },
  2: { label: "Moderate", color: "text-amber-400 bg-amber-400/10" },
  3: { label: "Basic", color: "text-gray-400 bg-gray-400/10" },
};

export default function CountriesPage() {
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");

  const { data: countries = [], isLoading } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60, // 1 heure
  });

  const filtered = useMemo(() => {
    return countries.filter((c) => {
      const matchSearch =
        !search ||
        c.name_en.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        (c.name_fr ?? "").toLowerCase().includes(search.toLowerCase());

      const matchRegion =
        selectedRegion === "All" || c.region === selectedRegion;

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Globe size={22} className="text-[#00D4AA]" />
            Country Coverage
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {countries.length} économies africaines · IMF / World Bank · Tiers 1–3
          </p>
        </div>

        {/* Stats rapides */}
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((tier) => {
            const count = countries.filter((c) => c.coverage_tier === tier).length;
            const t = TIER_LABEL[tier];
            return (
              <div
                key={tier}
                className="bg-[#0F1629] border border-[#1E2A42] rounded-lg px-3 py-1.5 text-xs"
              >
                <span className={`font-semibold ${t.color.split(" ")[0]}`}>
                  Tier {tier}
                </span>
                <span className="text-gray-500 ml-1">{count} pays</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[#0F1629] border border-[#1E2A42]
                        rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search size={14} className="text-gray-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un pays..."
            className="bg-transparent text-sm text-gray-300 placeholder-gray-600
                       focus:outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <div className="flex gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRegion(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedRegion === r
                    ? "bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30"
                    : "bg-[#0F1629] border border-[#1E2A42] text-gray-400 hover:text-gray-200"
                }`}
              >
                {r === "All" ? "Tous" : r.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste par région */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#0F1629] border border-[#1E2A42] rounded-xl p-4 h-28 skeleton"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun pays trouvé pour &quot;{search}&quot;
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byRegion)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([region, regionCountries]) => (
              <div key={region}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-gray-300">{region}</h2>
                  <span className="text-xs text-gray-600">
                    ({regionCountries.length})
                  </span>
                  <div className="flex-1 h-px bg-[#1E2A42]" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {regionCountries.map((country) => (
                    <CountryCard key={country.id} country={country} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function CountryCard({ country }: { country: Country }) {
  const tier = TIER_LABEL[country.coverage_tier];

  return (
    <Link
      href={`/countries/${country.id}`}
      className="bg-[#0F1629] border border-[#1E2A42] rounded-xl p-4
                 hover:border-[#00D4AA]/30 hover:bg-[#00D4AA]/5
                 transition-all cursor-pointer group block"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{country.flag_emoji ?? "🌍"}</span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                      ${tier.color}`}
        >
          T{country.coverage_tier}
        </span>
      </div>

      <div className="font-semibold text-sm text-white group-hover:text-[#00D4AA]
                      transition-colors leading-tight mb-1">
        {country.name_en}
      </div>

      {country.name_fr && country.name_fr !== country.name_en && (
        <div className="text-xs text-gray-600 mb-2">{country.name_fr}</div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-xs text-gray-500 font-mono">{country.id}</span>
        {country.currency_code && (
          <span className="text-xs text-gray-600 flex items-center gap-1">
            <TrendingUp size={10} />
            {country.currency_code}
          </span>
        )}
      </div>
    </Link>
  );
}
