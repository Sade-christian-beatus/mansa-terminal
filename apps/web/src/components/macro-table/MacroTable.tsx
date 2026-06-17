"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Filter, Calendar, ArrowUpDown, ArrowUp, ArrowDown,
  Download, Sparkles, GitCompareArrows, X, ChevronDown, BarChart3,
} from "lucide-react";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

import { macroApi } from "@/lib/api";
import { exportData, type ExportRow } from "@/lib/export-utils";
import { sparklineSeries } from "@/lib/sparklines";
import {
  CATEGORIES, INDICATOR_CATALOG, REGIONS, REGION_LABEL_FR,
  FALLBACK_DATA, formatValue, valueColor, computeBadge, filterByRegion,
  type CountryDatum, type IndicatorDef,
} from "./data";
import { Flag, PerfBadge } from "./ui";
import { KpiBand } from "./KpiBand";
import { CountryDetailDrawer } from "./CountryDetailDrawer";
import { CompareView } from "./CompareView";
import { AIBriefModal } from "./AIBriefModal";

const MANSA_NAVY = "#1F3A5F";
const MANSA_GOLD = "#C9A227";
const MAX_COMPARE = 10;

export function MacroTable() {
  const [year, setYear]         = useState(2024);
  const [regionKey, setRegion]  = useState("all");
  const [search, setSearch]     = useState("");
  const [sortKey, setSortKey]   = useState("NGDPD");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [showAll, setShowAll]   = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [drawer, setDrawer]     = useState<CountryDatum | null>(null);
  const [brief, setBrief]       = useState<CountryDatum | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [exportOpen, setExportOpen]   = useState(false);

  // ── Données : API réelle avec repli statique ──────────────────────────────
  const { data: apiResp } = useQuery({
    queryKey: ["macro-table", year],
    queryFn: () => macroApi.getTable({ year }),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const allData: CountryDatum[] = useMemo(() => {
    const apiCountries = apiResp?.countries ?? [];
    if (apiCountries.length > 0) {
      return apiCountries.map((c) => ({
        id: c.id,
        name: c.name,
        region: c.region ?? "",
        values: c.values,
      }));
    }
    return FALLBACK_DATA;
  }, [apiResp]);

  // ── Indicateurs présents (masquage des colonnes sans donnée) ──────────────
  const presentDefs: IndicatorDef[] = useMemo(() => {
    const codes = new Set<string>();
    allData.forEach((d) => Object.keys(d.values).forEach((k) => { if (d.values[k] != null) codes.add(k); }));
    return INDICATOR_CATALOG.filter((d) => codes.has(d.code));
  }, [allData]);

  // Catégories ayant au moins un indicateur présent
  const presentCategories = useMemo(
    () => CATEGORIES.map((cat) => ({
      cat,
      defs: presentDefs.filter((d) => d.category === cat.key),
    })).filter((g) => g.defs.length > 0),
    [presentDefs],
  );

  // ── Filtrage + tri ─────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    let r = filterByRegion(allData, regionKey);
    if (search) r = r.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()));
    return [...r].sort((a, b) => {
      const va = a.values[sortKey], vb = b.values[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [allData, regionKey, search, sortKey, sortDir]);

  const displayed = showAll ? rows : rows.slice(0, 15);

  // Plage de la colonne triée → dégradé "heatmap" dans les cellules
  const sortRange = useMemo(() => {
    const vals = rows.map((r) => r.values[sortKey]).filter((x): x is number => x != null);
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    return max === min ? null : { min, max };
  }, [rows, sortKey]);

  const handleSort = (code: string) => {
    if (sortKey === code) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(code); setSortDir("desc"); }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
      : prev.length >= MAX_COMPARE ? prev : [...prev, id],
    );
  };

  const compareCountries = useMemo(
    () => compareIds.map((id) => allData.find((d) => d.id === id)).filter(Boolean) as CountryDatum[],
    [compareIds, allData],
  );

  // ── Export ─────────────────────────────────────────────────────────────────
  const buildExportRows = (): ExportRow[] =>
    rows.map((d) => {
      const out: ExportRow = { Pays: d.name, Code: d.id, Région: REGION_LABEL_FR[d.region] ?? d.region };
      presentDefs.forEach((def) => { out[`${def.short} (${def.unit})`] = d.values[def.code] ?? null; });
      out["Score MANSA"] = computeBadge(d.values).score;
      return out;
    });

  const doExport = (format: "csv" | "xlsx" | "pdf") => {
    setExportOpen(false);
    exportData(
      buildExportRows(), format, `mansa_macro_table_${year}`,
      `Tableau macroéconomique ${year}`,
      `${rows.length} économies africaines · FMI WEO · Banque Mondiale WDI`,
    );
  };

  const isLive = (apiResp?.countries?.length ?? 0) > 0;

  return (
    <div className="mansa-card rounded-2xl overflow-hidden" style={{ borderColor: "var(--card-border)" }}>
      {/* ── En-tête institutionnel ── */}
      <div className="relative px-5 pt-5 pb-4 border-b overflow-hidden" style={{ borderColor: "var(--bg-border)" }}>
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${MANSA_NAVY}, ${MANSA_GOLD})` }} />
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${MANSA_NAVY} 16%, transparent)` }}>
              <BarChart3 size={19} style={{ color: MANSA_GOLD }} />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                Macroeconomic Table
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                  style={{ background: isLive ? "#10B98122" : `${MANSA_GOLD}22`, color: isLive ? "#10B981" : MANSA_GOLD }}>
                  {isLive ? "Live" : "FMI WEO 2024"}
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {rows.length} économies · {presentDefs.length} indicateurs · FMI WEO · Banque Mondiale WDI
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Recherche */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un pays…"
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none transition-colors"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)", width: 150 }} />
            </div>
            {/* Région */}
            <div className="relative">
              <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <select value={regionKey} onChange={(e) => setRegion(e.target.value)}
                className="pl-7 pr-6 py-1.5 text-xs rounded-lg border appearance-none cursor-pointer"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            {/* Année — limitée à 2024 tant que les données live ne sont pas chargées */}
            <div className="relative" title={isLive ? "Année des données" : "Sélection d'année disponible une fois les données live chargées (réf. FMI WEO 2024)"}>
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <select value={isLive ? year : 2024} onChange={(e) => setYear(Number(e.target.value))}
                disabled={!isLive}
                className="pl-7 pr-6 py-1.5 text-xs rounded-lg border appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                {(isLive ? [2025, 2024, 2023, 2022, 2021, 2020] : [2024]).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {/* Export */}
            <div className="relative">
              <button onClick={() => setExportOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
                <Download size={12} /> Export <ChevronDown size={11} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border shadow-lg overflow-hidden min-w-[120px]"
                  style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)" }}>
                  {([["csv", "CSV"], ["xlsx", "Excel"], ["pdf", "PDF"]] as const).map(([fmt, label]) => (
                    <button key={fmt} onClick={() => doExport(fmt)}
                      className="block w-full text-left px-3 py-2 text-xs hover:bg-[var(--sidebar-item-bg)]"
                      style={{ color: "var(--text-secondary)" }}>{label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Légende des badges */}
        <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="font-semibold uppercase tracking-wide">Performance :</span>
          {[["#10B981","🟢 Très favorable"],["#F59E0B","🟡 Modéré"],["#F97316","🟠 Surveillance"],["#EF4444","🔴 Risque élevé"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}</span>
          ))}
        </div>
      </div>

      {/* ── Bandeau KPI continental (6 cartes + sparklines) ── */}
      <KpiBand rows={rows} sortKey={sortKey} onSort={(code) => { setSortKey(code); setSortDir("desc"); }} />

      {/* ── Barre comparaison ── */}
      {compareIds.length > 0 && (
        <div className="px-5 py-2.5 flex items-center gap-2 border-b" style={{ background: `color-mix(in srgb, ${MANSA_NAVY} 8%, var(--card-bg))`, borderColor: "var(--bg-border)" }}>
          <GitCompareArrows size={14} style={{ color: MANSA_NAVY }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{compareIds.length} pays sélectionné{compareIds.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {compareIds.map((id) => (
              <span key={id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}>
                {id}<button onClick={() => toggleCompare(id)}><X size={9} /></button>
              </span>
            ))}
          </div>
          <button onClick={() => setShowCompare(true)} disabled={compareIds.length < 2}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: MANSA_GOLD, color: MANSA_NAVY }}>
            Comparer →
          </button>
          <button onClick={() => setCompareIds([])} className="text-xs" style={{ color: "var(--text-muted)" }}>Effacer</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            {/* Bande catégories */}
            <tr>
              <th className="sticky left-0 z-20 px-3 py-2" style={{ background: MANSA_NAVY, minWidth: 230 }} colSpan={2} />
              {presentCategories.map((g) => (
                <th key={g.cat.key} colSpan={g.defs.length}
                  className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-white border-l"
                  style={{ background: g.cat.color, borderColor: "rgba(255,255,255,0.15)" }}>
                  {g.cat.label}
                </th>
              ))}
              <th style={{ background: MANSA_NAVY }} colSpan={2} />
            </tr>
            {/* Indicateurs */}
            <tr style={{ background: "var(--sidebar-bg)" }}>
              <th className="sticky left-0 z-20 px-3 py-2.5 text-center font-semibold" style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)", width: 36 }}>#</th>
              <th className="sticky left-[36px] z-20 px-3 py-2.5 text-left font-semibold" style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)", minWidth: 190, boxShadow: "1px 0 0 var(--bg-border)" }}>Pays</th>
              {presentCategories.flatMap((g) => g.defs).map((def) => (
                <th key={def.code} onClick={() => handleSort(def.code)}
                  className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none whitespace-nowrap"
                  style={{ color: sortKey === def.code ? MANSA_GOLD : "var(--text-muted)" }}>
                  <div className="flex items-center justify-end gap-1">
                    <span title={def.label}>{def.short}</span>
                    {sortKey === def.code ? (sortDir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
                  </div>
                  <div className="text-[9px] font-normal opacity-60">{def.unit}</div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Tendance</th>
              <th className="px-3 py-2.5 text-center font-semibold" style={{ color: "var(--text-muted)" }}>Perf.</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((d, idx) => {
              const badge = computeBadge(d.values);
              const picked = compareIds.includes(d.id);
              const zebra = idx % 2 ? "color-mix(in srgb, var(--sidebar-bg) 30%, transparent)" : "transparent";
              return (
                <tr key={d.id} className="group"
                  style={{ borderTop: "1px solid var(--bg-border)", background: zebra, transition: "background 0.12s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = zebra)}>
                  <td className="sticky left-0 z-10 px-3 py-2.5 text-center font-mono font-bold" style={{ background: "inherit", color: idx < 3 ? MANSA_GOLD : "var(--text-muted)" }}>{idx + 1}</td>
                  <td className="sticky left-[36px] z-10 px-3 py-2.5" style={{ background: "inherit", boxShadow: "1px 0 0 var(--bg-border)" }}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={picked} onChange={() => toggleCompare(d.id)}
                        className="cursor-pointer accent-[#C9A227]" title="Ajouter à la comparaison" />
                      <button onClick={() => setDrawer(d)} className="flex items-center gap-2 min-w-0 text-left">
                        <Flag iso3={d.id} />
                        <div className="min-w-0">
                          <div className="font-semibold truncate group-hover:underline" style={{ color: "var(--text-primary)" }}>{d.name}</div>
                          <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{REGION_LABEL_FR[d.region] ?? d.region}</div>
                        </div>
                      </button>
                      <button onClick={() => setBrief(d)} title="AI Brief"
                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded" style={{ color: MANSA_GOLD }}>
                        <Sparkles size={13} />
                      </button>
                    </div>
                  </td>
                  {presentCategories.flatMap((g) => g.defs).map((def) => {
                    const v = d.values[def.code];
                    const hl = sortKey === def.code;
                    // Intensité du dégradé selon la position de la valeur dans la plage
                    let bg: string | undefined;
                    if (hl && v != null && sortRange) {
                      const pct = (v - sortRange.min) / (sortRange.max - sortRange.min);
                      bg = `color-mix(in srgb, ${MANSA_GOLD} ${Math.round(8 + pct * 24)}%, transparent)`;
                    } else if (hl) {
                      bg = `color-mix(in srgb, ${MANSA_GOLD} 8%, transparent)`;
                    }
                    return (
                      <td key={def.code} className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap"
                        style={{ color: valueColor(def, v), background: bg, fontVariantNumeric: "tabular-nums" }}>
                        {formatValue(def, v)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    {(() => {
                      const spark = sparklineSeries(sortKey, d.id, d.values[sortKey]);
                      const def = INDICATOR_CATALOG.find((x) => x.code === sortKey);
                      const last = spark[spark.length - 1]?.value ?? null;
                      const stroke = def ? valueColor(def, last ?? undefined) : "var(--mansa-green)";
                      return spark.length > 1 ? (
                        <div className="w-24 h-7 mx-auto">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={spark}>
                              <YAxis hide domain={["dataMin", "dataMax"]} />
                              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={1.5} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-center"><PerfBadge badge={badge} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--bg-border)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {rows.length} pays · {showAll ? "tous affichés" : `${Math.min(15, rows.length)} affichés`} · cliquer un pays pour le détail
        </span>
        {rows.length > 15 && (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium hover:underline" style={{ color: MANSA_GOLD }}>
            {showAll ? "Afficher moins" : `Voir les ${rows.length - 15} autres →`}
          </button>
        )}
      </div>

      {/* ── Overlays ── */}
      {drawer && <CountryDetailDrawer country={drawer} onClose={() => setDrawer(null)} />}
      {brief && <AIBriefModal country={brief} onClose={() => setBrief(null)} />}
      {showCompare && compareCountries.length >= 2 && (
        <CompareView countries={compareCountries} allData={allData} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
