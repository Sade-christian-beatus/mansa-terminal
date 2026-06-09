"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

// ── 54 pays africains — données FMI WEO 2024/2025e ───────────────────────────
const ALL_COUNTRIES: {
  id: string;
  flag: string;
  name: string;
  region: string;
  growth: number;
  inflation: number;
  fiscal: number;
  gdp: number;
}[] = [
  { id:"NGA", flag:"🇳🇬", name:"Nigeria",              region:"Afrique de l'Ouest",  growth:3.1,  inflation:32.5, fiscal:-4.6, gdp:477  },
  { id:"ZAF", flag:"🇿🇦", name:"Afrique du Sud",        region:"Afrique Australe",    growth:1.1,  inflation:4.6,  fiscal:-5.0, gdp:381  },
  { id:"EGY", flag:"🇪🇬", name:"Égypte",                region:"Afrique du Nord",     growth:2.7,  inflation:28.3, fiscal:-7.2, gdp:360  },
  { id:"DZA", flag:"🇩🇿", name:"Algérie",               region:"Afrique du Nord",     growth:3.6,  inflation:9.2,  fiscal:-5.8, gdp:239  },
  { id:"ETH", flag:"🇪🇹", name:"Éthiopie",              region:"Afrique de l'Est",    growth:6.8,  inflation:24.1, fiscal:-2.6, gdp:156  },
  { id:"MAR", flag:"🇲🇦", name:"Maroc",                 region:"Afrique du Nord",     growth:3.2,  inflation:2.4,  fiscal:-4.1, gdp:142  },
  { id:"AGO", flag:"🇦🇴", name:"Angola",                region:"Afrique Centrale",    growth:2.4,  inflation:28.2, fiscal:-1.0, gdp:108  },
  { id:"KEN", flag:"🇰🇪", name:"Kenya",                 region:"Afrique de l'Est",    growth:5.0,  inflation:6.5,  fiscal:-5.5, gdp:110  },
  { id:"GHA", flag:"🇬🇭", name:"Ghana",                 region:"Afrique de l'Ouest",  growth:3.1,  inflation:22.3, fiscal:-4.6, gdp:77   },
  { id:"TZA", flag:"🇹🇿", name:"Tanzanie",              region:"Afrique de l'Est",    growth:5.4,  inflation:3.1,  fiscal:-3.0, gdp:77   },
  { id:"CIV", flag:"🇨🇮", name:"Côte d'Ivoire",         region:"Afrique de l'Ouest",  growth:6.5,  inflation:3.8,  fiscal:-4.0, gdp:78   },
  { id:"CMR", flag:"🇨🇲", name:"Cameroun",              region:"Afrique Centrale",    growth:4.1,  inflation:7.4,  fiscal:-2.5, gdp:47   },
  { id:"TUN", flag:"🇹🇳", name:"Tunisie",               region:"Afrique du Nord",     growth:1.8,  inflation:9.3,  fiscal:-7.7, gdp:46   },
  { id:"COD", flag:"🇨🇩", name:"Congo (RDC)",            region:"Afrique Centrale",    growth:6.3,  inflation:23.6, fiscal:-1.0, gdp:65   },
  { id:"SEN", flag:"🇸🇳", name:"Sénégal",               region:"Afrique de l'Ouest",  growth:8.3,  inflation:2.8,  fiscal:-4.9, gdp:32   },
  { id:"UGA", flag:"🇺🇬", name:"Ouganda",               region:"Afrique de l'Est",    growth:6.1,  inflation:3.8,  fiscal:-4.4, gdp:50   },
  { id:"RWA", flag:"🇷🇼", name:"Rwanda",                region:"Afrique de l'Est",    growth:7.0,  inflation:5.8,  fiscal:-6.0, gdp:13   },
  { id:"MOZ", flag:"🇲🇿", name:"Mozambique",            region:"Afrique de l'Est",    growth:5.5,  inflation:6.2,  fiscal:-5.0, gdp:18   },
  { id:"ZMB", flag:"🇿🇲", name:"Zambie",                region:"Afrique Australe",    growth:4.8,  inflation:13.0, fiscal:-7.6, gdp:28   },
  { id:"LBY", flag:"🇱🇾", name:"Libye",                 region:"Afrique du Nord",     growth:4.0,  inflation:2.8,  fiscal:4.0,  gdp:37   },
  { id:"MLI", flag:"🇲🇱", name:"Mali",                  region:"Afrique de l'Ouest",  growth:4.0,  inflation:2.5,  fiscal:-3.5, gdp:22   },
  { id:"BFA", flag:"🇧🇫", name:"Burkina Faso",          region:"Afrique de l'Ouest",  growth:2.5,  inflation:3.0,  fiscal:-4.5, gdp:18   },
  { id:"NER", flag:"🇳🇪", name:"Niger",                 region:"Afrique de l'Ouest",  growth:12.3, inflation:3.9,  fiscal:-6.8, gdp:17   },
  { id:"BEN", flag:"🇧🇯", name:"Bénin",                 region:"Afrique de l'Ouest",  growth:6.4,  inflation:2.7,  fiscal:-4.7, gdp:19   },
  { id:"TGO", flag:"🇹🇬", name:"Togo",                  region:"Afrique de l'Ouest",  growth:6.0,  inflation:4.0,  fiscal:-3.8, gdp:8.9  },
  { id:"MWI", flag:"🇲🇼", name:"Malawi",                region:"Afrique de l'Est",    growth:1.8,  inflation:25.0, fiscal:-7.0, gdp:10   },
  { id:"MDG", flag:"🇲🇬", name:"Madagascar",            region:"Afrique de l'Est",    growth:4.8,  inflation:8.0,  fiscal:-4.8, gdp:15   },
  { id:"GIN", flag:"🇬🇳", name:"Guinée",                region:"Afrique de l'Ouest",  growth:6.5,  inflation:9.6,  fiscal:-3.3, gdp:16   },
  { id:"TCD", flag:"🇹🇩", name:"Tchad",                 region:"Afrique Centrale",    growth:3.0,  inflation:4.5,  fiscal:-1.0, gdp:13   },
  { id:"COG", flag:"🇨🇬", name:"Congo (Brazzaville)",   region:"Afrique Centrale",    growth:4.1,  inflation:4.0,  fiscal:-0.3, gdp:13   },
  { id:"MUS", flag:"🇲🇺", name:"Maurice",               region:"Afrique de l'Est",    growth:5.6,  inflation:7.0,  fiscal:-4.0, gdp:13   },
  { id:"BWA", flag:"🇧🇼", name:"Botswana",              region:"Afrique Australe",    growth:3.5,  inflation:5.5,  fiscal:-1.5, gdp:19   },
  { id:"NAM", flag:"🇳🇦", name:"Namibie",               region:"Afrique Australe",    growth:3.6,  inflation:5.8,  fiscal:-5.2, gdp:13   },
  { id:"SWZ", flag:"🇸🇿", name:"Eswatini",              region:"Afrique Australe",    growth:2.0,  inflation:5.9,  fiscal:-2.8, gdp:4.5  },
  { id:"ZWE", flag:"🇿🇼", name:"Zimbabwe",              region:"Afrique Australe",    growth:3.0,  inflation:165.0,fiscal:-3.0, gdp:26   },
  { id:"SOM", flag:"🇸🇴", name:"Somalie",               region:"Afrique de l'Est",    growth:3.5,  inflation:3.5,  fiscal:-1.0, gdp:10   },
  { id:"ERI", flag:"🇪🇷", name:"Érythrée",              region:"Afrique de l'Est",    growth:2.5,  inflation:5.0,  fiscal:-12.0,gdp:2.7  },
  { id:"DJI", flag:"🇩🇯", name:"Djibouti",              region:"Afrique de l'Est",    growth:7.1,  inflation:3.0,  fiscal:-1.5, gdp:4.0  },
  { id:"SLE", flag:"🇸🇱", name:"Sierra Leone",          region:"Afrique de l'Ouest",  growth:3.5,  inflation:37.0, fiscal:-8.3, gdp:5.0  },
  { id:"LBR", flag:"🇱🇷", name:"Liberia",               region:"Afrique de l'Ouest",  growth:4.5,  inflation:8.0,  fiscal:-5.0, gdp:4.3  },
  { id:"GMB", flag:"🇬🇲", name:"Gambie",                region:"Afrique de l'Ouest",  growth:5.8,  inflation:15.0, fiscal:-3.9, gdp:2.3  },
  { id:"GNB", flag:"🇬🇼", name:"Guinée-Bissau",         region:"Afrique de l'Ouest",  growth:4.2,  inflation:5.0,  fiscal:-3.5, gdp:1.9  },
  { id:"CPV", flag:"🇨🇻", name:"Cap-Vert",              region:"Afrique de l'Ouest",  growth:4.5,  inflation:7.5,  fiscal:-2.8, gdp:2.2  },
  { id:"GNQ", flag:"🇬🇶", name:"Guinée équatoriale",    region:"Afrique Centrale",    growth:-2.0, inflation:5.0,  fiscal:-6.5, gdp:12   },
  { id:"GAB", flag:"🇬🇦", name:"Gabon",                 region:"Afrique Centrale",    growth:2.5,  inflation:4.8,  fiscal:-1.8, gdp:20   },
  { id:"CAF", flag:"🇨🇫", name:"Centrafrique",          region:"Afrique Centrale",    growth:1.5,  inflation:5.3,  fiscal:-5.0, gdp:2.9  },
  { id:"BDI", flag:"🇧🇮", name:"Burundi",               region:"Afrique de l'Est",    growth:2.2,  inflation:22.0, fiscal:-5.0, gdp:2.9  },
  { id:"COM", flag:"🇰🇲", name:"Comores",               region:"Afrique de l'Est",    growth:3.1,  inflation:5.0,  fiscal:-2.5, gdp:1.4  },
  { id:"STP", flag:"🇸🇹", name:"São Tomé-et-Príncipe",  region:"Afrique Centrale",    growth:2.5,  inflation:17.0, fiscal:-3.0, gdp:0.7  },
  { id:"SYC", flag:"🇸🇨", name:"Seychelles",            region:"Afrique de l'Est",    growth:5.0,  inflation:4.5,  fiscal:-1.5, gdp:2.1  },
  { id:"LSO", flag:"🇱🇸", name:"Lesotho",               region:"Afrique Australe",    growth:1.8,  inflation:7.0,  fiscal:-5.5, gdp:2.5  },
  { id:"MRT", flag:"🇲🇷", name:"Mauritanie",            region:"Afrique de l'Ouest",  growth:3.9,  inflation:6.3,  fiscal:-1.0, gdp:10   },
  { id:"SSD", flag:"🇸🇸", name:"Soudan du Sud",         region:"Afrique de l'Est",    growth:-1.0, inflation:100.0,fiscal:-5.0, gdp:5.0  },
  { id:"SDN", flag:"🇸🇩", name:"Soudan",                region:"Afrique de l'Est",    growth:0.5,  inflation:65.0, fiscal:-3.0, gdp:36   },
];

