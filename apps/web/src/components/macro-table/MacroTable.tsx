"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, Download, Sparkles,
  GitCompareArrows, SlidersHorizontal, RotateCcw, ChevronLeft, ChevronRight,
  RefreshCw, CloudDownload,
} from "lucide-react";

import { macroApi, authApi } from "@/lib/api";
import { exportData, type ExportRow } from "@/lib/export-utils";
import { sparklineSeries, averageSeries } from "@/lib/sparklines";
import { averagePolicyRate } from "@/lib/national-sources";
import {
  CATEGORIES, INDICATOR_CATALOG, INDICATOR_BY_CODE, REGIONS, REGION_LABEL_FR,
  FALLBACK_DATA, formatValue, valueColor, computeBadge, filterByRegion,
  type CountryDatum, type IndicatorDef, type CategoryKey,
} from "./data";
import { Flag, Sparkline, ScoreBar, heatBg, SPARK_GREEN, SPARK_RED } from "./ui";
import { CountryInsightPanel } from "./CountryInsightPanel";
import { CompareView } from "./CompareView";
import { AIBriefModal } from "./AIBriefModal";

const MANSA_GOLD = "#C9A227";
const MAX_COMPARE = 10;

// Indicateurs affichant une mini-courbe en cellule
const SPARK_CELLS = new Set(["NGDP_RPCH", "PCPIPCH", "GGXWDG_NGDP", "BCA_NGDPD"]);

// ── Cartes KPI continentales ─────────────────────────────────────────────────
interface KpiDef {
  code: string; label: string; sub: string; unit: string;
  better: "high" | "low" | "neutral"; signed?: boolean;
  fallback?: number; fallbackNote?: string;
}
const KPIS: KpiDef[] = [
  { code: "NGDP_RPCH",   label: "Croissance PIB",  sub: "Réel, annuel",      unit: "%",     better: "high", signed: true },
  { code: "PCPIPCH",     label: "Inflation (IPC)", sub: "Glissement annuel", unit: "%",     better: "low"  },
  { code: "GGXWDG_NGDP", label: "Dette publique",  sub: "% du PIB",          unit: "%",     better: "low"  },
  { code: "BCA_NGDPD",   label: "Compte courant",  sub: "% du PIB",          unit: "%",     better: "high", signed: true },
  { code: "FX_RESERVES", label: "Réserves change", sub: "Mois d'imports",    unit: " mois", better: "high", fallback: 4.3, fallbackNote: "estim. continentale" },
  { code: "INT_POLICY",  label: "Taux directeur",  sub: "Moy. banques centr.", unit: "%",   better: "low",  fallbackNote: "moy. banques centrales" },
];

function kpiColor(def: KpiDef, v: number | null): string {
  if (v == null) return "var(--text-muted)";
  const cat = INDICATOR_BY_CODE[def.code];
  if (cat) return valueColor(cat, v);
  if (def.code === "FX_RESERVES") return v >= 4 ? "#10B981" : v >= 3 ? "#F59E0B" : "#EF4444";
  if (def.code === "INT_POLICY") return v < 6 ? "#10B981" : v < 12 ? "#F59E0B" : "#EF4444";
  return "var(--text-primary)";
}

