"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, BarChart3 } from "lucide-react";

interface CountryRow {
  id: string;
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

// ── ISO3 → ISO2 (drapeaux flagcdn) ───────────────────────────────────────────
const ISO3_TO_ISO2: Record<string, string> = {
  NGA:"ng", ZAF:"za", EGY:"eg", DZA:"dz", ETH:"et", MAR:"ma", KEN:"ke", AGO:"ao",
  GHA:"gh", CIV:"ci", TZA:"tz", COD:"cd", CMR:"cm", TUN:"tn", SEN:"sn", UGA:"ug",
  ZMB:"zm", RWA:"rw", MLI:"ml", BEN:"bj", BFA:"bf", NER:"ne", TGO:"tg", MOZ:"mz",
  BWA:"bw", GAB:"ga", NAM:"na", MUS:"mu", DJI:"dj", GIN:"gn",
};

function Flag({ iso3 }: { iso3: string }) {
  const iso2 = ISO3_TO_ISO2[iso3];
  if (!iso2) return <span className="text-base">🌍</span>;
  return (
    <Image
      src={`https://flagcdn.com/w160/${iso2}.png`}
      alt={iso3}
      width={26}
      height={18}
      unoptimized
      className="rounded-sm object-cover flex-shrink-0 shadow-sm"
      style={{ width: 26, height: 18 }}
    />
  );
}

const DATA_2024: CountryRow[] = [
  { id:"NGA", name:"Nigeria",        region:"Afrique de l'Ouest",   gdp:477,  gdp_pc:2200,  growth:3.1,  inflation:32.5, debt:46,  fiscal:-4.6, ca:0.8,   pop:223 },
  { id:"ZAF", name:"Afrique du Sud", region:"Afrique Australe",      gdp:381,  gdp_pc:6200,  growth:1.1,  inflation:4.6,  debt:75,  fiscal:-5.0, ca:-1.6,  pop:61  },
  { id:"EGY", name:"Égypte",         region:"Afrique du Nord",       gdp:360,  gdp_pc:3400,  growth:2.7,  inflation:28.3, debt:90,  fiscal:-7.2, ca:-5.4,  pop:106 },
  { id:"DZA", name:"Algérie",        region:"Afrique du Nord",       gdp:239,  gdp_pc:5200,  growth:3.6,  inflation:9.2,  debt:60,  fiscal:-5.8, ca:2.4,   pop:46  },
  { id:"ETH", name:"Éthiopie",       region:"Afrique de l'Est",      gdp:156,  gdp_pc:1300,  growth:6.8,  inflation:24.1, debt:38,  fiscal:-2.6, ca:-3.1,  pop:120 },
  { id:"MAR", name:"Maroc",          region:"Afrique du Nord",       gdp:142,  gdp_pc:3700,  growth:3.2,  inflation:2.4,  debt:69,  fiscal:-4.1, ca:-1.2,  pop:37  },
  { id:"KEN", name:"Kenya",          region:"Afrique de l'Est",      gdp:110,  gdp_pc:2100,  growth:5.0,  inflation:6.5,  debt:70,  fiscal:-5.5, ca:-4.0,  pop:53  },
  { id:"AGO", name:"Angola",         region:"Afrique Centrale",      gdp:108,  gdp_pc:3100,  growth:2.4,  inflation:28.2, debt:73,  fiscal:-1.0, ca:4.5,   pop:35  },
  { id:"CIV", name:"Côte d'Ivoire",  region:"Afrique de l'Ouest",    gdp:78,   gdp_pc:2900,  growth:6.5,  inflation:3.8,  debt:57,  fiscal:-4.0, ca:-3.7,  pop:27  },
  { id:"GHA", name:"Ghana",          region:"Afrique de l'Ouest",    gdp:77,   gdp_pc:2400,  growth:3.1,  inflation:22.3, debt:83,  fiscal:-4.6, ca:-2.0,  pop:33  },
  { id:"TZA", name:"Tanzanie",       region:"Afrique de l'Est",      gdp:77,   gdp_pc:1200,  growth:5.4,  inflation:3.1,  debt:42,  fiscal:-3.0, ca:-3.5,  pop:63  },
  { id:"COD", name:"Congo (RDC)",    region:"Afrique Centrale",      gdp:65,   gdp_pc:660,   growth:6.3,  inflation:23.6, debt:15,  fiscal:-1.0, ca:-3.7,  pop:99  },
  { id:"UGA", name:"Ouganda",        region:"Afrique de l'Est",      gdp:50,   gdp_pc:1100,  growth:6.1,  inflation:3.8,  debt:50,  fiscal:-4.4, ca:-9.2,  pop:48  },
  { id:"CMR", name:"Cameroun",       region:"Afrique Centrale",      gdp:47,   gdp_pc:1700,  growth:4.1,  inflation:7.4,  debt:48,  fiscal:-2.5, ca:-4.2,  pop:27  },
  { id:"TUN", name:"Tunisie",        region:"Afrique du Nord",       gdp:46,   gdp_pc:3700,  growth:1.8,  inflation:9.3,  debt:80,  fiscal:-7.7, ca:-6.2,  pop:12  },
  { id:"SEN", name:"Sénégal",        region:"Afrique de l'Ouest",    gdp:32,   gdp_pc:1800,  growth:8.3,  inflation:2.8,  debt:73,  fiscal:-4.9, ca:-12.1, pop:17  },
  { id:"ZMB", name:"Zambie",         region:"Afrique Australe",      gdp:28,   gdp_pc:1500,  growth:4.8,  inflation:13.0, debt:137, fiscal:-7.6, ca:1.5,   pop:20  },
  { id:"MLI", name:"Mali",           region:"Afrique de l'Ouest",    gdp:22,   gdp_pc:1000,  growth:4.0,  inflation:2.5,  debt:50,  fiscal:-3.5, ca:-5.5,  pop:23  },
  { id:"GAB", name:"Gabon",          region:"Afrique Centrale",      gdp:20,   gdp_pc:8600,  growth:2.5,  inflation:4.8,  debt:75,  fiscal:-1.8, ca:2.5,   pop:2.3 },
  { id:"BWA", name:"Botswana",       region:"Afrique Australe",      gdp:19,   gdp_pc:7400,  growth:3.5,  inflation:5.5,  debt:19,  fiscal:-1.5, ca:-1.6,  pop:2.6 },
  { id:"BEN", name:"Bénin",          region:"Afrique de l'Ouest",    gdp:19,   gdp_pc:1500,  growth:6.4,  inflation:2.7,  debt:54,  fiscal:-4.7, ca:-4.2,  pop:13  },
  { id:"BFA", name:"Burkina Faso",   region:"Afrique de l'Ouest",    gdp:18,   gdp_pc:840,   growth:2.5,  inflation:3.0,  debt:54,  fiscal:-4.5, ca:-4.1,  pop:22  },
  { id:"MOZ", name:"Mozambique",     region:"Afrique de l'Est",      gdp:18,   gdp_pc:560,   growth:5.5,  inflation:6.2,  debt:100, fiscal:-5.0, ca:-26.0, pop:33  },
  { id:"NER", name:"Niger",          region:"Afrique de l'Ouest",    gdp:17,   gdp_pc:650,   growth:12.3, inflation:3.9,  debt:52,  fiscal:-6.8, ca:-16.0, pop:26  },
  { id:"GIN", name:"Guinée",         region:"Afrique de l'Ouest",    gdp:16,   gdp_pc:1200,  growth:6.5,  inflation:9.6,  debt:35,  fiscal:-3.3, ca:-12.0, pop:13  },
  { id:"RWA", name:"Rwanda",         region:"Afrique de l'Est",      gdp:13,   gdp_pc:900,   growth:7.0,  inflation:5.8,  debt:68,  fiscal:-6.0, ca:-11.4, pop:14  },
  { id:"NAM", name:"Namibie",        region:"Afrique Australe",      gdp:13,   gdp_pc:4700,  growth:3.6,  inflation:5.8,  debt:68,  fiscal:-5.2, ca:-10.0, pop:2.8 },
  { id:"MUS", name:"Maurice",        region:"Afrique de l'Est",      gdp:13,   gdp_pc:10500, growth:5.6,  inflation:7.0,  debt:85,  fiscal:-4.0, ca:-5.9,  pop:1.3 },
  { id:"TGO", name:"Togo",           region:"Afrique de l'Ouest",    gdp:9,    gdp_pc:1050,  growth:6.0,  inflation:4.0,  debt:69,  fiscal:-3.8, ca:-2.9,  pop:8.8 },
  { id:"DJI", name:"Djibouti",       region:"Afrique de l'Est",      gdp:4.0,  gdp_pc:3800,  growth:7.1,  inflation:3.0,  debt:73,  fiscal:-1.5, ca:-6.0,  pop:1.0 },
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

function formatVal(key: SortKey, v: number): string {
  if (key === "gdp")    return v >= 100 ? v.toFixed(0) : v.toFixed(1);
  if (key === "gdp_pc") return v.toLocaleString("fr-FR");
  if (key === "pop")    return v >= 10 ? v.toFixed(0) : v.toFixed(1);
  const sign = v >= 0 && (key === "growth" || key === "ca" || key === "fiscal") ? "+" : "";
  return sign + v.toFixed(1);
}

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

  const displayed = showAll ? filtered : filtered.slice(0, 12);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={10} className="opacity-40" />;
    return sortDir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />;
  };

