"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter } from "lucide-react";

interface CountryRow {
  id: string;
  flag: string;
  name: string;
  region: string;
  gdp: number;      // Mds USD
  gdp_pc: number;   // USD/hab
  growth: number;   // %
  inflation: number;// %
  debt: number;     // % PIB
  fiscal: number;   // % PIB
  ca: number;       // % PIB
  pop: number;      // millions
}

const DATA_2024: CountryRow[] = [
  { id:"NGA", flag:"🇳🇬", name:"Nigeria",           region:"Afrique de l'Ouest",   gdp:477,  gdp_pc:2200,  growth:3.1,  inflation:32.5, debt:46,  fiscal:-4.6, ca:0.8,   pop:223 },
  { id:"ZAF", flag:"🇿🇦", name:"Afrique du Sud",    region:"Afrique Australe",      gdp:381,  gdp_pc:6200,  growth:1.1,  inflation:4.6,  debt:75,  fiscal:-5.0, ca:-1.6,  pop:61  },
  { id:"EGY", flag:"🇪🇬", name:"Égypte",            region:"Afrique du Nord",       gdp:360,  gdp_pc:3400,  growth:2.7,  inflation:28.3, debt:90,  fiscal:-7.2, ca:-5.4,  pop:106 },
  { id:"DZA", flag:"🇩🇿", name:"Algérie",           region:"Afrique du Nord",       gdp:239,  gdp_pc:5200,  growth:3.6,  inflation:9.2,  debt:60,  fiscal:-5.8, ca:2.4,   pop:46  },
  { id:"ETH", flag:"🇪🇹", name:"Éthiopie",          region:"Afrique de l'Est",      gdp:156,  gdp_pc:1300,  growth:6.8,  inflation:24.1, debt:38,  fiscal:-2.6, ca:-3.1,  pop:120 },
  { id:"MAR", flag:"🇲🇦", name:"Maroc",             region:"Afrique du Nord",       gdp:142,  gdp_pc:3700,  growth:3.2,  inflation:2.4,  debt:69,  fiscal:-4.1, ca:-1.2,  pop:37  },
  { id:"KEN", flag:"🇰🇪", name:"Kenya",             region:"Afrique de l'Est",      gdp:110,  gdp_pc:2100,  growth:5.0,  inflation:6.5,  debt:70,  fiscal:-5.5, ca:-4.0,  pop:53  },
  { id:"AGO", flag:"🇦🇴", name:"Angola",            region:"Afrique Centrale",      gdp:108,  gdp_pc:3100,  growth:2.4,  inflation:28.2, debt:73,  fiscal:-1.0, ca:4.5,   pop:35  },
  { id:"GHA", flag:"🇬🇭", name:"Ghana",             region:"Afrique de l'Ouest",    gdp:77,   gdp_pc:2400,  growth:3.1,  inflation:22.3, debt:83,  fiscal:-4.6, ca:-2.0,  pop:33  },
  { id:"CIV", flag:"🇨🇮", name:"Côte d'Ivoire",     region:"Afrique de l'Ouest",    gdp:78,   gdp_pc:2900,  growth:6.5,  inflation:3.8,  debt:57,  fiscal:-4.0, ca:-3.7,  pop:27  },
  { id:"TZA", flag:"🇹🇿", name:"Tanzanie",          region:"Afrique de l'Est",      gdp:77,   gdp_pc:1200,  growth:5.4,  inflation:3.1,  debt:42,  fiscal:-3.0, ca:-3.5,  pop:63  },
  { id:"COD", flag:"🇨🇩", name:"Congo (RDC)",       region:"Afrique Centrale",      gdp:65,   gdp_pc:660,   growth:6.3,  inflation:23.6, debt:15,  fiscal:-1.0, ca:-3.7,  pop:99  },
  { id:"CMR", flag:"🇨🇲", name:"Cameroun",          region:"Afrique Centrale",      gdp:47,   gdp_pc:1700,  growth:4.1,  inflation:7.4,  debt:48,  fiscal:-2.5, ca:-4.2,  pop:27  },
  { id:"TUN", flag:"🇹🇳", name:"Tunisie",           region:"Afrique du Nord",       gdp:46,   gdp_pc:3700,  growth:1.8,  inflation:9.3,  debt:80,  fiscal:-7.7, ca:-6.2,  pop:12  },
  { id:"SEN", flag:"🇸🇳", name:"Sénégal",           region:"Afrique de l'Ouest",    gdp:32,   gdp_pc:1800,  growth:8.3,  inflation:2.8,  debt:73,  fiscal:-4.9, ca:-12.1, pop:17  },
  { id:"UGA", flag:"🇺🇬", name:"Ouganda",           region:"Afrique de l'Est",      gdp:50,   gdp_pc:1100,  growth:6.1,  inflation:3.8,  debt:50,  fiscal:-4.4, ca:-9.2,  pop:48  },
  { id:"ZMB", flag:"🇿🇲", name:"Zambie",            region:"Afrique Australe",      gdp:28,   gdp_pc:1500,  growth:4.8,  inflation:13.0, debt:137, fiscal:-7.6, ca:1.5,   pop:20  },
  { id:"RWA", flag:"🇷🇼", name:"Rwanda",            region:"Afrique de l'Est",      gdp:13,   gdp_pc:900,   growth:7.0,  inflation:5.8,  debt:68,  fiscal:-6.0, ca:-11.4, pop:14  },
  { id:"MLI", flag:"🇲🇱", name:"Mali",              region:"Afrique de l'Ouest",    gdp:22,   gdp_pc:1000,  growth:4.0,  inflation:2.5,  debt:50,  fiscal:-3.5, ca:-5.5,  pop:23  },
  { id:"BEN", flag:"🇧🇯", name:"Bénin",             region:"Afrique de l'Ouest",    gdp:19,   gdp_pc:1500,  growth:6.4,  inflation:2.7,  debt:54,  fiscal:-4.7, ca:-4.2,  pop:13  },
  { id:"BFA", flag:"🇧🇫", name:"Burkina Faso",      region:"Afrique de l'Ouest",    gdp:18,   gdp_pc:840,   growth:2.5,  inflation:3.0,  debt:54,  fiscal:-4.5, ca:-4.1,  pop:22  },
  { id:"NER", flag:"🇳🇪", name:"Niger",             region:"Afrique de l'Ouest",    gdp:17,   gdp_pc:650,   growth:12.3, inflation:3.9,  debt:52,  fiscal:-6.8, ca:-16.0, pop:26  },
  { id:"TGO", flag:"🇹🇬", name:"Togo",              region:"Afrique de l'Ouest",    gdp:9,    gdp_pc:1050,  growth:6.0,  inflation:4.0,  debt:69,  fiscal:-3.8, ca:-2.9,  pop:8.8 },
  { id:"MOZ", flag:"🇲🇿", name:"Mozambique",        region:"Afrique de l'Est",      gdp:18,   gdp_pc:560,   growth:5.5,  inflation:6.2,  debt:100, fiscal:-5.0, ca:-26.0, pop:33  },
  { id:"BWA", flag:"🇧🇼", name:"Botswana",          region:"Afrique Australe",      gdp:19,   gdp_pc:7400,  growth:3.5,  inflation:5.5,  debt:19,  fiscal:-1.5, ca:-1.6,  pop:2.6 },
  { id:"GAB", flag:"🇬🇦", name:"Gabon",             region:"Afrique Centrale",      gdp:20,   gdp_pc:8600,  growth:2.5,  inflation:4.8,  debt:75,  fiscal:-1.8, ca:2.5,   pop:2.3 },
  { id:"NAM", flag:"🇳🇦", name:"Namibie",           region:"Afrique Australe",      gdp:13,   gdp_pc:4700,  growth:3.6,  inflation:5.8,  debt:68,  fiscal:-5.2, ca:-10.0, pop:2.8 },
  { id:"MUS", flag:"🇲🇺", name:"Maurice",           region:"Afrique de l'Est",      gdp:13,   gdp_pc:10500, growth:5.6,  inflation:7.0,  debt:85,  fiscal:-4.0, ca:-5.9,  pop:1.3 },
  { id:"DJI", flag:"🇩🇯", name:"Djibouti",          region:"Afrique de l'Est",      gdp:4.0,  gdp_pc:3800,  growth:7.1,  inflation:3.0,  debt:73,  fiscal:-1.5, ca:-6.0,  pop:1.0 },
  { id:"GIN", flag:"🇬🇳", name:"Guinée",            region:"Afrique de l'Ouest",    gdp:16,   gdp_pc:1200,  growth:6.5,  inflation:9.6,  debt:35,  fiscal:-3.3, ca:-12.0, pop:13  },
];