export function MacroTable() {
  const [year, setYear]             = useState(2024);
  const [view, setView]             = useState<"country" | "region">("country");
  const [regionKey, setRegion]      = useState("all");
  const [search, setSearch]         = useState("");
  const [sortKey, setSortKey]       = useState<string>("NGDPD");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
  const [hiddenCats, setHiddenCats] = useState<Set<CategoryKey>>(new Set());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [page, setPage]             = useState(0);
  const [perPage, setPerPage]       = useState(25);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>("ZAF");
  const [panelOpen, setPanelOpen]   = useState(true);
  const [showCompare, setShowCompare] = useState(false);
  const [briefId, setBriefId]       = useState<string | null>(null);
  const [toast, setToast]           = useState("");
  const [updating, setUpdating]     = useState(false);

  const queryClient = useQueryClient();

  // ── Données réelles + repli ─────────────────────────────────────────────────
  const { data: apiResp, isFetching } = useQuery({
    queryKey: ["macro-table", year],
    queryFn: () => macroApi.getTable({ year }),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // Fraîcheur des données (dernière ingestion réussie)
  const { data: freshness } = useQuery({
    queryKey: ["macro-freshness"],
    queryFn: () => macroApi.getFreshness(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Rôle de l'utilisateur — le bouton « Mettre à jour » (ré-ingestion) est
  // réservé aux admins (le backend renvoie 403 sinon).
  const { data: me } = useQuery({
    queryKey: ["auth-me"],
    queryFn: () => authApi.me(),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
  const isAdmin = me?.role === "admin";

  const allData: CountryDatum[] = useMemo(() => {
    const apiCountries = apiResp?.countries ?? [];
    if (apiCountries.length > 0) {
      return apiCountries.map((c) => ({ id: c.id, name: c.name, region: c.region ?? "", values: c.values }));
    }
    return FALLBACK_DATA;
  }, [apiResp]);
  const isLive = (apiResp?.countries?.length ?? 0) > 0;

  // Indicateurs présents (colonnes sans donnée masquées)
  const presentDefs: IndicatorDef[] = useMemo(() => {
    const codes = new Set<string>();
    allData.forEach((d) => Object.keys(d.values).forEach((k) => { if (d.values[k] != null) codes.add(k); }));
    return INDICATOR_CATALOG.filter((d) => codes.has(d.code));
  }, [allData]);

  // Catégories présentes (≥1 indicateur)
  const presentCats = useMemo(
    () => CATEGORIES.map((cat) => ({ cat, defs: presentDefs.filter((d) => d.category === cat.key) }))
      .filter((g) => g.defs.length > 0),
    [presentDefs],
  );

  // Catégories visibles (après personnalisation / filtre)
  const visibleCats = useMemo(
    () => presentCats.filter((g) => !hiddenCats.has(g.cat.key)),
    [presentCats, hiddenCats],
  );
  const flatDefs = useMemo(() => visibleCats.flatMap((g) => g.defs), [visibleCats]);

  // Valeur du select "catégorie" (mono-catégorie ⇒ son nom, sinon "all")
  const categorySelVal = visibleCats.length === 1 ? visibleCats[0].cat.key : "all";

  // ── Filtrage + tri ──────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    let r = filterByRegion(allData, regionKey);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) || d.region.toLowerCase().includes(q));
    }
    const cmp = (a: CountryDatum, b: CountryDatum) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * (sortDir === "asc" ? 1 : -1);
      if (sortKey === "score") return (computeBadge(a.values).score - computeBadge(b.values).score) * (sortDir === "asc" ? 1 : -1);
      const va = a.values[sortKey], vb = b.values[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortDir === "desc" ? vb - va : va - vb;
    };
    const sorted = [...r].sort(cmp);
    if (view === "region") {
      sorted.sort((a, b) => (a.region || "").localeCompare(b.region || "") || cmp(a, b));
    }
    return sorted;
  }, [allData, regionKey, search, sortKey, sortDir, view]);

  // Plages heatmap par colonne
  const heatRanges = useMemo(() => {
    const map: Record<string, { min: number; max: number }> = {};
    flatDefs.forEach((def) => {
      const vals = rows.map((r) => r.values[def.code]).filter((x): x is number => x != null);
      if (vals.length) map[def.code] = { min: Math.min(...vals), max: Math.max(...vals) };
    });
    return map;
  }, [flatDefs, rows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const curPage = Math.min(page, totalPages - 1);
  const start = curPage * perPage;
  const pageRows = rows.slice(start, start + perPage);

  const selected = useMemo(() => allData.find((d) => d.id === selectedId) ?? null, [allData, selectedId]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const fireToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((fireToast as unknown as { _t?: number })._t);
    (fireToast as unknown as { _t?: number })._t = window.setTimeout(() => setToast(""), 2600);
  };

  const sortBy = (key: string) => {
    setSortDir((d) => (sortKey === key ? (d === "desc" ? "asc" : "desc") : "desc"));
    setSortKey(key);
    setPage(0);
    setCustomizeOpen(false);
  };

  const onKpiClick = (def: KpiDef) => {
    if (presentDefs.some((d) => d.code === def.code)) {
      sortBy(def.code);
      fireToast(`Tableau trié par ${def.label}`);
    } else {
      fireToast(`${def.label} — indicateur agrégé (pas de colonne dédiée)`);
    }
  };

  const toggleCompare = (id: string) =>
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
      : prev.length >= MAX_COMPARE ? prev : [...prev, id]);

  const compareCountries = useMemo(
    () => compareIds.map((id) => allData.find((d) => d.id === id)).filter(Boolean) as CountryDatum[],
    [compareIds, allData],
  );

  const onCategorySel = (val: string) => {
    if (val === "all") setHiddenCats(new Set());
    else setHiddenCats(new Set(presentCats.map((g) => g.cat.key).filter((k) => k !== val)));
    setPage(0);
  };
  const toggleCat = (key: CategoryKey) =>
    setHiddenCats((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const resetAll = () => {
    setView("country"); setRegion("all"); setSearch(""); setSortKey("NGDPD"); setSortDir("desc");
    setHiddenCats(new Set()); setPage(0); setYear(2024);
  };

  const doExport = () => {
    const exportRows: ExportRow[] = rows.map((d) => {
      const out: ExportRow = { Pays: d.name, Code: d.id, Région: REGION_LABEL_FR[d.region] ?? d.region };
      flatDefs.forEach((def) => { out[`${def.short} (${def.unit})`] = d.values[def.code] ?? null; });
      out["Score MANSA"] = computeBadge(d.values).score;
      return out;
    });
    exportData(exportRows, "csv", `mansa_macro_table_${year}`, `Tableau macroéconomique ${year}`,
      `${rows.length} économies africaines · FMI WEO · Banque Mondiale WDI`);
    fireToast(`Export CSV — ${rows.length} pays · ${flatDefs.length} indicateurs`);
  };

  const openBrief = () => setBriefId(selectedId ?? rows[0]?.id ?? null);

  // Rafraîchir l'affichage : refetch immédiat (cache invalidé)
  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["macro-table"] });
    queryClient.invalidateQueries({ queryKey: ["macro-freshness"] });
    fireToast("Données rechargées depuis le serveur");
  };

  // Mettre à jour les données : déclenche la ré-ingestion côté serveur
  const onUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      const r = await macroApi.refresh("all");
      fireToast(r?.message ?? "Ré-ingestion lancée");
    } catch (e) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      fireToast(detail ?? "Mise à jour indisponible pour le moment");
    } finally {
      setUpdating(false);
    }
  };

  const freshnessLabel = freshness?.last_updated
    ? new Date(freshness.last_updated).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : null;

  // Pagination — fenêtre de 5 boutons
  const pageBtns = useMemo(() => {
    let lo = Math.max(0, curPage - 2);
    const hi = Math.min(totalPages - 1, lo + 4);
    lo = Math.max(0, hi - 4);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }, [curPage, totalPages]);

  const briefCountry = briefId ? allData.find((d) => d.id === briefId) ?? null : null;

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* ── Titre + actions ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Tableau macroéconomique</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {rows.length} pays africains · {presentDefs.length} indicateurs · FMI WEO · Banque Mondiale WDI
            {!isLive && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: `${MANSA_GOLD}22`, color: MANSA_GOLD }}>réf. 2024</span>}
          </p>
          {freshnessLabel && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Dernière mise à jour des données : {freshnessLabel}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onRefresh} disabled={isFetching}
            title={freshnessLabel ? `Recharger l'affichage · dernière ingestion : ${freshnessLabel}` : "Recharger l'affichage"}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors disabled:opacity-60"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Rafraîchir
          </button>
          {isAdmin && (
            <button onClick={onUpdate} disabled={updating}
              title="Relancer l'ingestion des sources (FMI, Banque Mondiale…) et mettre la base à jour"
              className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors disabled:opacity-60"
              style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
              <CloudDownload size={14} className={updating ? "animate-pulse" : ""} /> {updating ? "Lancement…" : "Mettre à jour"}
            </button>
          )}
          <button onClick={() => (compareIds.length >= 2 ? setShowCompare(true) : fireToast("Cochez au moins 2 pays à comparer"))}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors"
            style={{ borderColor: "var(--mansa-green)", color: "var(--mansa-green)", background: "transparent" }}>
            <GitCompareArrows size={14} /> Comparer les pays ({compareIds.length})
          </button>
          <button onClick={doExport}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg border transition-colors"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={openBrief}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg"
            style={{ background: "var(--mansa-green)", color: "var(--bg-primary)" }}>
            <Sparkles size={14} /> Générer un brief IA
          </button>
        </div>
      </div>

      {/* ── Barre de filtres ── */}
      <div className="flex gap-2.5 flex-wrap">
        <FilterSelect label="VUE" value={view} onChange={(v) => setView(v as "country" | "region")}
          options={[["country", "Par pays"], ["region", "Par région"]]} />
        <FilterSelect label="RÉGION" value={regionKey} onChange={(v) => { setRegion(v); setPage(0); }}
          options={REGIONS.map((r) => [r.key, r.label] as [string, string])} />
        <FilterSelect label="CATÉGORIE D'INDICATEUR" value={categorySelVal} onChange={onCategorySel}
          options={[["all", "Toutes les catégories"], ...presentCats.map((g) => [g.cat.key, g.cat.label] as [string, string])]} />
        <FilterSelect label="TRIER PAR INDICATEUR" value={sortKey} onChange={(v) => sortBy(v)}
          options={[["name", "Ordre alphabétique"], ...presentDefs.map((d) => [d.code, d.label] as [string, string]), ["score", "Score MANSA"]]} />
        <FilterSelect label="PÉRIODE" value={String(year)} onChange={(v) => setYear(Number(v))} disabled={!isLive}
          options={(isLive ? [2025, 2024, 2023, 2022] : [2024]).map((y) => [String(y), String(y)] as [string, string])} />
        <button onClick={resetAll}
          className="flex items-center gap-2 px-4 rounded-xl border text-xs font-semibold self-stretch"
          style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
          <RotateCcw size={13} /> Réinit.
        </button>
      </div>

      {/* ── Bandeau KPI (6 cartes) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPIS.map((def) => {
          const present = rows.some((r) => r.values[def.code] != null);
          let value: number | null = null;
          let spark: number[] = [];
          if (present) {
            const vals = rows.map((r) => r.values[def.code]).filter((x): x is number => x != null);
            value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            spark = averageSeries(def.code, rows).map((p) => p.value);
          } else {
            value = def.fallback ?? (def.code === "INT_POLICY" ? averagePolicyRate() : null);
            spark = value != null ? sparklineSeries(def.code, "AFR", value).map((p) => p.value) : [];
          }
          const color = kpiColor(def, value);
          const delta = spark.length >= 2 ? spark[spark.length - 1] - spark[spark.length - 2] : null;
          const deltaGood = def.better === "neutral" ? (delta ?? 0) >= 0
            : def.better === "high" ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0;
          const active = sortKey === def.code;
          return (
            <button key={def.code} onClick={() => onKpiClick(def)}
              className="text-left rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 relative overflow-hidden"
              style={{ background: "var(--card-bg)", borderColor: active ? "var(--mansa-green)" : "var(--card-border)" }}
              title="Trier le tableau par cet indicateur">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{def.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{def.sub}</div>
                </div>
                <ArrowUpDown size={12} style={{ color: active ? "var(--mansa-green)" : "var(--text-muted)" }} />
              </div>
              <div className="font-mono text-2xl font-semibold mt-2.5 leading-none" style={{ color }}>
                {value != null ? `${def.signed && value >= 0 ? "+" : ""}${value.toFixed(1)}` : "—"}
                <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>{def.unit}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{present ? "Moy. Afrique" : (def.fallbackNote ?? "Moy. Afrique")}</span>
                {delta != null && (
                  <span className="font-mono text-[11px] font-semibold" style={{ color: deltaGood ? "#10B981" : "#EF4444" }}>
                    {delta >= 0 ? "▲ +" : "▼ "}{delta.toFixed(1)}{def.unit === " mois" ? "" : "pp"}
                  </span>
                )}
              </div>
              <div className="mt-2 h-[34px] flex items-end">
                <Sparkline points={spark} color={color} width={180} height={34} area strokeWidth={1.6} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Tableau + panneau latéral ── */}
      <div className="flex gap-4 items-start">
        {/* Panneau tableau */}
        <div className="flex-1 min-w-0 rounded-2xl border flex flex-col overflow-hidden" style={{ background: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          {/* Barre d'outils tableau */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b flex-wrap" style={{ borderColor: "var(--bg-border)" }}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 pr-4 border-r" style={{ borderColor: "var(--bg-border)" }}>
                <Stat value={String(rows.length)} label="Pays" color="var(--text-primary)" />
                <Stat value={String(flatDefs.length)} label="Indicateurs" color="var(--mansa-green)" />
                <Stat value="20a" label="Historique" color="var(--text-secondary)" />
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", width: 240 }}>
                <Search size={13} style={{ color: "var(--text-muted)" }} />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Rechercher un pays ou une région…"
                  className="flex-1 bg-transparent outline-none text-xs" style={{ color: "var(--text-primary)" }} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(16,185,129,.55)" }} />Favorable</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(239,68,68,.55)" }} />À risque</span>
              </div>
              <div className="relative">
                <button onClick={() => setCustomizeOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
                  <SlidersHorizontal size={13} /> Colonnes
                </button>
                {customizeOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 rounded-xl border p-3 shadow-xl" style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)", width: 220 }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Groupes de colonnes</div>
                    {presentCats.map((g) => (
                      <label key={g.cat.key} className="flex items-center gap-2.5 py-1.5 cursor-pointer text-xs" style={{ color: "var(--text-secondary)" }}>
                        <input type="checkbox" checked={!hiddenCats.has(g.cat.key)} onChange={() => toggleCat(g.cat.key)}
                          className="w-3.5 h-3.5 accent-[#0ea5a0]" />
                        <span className="w-2 h-2 rounded-sm" style={{ background: g.cat.color }} />{g.cat.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
            <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th rowSpan={2} onClick={() => sortBy("name")}
                    className="sticky left-0 top-0 z-30 text-left px-3.5 py-2.5 cursor-pointer align-bottom"
                    style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--bg-border)", borderRight: "1px solid var(--bg-border)", minWidth: 200 }}>
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" checked={compareIds.length > 0}
                        onClick={(e) => { e.stopPropagation(); setCompareIds(compareIds.length > 0 ? [] : rows.slice(0, 10).map((c) => c.id)); }}
                        onChange={() => {}} className="w-3.5 h-3.5 accent-[#0ea5a0]" />
                      <span className="font-semibold" style={{ color: "var(--text-muted)" }}>Pays</span>
                      <SortIcon active={sortKey === "name"} dir={sortDir} />
                    </div>
                  </th>
                  {visibleCats.map((g) => (
                    <th key={g.cat.key} colSpan={g.defs.length}
                      className="sticky top-0 z-20 text-left px-4 py-2 whitespace-nowrap"
                      style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--bg-border)", borderLeft: "1px solid var(--bg-border)" }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: g.cat.color }}>{g.cat.label}</span>
                    </th>
                  ))}
                  <th rowSpan={2} className="sticky top-0 z-20 text-left px-4 py-2 align-bottom whitespace-nowrap"
                    style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--bg-border)", borderLeft: "1px solid var(--bg-border)" }}>
                    <div onClick={() => sortBy("score")} className="cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold" style={{ color: sortKey === "score" ? MANSA_GOLD : "var(--text-secondary)" }}>Score MANSA</span>
                        <SortIcon active={sortKey === "score"} dir={sortDir} />
                      </div>
                      <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>0–100</div>
                    </div>
                  </th>
                </tr>
                <tr>
                  {visibleCats.map((g) => g.defs.map((def, i) => (
                    <th key={def.code} onClick={() => sortBy(def.code)}
                      className="sticky z-10 text-left px-4 py-2 whitespace-nowrap cursor-pointer"
                      style={{ top: 33, background: "var(--sidebar-bg)", borderBottom: "1px solid var(--bg-border)", borderLeft: i === 0 ? "1px solid var(--bg-border)" : undefined }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold" style={{ color: sortKey === def.code ? MANSA_GOLD : "var(--text-secondary)" }}>{def.short}</span>
                        <SortIcon active={sortKey === def.code} dir={sortDir} />
                      </div>
                      <div className="text-[9px]" style={{ color: "var(--text-muted)" }}>{def.unit}</div>
                    </th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d) => {
                  const isSel = d.id === selectedId;
                  const isCmp = compareIds.includes(d.id);
                  const badge = computeBadge(d.values);
                  const rowBg = isSel ? "color-mix(in srgb, var(--mansa-green) 8%, transparent)" : "transparent";
                  return (
                    <tr key={d.id} onClick={() => { setSelectedId(d.id); setPanelOpen(true); }}
                      className="cursor-pointer" style={{ background: rowBg }}
                      onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--sidebar-item-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}>
                      <td className="sticky left-0 z-10 px-3.5 py-2.5" style={{ background: isSel ? "var(--bg-card-hover)" : "var(--card-bg)", borderBottom: "1px solid var(--bg-border)", borderRight: "1px solid var(--bg-border)" }}>
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={isCmp} onClick={(e) => e.stopPropagation()} onChange={() => toggleCompare(d.id)}
                            className="w-3.5 h-3.5 accent-[#0ea5a0] flex-shrink-0" title="Ajouter à la comparaison" />
                          <Flag iso3={d.id} w={22} h={15} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{d.name}</div>
                            <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{REGION_LABEL_FR[d.region] ?? d.region}</div>
                          </div>
                        </div>
                      </td>
                      {visibleCats.map((g) => g.defs.map((def, i) => {
                        const v = d.values[def.code];
                        const range = heatRanges[def.code];
                        const bg = v != null && range && def.better !== "neutral"
                          ? heatBg(v, range.min, range.max, def.better === "low") : undefined;
                        const showSpark = SPARK_CELLS.has(def.code) && v != null;
                        const spark = showSpark ? sparklineSeries(def.code, d.id, v).map((p) => p.value) : [];
                        return (
                          <td key={def.code} className="px-4 py-2.5 whitespace-nowrap"
                            style={{ background: bg, borderBottom: "1px solid var(--bg-border)", borderLeft: i === 0 ? "1px solid var(--bg-border)" : undefined }}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium" style={{ color: valueColor(def, v), fontVariantNumeric: "tabular-nums" }}>{formatValue(def, v)}</span>
                              {showSpark && <Sparkline points={spark} color={def.better === "low" ? SPARK_RED : SPARK_GREEN} width={40} height={16} />}
                            </div>
                          </td>
                        );
                      }))}
                      <td className="px-4 py-2.5" style={{ background: heatBg(badge.score, 0, 100, false), borderBottom: "1px solid var(--bg-border)", borderLeft: "1px solid var(--bg-border)" }}>
                        <ScoreBar score={badge.score} color={badge.color} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t flex-wrap text-xs" style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
            <div className="flex items-center gap-2">
              Lignes par page :
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
                className="rounded-md border px-2 py-1 outline-none cursor-pointer" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}>
                {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-1.5 rounded-md hover:bg-[var(--sidebar-item-bg)]" style={{ color: "var(--text-secondary)" }}><ChevronLeft size={14} /></button>
              {pageBtns.map((i) => (
                <button key={i} onClick={() => setPage(i)}
                  className="min-w-[26px] h-[26px] rounded-md text-xs font-semibold px-1.5"
                  style={i === curPage ? { background: "#1F3A5F", color: "#fff" } : { color: "var(--text-secondary)" }}>{i + 1}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="p-1.5 rounded-md hover:bg-[var(--sidebar-item-bg)]" style={{ color: "var(--text-secondary)" }}><ChevronRight size={14} /></button>
            </div>
            <div>{rows.length === 0 ? "0" : `${start + 1}–${Math.min(start + perPage, rows.length)}`} sur {rows.length}</div>
          </div>
        </div>

        {/* Panneau latéral pays */}
        <CountryInsightPanel
          country={selected} allData={allData} open={panelOpen}
          onClose={() => setPanelOpen(false)} onOpen={() => setPanelOpen(true)}
          onBrief={() => setBriefId(selectedId)}
        />
      </div>

      {/* Sources */}
      <div className="flex items-center justify-between text-[11px] flex-wrap gap-2" style={{ color: "var(--text-muted)" }}>
        <span>Sources : FMI WEO · Banque Mondiale WDI · FMI GFS/IFS · Banques centrales · MANSA Intelligence</span>
        <span>Données les plus récentes disponibles · réf. {year}</span>
      </div>

      {/* ── Overlays ── */}
      {showCompare && compareCountries.length >= 2 && (
        <CompareView countries={compareCountries} allData={allData} onClose={() => setShowCompare(false)} />
      )}
      {briefCountry && <AIBriefModal country={briefCountry} onClose={() => setBriefId(null)} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] text-xs font-medium px-4 py-2.5 rounded-lg border shadow-xl"
          style={{ background: "var(--card-bg)", borderColor: "var(--mansa-green)", color: "var(--text-primary)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────
function FilterSelect({
  label, value, onChange, options, disabled,
}: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; disabled?: boolean }) {
  return (
    <div className="flex-1 min-w-[150px] rounded-xl border px-3 py-1.5" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", opacity: disabled ? 0.6 : 1 }}>
      <div className="text-[10px] tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="w-full bg-transparent border-none outline-none text-xs font-semibold cursor-pointer mt-0.5"
        style={{ color: "var(--text-primary)" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-semibold leading-none" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide mt-1" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown size={10} style={{ color: "var(--text-muted)", opacity: 0.5 }} />;
  return dir === "desc"
    ? <ArrowDown size={10} style={{ color: MANSA_GOLD }} />
    : <ArrowUp size={10} style={{ color: MANSA_GOLD }} />;
}