const PAGE_SIZE = 5;
const AUTOPLAY_MS = 3500;

function TrendIcon({ value }: { value: number | null }) {
  if (value === null) return <Minus size={11} style={{ color: "var(--text-muted)" }} />;
  if (value > 0) return <TrendingUp size={11} className="text-emerald-400" />;
  return <TrendingDown size={11} className="text-red-400" />;
}

function fmt(v: number | null, unit: string): string {
  if (v === null || v === undefined) return "N/A";
  const prefix = v > 0 ? "+" : "";
  return unit === "%" ? `${prefix}${v.toFixed(1)}%` : `${v.toFixed(1)}`;
}

function CountryKPICard({ country, rank }: { country: typeof ALL_COUNTRIES[0]; rank: number }) {
  const router = useRouter();
  const { growth, inflation, fiscal, gdp } = country;

  return (
    <div
      onClick={() => router.push(`/countries/${country.id}`)}
      className="mansa-card mansa-card-hover rounded-xl p-4 cursor-pointer transition-all flex-1 min-w-0"
      style={{ borderColor: "var(--card-border)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{country.flag}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono px-1 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
              #{rank}
            </span>
            <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {country.name}
            </div>
          </div>
          <div className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>{country.region}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="space-y-2">
        {/* Croissance */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Croissance</span>
          <div className="flex items-center gap-1">
            <TrendIcon value={growth} />
            <span className="text-[11px] font-mono font-bold"
                  style={{ color: growth >= 4 ? "#10B981" : growth >= 2 ? "#F59E0B" : "#EF4444" }}>
              {fmt(growth, "%")}
            </span>
          </div>
        </div>
        {/* Inflation */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Inflation</span>
          <span className="text-[11px] font-mono font-bold"
                style={{ color: inflation > 15 ? "#EF4444" : inflation > 7 ? "#F59E0B" : "#10B981" }}>
            {fmt(inflation, "%")}
          </span>
        </div>
        {/* Fiscal */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Solde fiscal</span>
          <span className="text-[11px] font-mono font-bold"
                style={{ color: fiscal < -5 ? "#EF4444" : fiscal < -3 ? "#F59E0B" : "#10B981" }}>
            {fmt(fiscal, "%")}
          </span>
        </div>
        {/* Séparateur + PIB */}
        <div className="border-t pt-1.5" style={{ borderColor: "var(--bg-border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>PIB nominal</span>
            <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
              ${gdp >= 1 ? gdp.toFixed(0) : gdp.toFixed(1)} Mds
            </span>
          </div>
        </div>
      </div>

      <p className="text-[9px] mt-2.5 text-right" style={{ color: "var(--mansa-green)", opacity: 0.7 }}>
        Voir le profil →
      </p>
    </div>
  );
}

export function MacroKPIGrid() {
  const totalPages = Math.ceil(ALL_COUNTRIES.length / PAGE_SIZE);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setPage((p) => (p + 1) % totalPages), [totalPages]);
  const prev = useCallback(() => setPage((p) => (p - 1 + totalPages) % totalPages), [totalPages]);

  // Autoplay
  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, next]);

  const visible = ALL_COUNTRIES.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const startRank = page * PAGE_SIZE + 1;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Économies africaines · Indicateurs 2025e
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)", color: "var(--mansa-green)" }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, ALL_COUNTRIES.length)} / {ALL_COUNTRIES.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Source : FMI WEO · BM</span>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={prev}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors border"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => setPaused((p) => !p)}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors border"
              style={{ borderColor: "var(--bg-border)", color: paused ? "var(--mansa-green)" : "var(--text-muted)" }}
            >
              {paused ? <Play size={10} /> : <Pause size={10} />}
            </button>
            <button
              onClick={next}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors border"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Cartes */}
      <div className="flex gap-3">
        {visible.map((country, i) => (
          <CountryKPICard key={country.id} country={country} rank={startRank + i} />
        ))}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1 pt-1">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className="rounded-full transition-all"
            style={{
              width: i === page ? 16 : 5,
              height: 5,
              background: i === page ? "var(--mansa-green)" : "var(--bg-border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