type SortKey = "gdp" | "gdp_pc" | "growth" | "inflation" | "debt" | "fiscal" | "ca" | "pop";

const COLUMNS: { key: SortKey; label: string; unit: string; color: (v: number) => string }[] = [
  { key:"gdp",       label:"PIB",         unit:"Mds $",   color: () => "var(--text-primary)" },
  { key:"gdp_pc",    label:"PIB/hab",     unit:"USD",      color: v => v > 5000 ? "#10B981" : v > 2000 ? "#F59E0B" : "var(--text-primary)" },
  { key:"growth",    label:"Croissance",  unit:"%",        color: v => v >= 5 ? "#10B981" : v >= 2 ? "#F59E0B" : "#EF4444" },
  { key:"inflation", label:"Inflation",   unit:"%",        color: v => v < 6 ? "#10B981" : v < 15 ? "#F59E0B" : "#EF4444" },
  { key:"debt",      label:"Dette pub.",  unit:"% PIB",    color: v => v < 60 ? "#10B981" : v < 80 ? "#F59E0B" : "#EF4444" },
  { key:"fiscal",    label:"Solde budg.", unit:"% PIB",    color: v => v > -3 ? "#10B981" : v > -6 ? "#F59E0B" : "#EF4444" },
  { key:"ca",        label:"Cpt. courant",unit:"% PIB",    color: v => v > -2 ? "#10B981" : v > -6 ? "#F59E0B" : "#EF4444" },
  { key:"pop",       label:"Population",  unit:"M hab.",   color: () => "var(--text-primary)" },
];