  return (
    <div className="mansa-card rounded-2xl overflow-hidden">
      {/* Header avec accent gradient */}
      <div
        className="px-5 pt-5 pb-4 border-b relative overflow-hidden"
        style={{ borderColor: "var(--bg-border)" }}
      >
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, var(--mansa-green), var(--mansa-blue, #3B82F6), transparent)" }}
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "color-mix(in srgb, var(--mansa-green) 14%, transparent)" }}
            >
              <BarChart3 size={17} style={{ color: "var(--mansa-green)" }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Tableau macroéconomique
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                FMI WEO 2024 · Banque Mondiale WDI · 30 principales économies
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-[var(--mansa-green)] transition-colors"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)", width: 140 }}
              />
            </div>
            <div className="relative">
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="pl-7 pr-6 py-1.5 text-xs rounded-lg border appearance-none cursor-pointer focus:outline-none focus:border-[var(--mansa-green)] transition-colors"
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
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: "var(--sidebar-bg)" }}>
              <th
                className="px-3 py-3 text-center font-semibold sticky left-0 z-10"
                style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)", width: 40 }}
              >
                #
              </th>
              <th
                className="px-3 py-3 text-left font-semibold sticky left-[40px] z-10"
                style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)", minWidth: 180 }}
              >
                Pays
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-right font-semibold cursor-pointer select-none whitespace-nowrap transition-colors"
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
                className="transition-colors group"
                style={{
                  borderTop: "1px solid var(--bg-border)",
                  background: idx % 2 === 1 ? "color-mix(in srgb, var(--sidebar-bg) 35%, transparent)" : "transparent",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 1 ? "color-mix(in srgb, var(--sidebar-bg) 35%, transparent)" : "transparent")}
              >
                <td className="px-3 py-2.5 text-center sticky left-0 font-mono font-bold" style={{ background: "inherit", color: idx < 3 ? "var(--mansa-green)" : "var(--text-muted)" }}>
                  {idx + 1}
                </td>
                <td className="px-3 py-2.5 sticky left-[40px]" style={{ background: "inherit" }}>
                  <Link href={`/countries/${row.id}`} className="flex items-center gap-2.5 group/link">
                    <Flag iso3={row.id} />
                    <div className="min-w-0">
                      <div className="font-semibold group-hover/link:underline truncate" style={{ color: "var(--text-primary)" }}>{row.name}</div>
                      <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{row.region}</div>
                    </div>
                  </Link>
                </td>
                {COLUMNS.map(col => {
                  const v = row[col.key] as number;
                  const isHighlighted = sortKey === col.key;
                  return (
                    <td
                      key={col.key}
                      className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap"
                      style={{
                        color: col.color(v),
                        background: isHighlighted ? "color-mix(in srgb, var(--mansa-green) 5%, transparent)" : undefined,
                      }}
                    >
                      {formatVal(col.key, v)}
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
          {filtered.length} pays · {showAll ? "tous affichés" : `${Math.min(12, filtered.length)} affichés`}
        </span>
        {filtered.length > 12 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium hover:underline"
            style={{ color: "var(--mansa-green)" }}
          >
            {showAll ? "Afficher moins" : `Voir les ${filtered.length - 12} autres →`}
          </button>
        )}
      </div>
    </div>
  );
}