const REGIONS = ["Toutes", "Afrique de l'Ouest", "Afrique de l'Est", "Afrique du Nord", "Afrique Centrale", "Afrique Australe"];

export function MacroDataTable() {
  const [sortKey,  setSortKey]  = useState<SortKey>("gdp");
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("desc");
  const [search,   setSearch]   = useState("");
  const [region,   setRegion]   = useState("Toutes");
  const [showAll,  setShowAll]  = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    return DATA_2024
      .filter(r => region === "Toutes" || r.region === region)
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const va = a[sortKey] as number;
        const vb = b[sortKey] as number;
        return sortDir === "desc" ? vb - va : va - vb;
      });
  }, [sortKey, sortDir, search, region]);

  const displayed = showAll ? filtered : filtered.slice(0, 15);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={10} className="opacity-40" />;
    return sortDir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />;
  };

  return (
    <div className="mansa-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--bg-border)" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Tableau macro interactif · 54 économies africaines
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              FMI WEO 2024 · Banque Mondiale WDI · Cliquer sur un indicateur pour trier
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Recherche */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)", width: 140 }}
              />
            </div>
            {/* Filtre région */}
            <div className="relative">
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="pl-7 pr-6 py-1.5 text-xs rounded-lg border appearance-none"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--bg-border)" }}>
              <th className="px-4 py-2.5 text-left font-semibold sticky left-0" style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)", minWidth: 160 }}>
                Pays
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none whitespace-nowrap"
                  style={{ color: sortKey === col.key ? "var(--mansa-green)" : "var(--text-muted)" }}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>{col.label}</span>
                    <SortIcon col={col.key} />
                  </div>
                  <div className="text-[10px] font-normal opacity-60">{col.unit}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, idx) => (
              <tr
                key={row.id}
                className="transition-colors"
                style={{ borderBottom: idx < displayed.length - 1 ? "1px solid var(--bg-border)" : "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <td className="px-4 py-2.5 sticky left-0" style={{ background: "inherit" }}>
                  <Link href={`/countries/${row.id}`} className="flex items-center gap-2 group">
                    <span className="text-base">{row.flag}</span>
                    <div>
                      <div className="font-semibold group-hover:underline" style={{ color: "var(--text-primary)" }}>{row.name}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{row.region}</div>
                    </div>
                  </Link>
                </td>
                {COLUMNS.map(col => {
                  const v = row[col.key] as number;
                  const isHighlighted = sortKey === col.key;
                  return (
                    <td
                      key={col.key}
                      className="px-3 py-2.5 text-right font-mono font-semibold"
                      style={{
                        color: col.color(v),
                        background: isHighlighted ? "color-mix(in srgb, var(--mansa-green) 3%, transparent)" : undefined,
                      }}
                    >
                      {col.key === "gdp"     ? `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}`
                      : col.key === "gdp_pc" ? v.toLocaleString("fr-FR")
                      : col.key === "pop"    ? v >= 10 ? v.toFixed(0) : v.toFixed(1)
                      : (v >= 0 && (col.key === "growth" || col.key === "ca" || col.key === "fiscal") ? "+" : "") + v.toFixed(1)
                      }
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--bg-border)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {filtered.length} pays · {showAll ? "Tous" : `${Math.min(15, filtered.length)} affichés`}
        </span>
        {filtered.length > 15 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium hover:underline"
            style={{ color: "var(--mansa-green)" }}
          >
            {showAll ? "Afficher moins" : `Voir les ${filtered.length - 15} autres →`}
          </button>
        )}
      </div>
    </div>
  );
}
