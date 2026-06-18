/**
 * MANSA Terminal — Macroeconomic Table · Modèle de données
 *
 * Le catalogue d'indicateurs pilote les colonnes du tableau. Les données
 * proviennent de l'API `/macro/table` (réelles, FMI WEO + Banque Mondiale).
 * Un dataset de repli (valeurs FMI WEO 2024 réelles, 8 indicateurs cœur)
 * garantit l'affichage même quand la base n'est pas encore peuplée.
 *
 * Règle produit : seuls les indicateurs AYANT des valeurs sont affichés
 * (les catégories sans donnée sont masquées entièrement).
 */

// ── Palette institutionnelle ────────────────────────────────────────────────
export const MANSA_NAVY = "#1F3A5F";
export const MANSA_GOLD = "#C9A227";

// ── Catégories ──────────────────────────────────────────────────────────────
export type CategoryKey =
  | "real"
  | "inflation"
  | "fiscal"
  | "debt"
  | "external"
  | "financial"
  | "social"
  | "climate";

export interface Category {
  key: CategoryKey;
  label: string;
  short: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { key: "real",      label: "Économie réelle",   short: "Réel",      color: "#1F3A5F" },
  { key: "inflation", label: "Inflation & Prix",  short: "Inflation", color: "#B45309" },
  { key: "fiscal",    label: "Finances publiques",short: "Fiscal",    color: "#7C3AED" },
  { key: "debt",      label: "Dette",             short: "Dette",     color: "#BE123C" },
  { key: "external",  label: "Secteur extérieur", short: "Extérieur", color: "#0E7490" },
  { key: "financial", label: "Secteur financier", short: "Financier", color: "#15803D" },
  { key: "social",    label: "Social",            short: "Social",    color: "#C9A227" },
  { key: "climate",   label: "Climat & ESG",      short: "Climat",    color: "#047857" },
];

// ── Catalogue d'indicateurs (codes FMI WEO / Banque Mondiale WDI) ───────────
export type Direction = "high" | "low" | "neutral";
export type Fmt = "bn" | "usd" | "pct" | "pct_signed" | "num" | "int";

export interface IndicatorDef {
  code: string;
  label: string;       // libellé complet
  short: string;       // libellé court (en-tête colonne)
  category: CategoryKey;
  unit: string;
  fmt: Fmt;
  better: Direction;   // sens favorable (pour la coloration)
  // bornes de coloration (vert / orange / rouge) — interprétées selon `better`
  good?: number;
  warn?: number;
}

export const INDICATOR_CATALOG: IndicatorDef[] = [
  // Économie réelle
  { code: "NGDPD",     label: "PIB nominal",        short: "PIB",       category: "real", unit: "Mds $",  fmt: "bn",  better: "high" },
  { code: "PPPGDP",    label: "PIB en PPA",         short: "PIB PPA",   category: "real", unit: "Mds $",  fmt: "bn",  better: "high" },
  { code: "NGDPDPC",   label: "PIB par habitant",   short: "PIB/hab",   category: "real", unit: "USD",    fmt: "usd", better: "high", good: 5000, warn: 2000 },
  { code: "NGDP_RPCH", label: "Croissance du PIB réel", short: "Croissance", category: "real", unit: "%", fmt: "pct_signed", better: "high", good: 5, warn: 2 },
  { code: "LP",        label: "Population",         short: "Population",category: "real", unit: "M hab.", fmt: "num", better: "neutral" },
  // Inflation
  { code: "PCPIPCH",   label: "Inflation (IPC)",    short: "Inflation", category: "inflation", unit: "%", fmt: "pct", better: "low", good: 6, warn: 15 },
  // Finances publiques
  { code: "GGXCNL_NGDP",  label: "Solde budgétaire", short: "Solde budg.", category: "fiscal", unit: "% PIB", fmt: "pct_signed", better: "high", good: -3, warn: -6 },
  { code: "GGXONLB_NGDP", label: "Solde primaire",   short: "Solde prim.", category: "fiscal", unit: "% PIB", fmt: "pct_signed", better: "high", good: 0, warn: -3 },
  { code: "GGR_NGDP",     label: "Recettes publiques", short: "Recettes",  category: "fiscal", unit: "% PIB", fmt: "pct", better: "high", good: 20, warn: 15 },
  { code: "GGX_NGDP",     label: "Dépenses publiques", short: "Dépenses",  category: "fiscal", unit: "% PIB", fmt: "pct", better: "neutral" },
  // Dette
  { code: "GGXWDG_NGDP",  label: "Dette publique",   short: "Dette pub.", category: "debt", unit: "% PIB", fmt: "pct", better: "low", good: 60, warn: 80 },
  { code: "EXTD_TOTAL_GDP", label: "Dette extérieure", short: "Dette ext.", category: "debt", unit: "% PIB", fmt: "pct", better: "low", good: 40, warn: 70 },
  // Secteur extérieur
  { code: "BCA_NGDPD",    label: "Compte courant",   short: "Cpt courant", category: "external", unit: "% PIB", fmt: "pct_signed", better: "high", good: -2, warn: -6 },
  { code: "BX_KLT_DINV_WD_GD_ZS", label: "IDE entrants", short: "IDE", category: "external", unit: "% PIB", fmt: "pct", better: "high", good: 3, warn: 1 },
  { code: "REM_GDP",      label: "Transferts diaspora", short: "Diaspora", category: "external", unit: "% PIB", fmt: "pct", better: "high" },
  { code: "BX_GSR_GNFS_CD", label: "Exportations B&S", short: "Exports", category: "external", unit: "Mds $", fmt: "bn", better: "high" },
  { code: "BM_GSR_GNFS_CD", label: "Importations B&S", short: "Imports", category: "external", unit: "Mds $", fmt: "bn", better: "neutral" },
  // Secteur financier
  { code: "FM_LIPY",      label: "Masse monétaire M2", short: "M2", category: "financial", unit: "% PIB", fmt: "pct", better: "neutral" },
  // Social
  { code: "LUR",          label: "Taux de chômage",  short: "Chômage", category: "social", unit: "%", fmt: "pct", better: "low", good: 6, warn: 12 },
  { code: "SP_DYN_LE00_IN", label: "Espérance de vie", short: "Esp. vie", category: "social", unit: "ans", fmt: "num", better: "high", good: 65, warn: 55 },
  { code: "SE_ADT_LITR_ZS", label: "Alphabétisation", short: "Alphab.", category: "social", unit: "%", fmt: "pct", better: "high", good: 70, warn: 50 },
  { code: "EG_ELC_ACCS_ZS", label: "Accès électricité", short: "Électricité", category: "social", unit: "%", fmt: "pct", better: "high", good: 70, warn: 40 },
  { code: "SH_DYN_MORT",  label: "Mortalité < 5 ans", short: "Mort. <5", category: "social", unit: "‰", fmt: "num", better: "low", good: 30, warn: 60 },
  { code: "SI_POV_DDAY",  label: "Pauvreté < 2,15$/j", short: "Pauvreté", category: "social", unit: "%", fmt: "pct", better: "low", good: 20, warn: 40 },
  // Climat & ESG
  { code: "EN_ATM_CO2E_PC", label: "Émissions CO₂/hab", short: "CO₂/hab", category: "climate", unit: "t", fmt: "num", better: "low" },
  { code: "EG_FEC_RNEW_ZS", label: "Énergie renouvelable", short: "Renouv.", category: "climate", unit: "%", fmt: "pct", better: "high" },
  { code: "IT_NET_USER_ZS", label: "Internautes", short: "Internet", category: "climate", unit: "%", fmt: "pct", better: "high", good: 50, warn: 25 },
];

export const INDICATOR_BY_CODE: Record<string, IndicatorDef> =
  Object.fromEntries(INDICATOR_CATALOG.map((i) => [i.code, i]));

// ── Régions & zones économiques ─────────────────────────────────────────────
export interface RegionDef {
  key: string;
  label: string;
  kind: "geo" | "zone";
  members?: string[];   // pour les zones — liste ISO3
}

export const REGIONS: RegionDef[] = [
  { key: "all",            label: "Toute l'Afrique", kind: "geo" },
  { key: "West Africa",    label: "Afrique de l'Ouest", kind: "geo" },
  { key: "East Africa",    label: "Afrique de l'Est",   kind: "geo" },
  { key: "North Africa",   label: "Afrique du Nord",    kind: "geo" },
  { key: "Central Africa", label: "Afrique Centrale",   kind: "geo" },
  { key: "Southern Africa",label: "Afrique Australe",   kind: "geo" },
  { key: "CEDEAO", label: "CEDEAO", kind: "zone", members: ["NGA","GHA","CIV","SEN","MLI","BFA","NER","BEN","TGO","GIN","SLE","LBR","GMB","GNB","CPV"] },
  { key: "UEMOA",  label: "UEMOA",  kind: "zone", members: ["SEN","CIV","MLI","BFA","NER","TGO","BEN","GNB"] },
  { key: "CEMAC",  label: "CEMAC",  kind: "zone", members: ["CMR","TCD","CAF","COG","GAB","GNQ"] },
  { key: "SADC",   label: "SADC",   kind: "zone", members: ["ZAF","AGO","MOZ","ZMB","ZWE","BWA","NAM","MUS","TZA","COD","MWI","LSO","SWZ","MDG","SYC","COM"] },
  { key: "EAC",    label: "EAC",    kind: "zone", members: ["KEN","TZA","UGA","RWA","BDI","SSD","COD"] },
];

// ── Mapping ISO3 → ISO2 (drapeaux flagcdn) ──────────────────────────────────
export const ISO3_TO_ISO2: Record<string, string> = {
  NGA:"ng", ZAF:"za", EGY:"eg", DZA:"dz", ETH:"et", MAR:"ma", KEN:"ke", AGO:"ao",
  GHA:"gh", CIV:"ci", TZA:"tz", COD:"cd", CMR:"cm", TUN:"tn", SEN:"sn", UGA:"ug",
  ZMB:"zm", RWA:"rw", MLI:"ml", BEN:"bj", BFA:"bf", NER:"ne", TGO:"tg", MOZ:"mz",
  BWA:"bw", GAB:"ga", NAM:"na", MUS:"mu", DJI:"dj", GIN:"gn", TCD:"td", COG:"cg",
  CAF:"cf", GNQ:"gq", GNB:"gw", SLE:"sl", LBR:"lr", GMB:"gm", CPV:"cv", ZWE:"zw",
  MWI:"mw", LSO:"ls", SWZ:"sz", MDG:"mg", SYC:"sc", COM:"km", BDI:"bi", SSD:"ss",
};

export const REGION_LABEL_FR: Record<string, string> = {
  "West Africa":     "Afrique de l'Ouest",
  "East Africa":     "Afrique de l'Est",
  "North Africa":    "Afrique du Nord",
  "Central Africa":  "Afrique Centrale",
  "Southern Africa": "Afrique Australe",
};

// ── Ligne pays : valeurs indexées par code indicateur ───────────────────────
export interface CountryDatum {
  id: string;
  name: string;
  region: string;
  values: Record<string, number>;   // code → valeur
}

// Dataset de repli — valeurs FMI WEO 2024 réelles (8 indicateurs cœur).
// v = { code: value }. Codes : NGDPD, NGDPDPC, NGDP_RPCH, LP, PCPIPCH,
// GGXCNL_NGDP, GGXWDG_NGDP, BCA_NGDPD.
function row(id: string, name: string, region: string,
  gdp: number, gdppc: number, growth: number, pop: number,
  infl: number, fiscal: number, debt: number, ca: number): CountryDatum {
  return {
    id, name, region,
    values: {
      NGDPD: gdp, NGDPDPC: gdppc, NGDP_RPCH: growth, LP: pop,
      PCPIPCH: infl, GGXCNL_NGDP: fiscal, GGXWDG_NGDP: debt, BCA_NGDPD: ca,
    },
  };
}

export const FALLBACK_DATA: CountryDatum[] = [
  row("NGA","Nigeria","West Africa",        477, 2200, 3.1, 223, 32.5, -4.6, 46, 0.8),
  row("ZAF","Afrique du Sud","Southern Africa", 381, 6200, 1.1, 61, 4.6, -5.0, 75, -1.6),
  row("EGY","Égypte","North Africa",        360, 3400, 2.7, 106, 28.3, -7.2, 90, -5.4),
  row("DZA","Algérie","North Africa",       239, 5200, 3.6, 46, 9.2, -5.8, 60, 2.4),
  row("ETH","Éthiopie","East Africa",       156, 1300, 6.8, 120, 24.1, -2.6, 38, -3.1),
  row("MAR","Maroc","North Africa",         142, 3700, 3.2, 37, 2.4, -4.1, 69, -1.2),
  row("KEN","Kenya","East Africa",          110, 2100, 5.0, 53, 6.5, -5.5, 70, -4.0),
  row("AGO","Angola","Central Africa",      108, 3100, 2.4, 35, 28.2, -1.0, 73, 4.5),
  row("CIV","Côte d'Ivoire","West Africa",  78, 2900, 6.5, 27, 3.8, -4.0, 57, -3.7),
  row("GHA","Ghana","West Africa",          77, 2400, 3.1, 33, 22.3, -4.6, 83, -2.0),
  row("TZA","Tanzanie","East Africa",       77, 1200, 5.4, 63, 3.1, -3.0, 42, -3.5),
  row("COD","Congo (RDC)","Central Africa", 65, 660, 6.3, 99, 23.6, -1.0, 15, -3.7),
  row("UGA","Ouganda","East Africa",        50, 1100, 6.1, 48, 3.8, -4.4, 50, -9.2),
  row("CMR","Cameroun","Central Africa",    47, 1700, 4.1, 27, 7.4, -2.5, 48, -4.2),
  row("TUN","Tunisie","North Africa",       46, 3700, 1.8, 12, 9.3, -7.7, 80, -6.2),
  row("SEN","Sénégal","West Africa",        32, 1800, 8.3, 17, 2.8, -4.9, 73, -12.1),
  row("ZMB","Zambie","Southern Africa",     28, 1500, 4.8, 20, 13.0, -7.6, 137, 1.5),
  row("MLI","Mali","West Africa",           22, 1000, 4.0, 23, 2.5, -3.5, 50, -5.5),
  row("GAB","Gabon","Central Africa",       20, 8600, 2.5, 2.3, 4.8, -1.8, 75, 2.5),
  row("BWA","Botswana","Southern Africa",   19, 7400, 3.5, 2.6, 5.5, -1.5, 19, -1.6),
  row("BEN","Bénin","West Africa",          19, 1500, 6.4, 13, 2.7, -4.7, 54, -4.2),
  row("BFA","Burkina Faso","West Africa",   18, 840, 2.5, 22, 3.0, -4.5, 54, -4.1),
  row("MOZ","Mozambique","Southern Africa", 18, 560, 5.5, 33, 6.2, -5.0, 100, -26.0),
  row("NER","Niger","West Africa",          17, 650, 12.3, 26, 3.9, -6.8, 52, -16.0),
  row("GIN","Guinée","West Africa",         16, 1200, 6.5, 13, 9.6, -3.3, 35, -12.0),
  row("RWA","Rwanda","East Africa",         13, 900, 7.0, 14, 5.8, -6.0, 68, -11.4),
  row("NAM","Namibie","Southern Africa",    13, 4700, 3.6, 2.8, 5.8, -5.2, 68, -10.0),
  row("MUS","Maurice","Southern Africa",    13, 10500, 5.6, 1.3, 7.0, -4.0, 85, -5.9),
  row("TGO","Togo","West Africa",           9, 1050, 6.0, 8.8, 4.0, -3.8, 69, -2.9),
  row("DJI","Djibouti","East Africa",       4, 3800, 7.1, 1.0, 3.0, -1.5, 73, -6.0),
];

// ── Formatage des valeurs ───────────────────────────────────────────────────
export function formatValue(def: IndicatorDef, v: number | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  switch (def.fmt) {
    case "bn":  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
    case "usd": return v.toLocaleString("fr-FR");
    case "int": return Math.round(v).toLocaleString("fr-FR");
    case "num": return v >= 100 ? v.toFixed(0) : v.toFixed(1);
    case "pct": return `${v.toFixed(1)}`;
    case "pct_signed": return `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
    default: return String(v);
  }
}

// ── Coloration d'une valeur selon le sens favorable ─────────────────────────
const GREEN = "#10B981", AMBER = "#F59E0B", RED = "#EF4444";

export function valueColor(def: IndicatorDef, v: number | undefined): string {
  if (v == null || def.better === "neutral" || def.good == null || def.warn == null) {
    return "var(--text-primary)";
  }
  if (def.better === "high") {
    if (v >= def.good) return GREEN;
    if (v >= def.warn) return AMBER;
    return RED;
  }
  // better === "low"
  if (v <= def.good) return GREEN;
  if (v <= def.warn) return AMBER;
  return RED;
}

// ── Badge de performance composite (🟢🟡🟠🔴) ────────────────────────────────
export type BadgeLevel = "strong" | "moderate" | "watch" | "risk";

export interface BadgeInfo {
  level: BadgeLevel;
  label: string;
  color: string;
  dot: string;
  score: number;   // 0–100
}

const BADGE_META: Record<BadgeLevel, { label: string; color: string; dot: string }> = {
  strong:   { label: "Très favorable", color: "#10B981", dot: "🟢" },
  moderate: { label: "Modéré",         color: "#F59E0B", dot: "🟡" },
  watch:    { label: "Surveillance",   color: "#F97316", dot: "🟠" },
  risk:     { label: "Risque élevé",   color: "#EF4444", dot: "🔴" },
};

/**
 * Score composite (0–100) à partir de croissance, inflation, dette et compte
 * courant. Chaque sous-score est borné [0,1] puis pondéré.
 */
export function computeBadge(values: Record<string, number>): BadgeInfo {
  const growth = values.NGDP_RPCH;
  const infl   = values.PCPIPCH;
  const debt   = values.GGXWDG_NGDP;
  const ca     = values.BCA_NGDPD;

  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const parts: number[] = [];
  if (growth != null) parts.push(clamp(growth / 7));                 // 7%+ = idéal
  if (infl   != null) parts.push(clamp((20 - infl) / 18));            // ≤2% idéal, ≥20% nul
  if (debt   != null) parts.push(clamp((100 - debt) / 60));           // ≤40% idéal, ≥100% nul
  if (ca     != null) parts.push(clamp((ca + 12) / 16));              // -12%..+4%

  const score = parts.length ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : 50;

  let level: BadgeLevel;
  if (score >= 65) level = "strong";
  else if (score >= 48) level = "moderate";
  else if (score >= 32) level = "watch";
  else level = "risk";

  const meta = BADGE_META[level];
  return { level, label: meta.label, color: meta.color, dot: meta.dot, score: Math.round(score) };
}

// ── Filtre des pays par région / zone ───────────────────────────────────────
export function filterByRegion(data: CountryDatum[], regionKey: string): CountryDatum[] {
  if (regionKey === "all") return data;
  const region = REGIONS.find((r) => r.key === regionKey);
  if (!region) return data;
  if (region.kind === "geo") return data.filter((d) => d.region === regionKey);
  if (region.members) return data.filter((d) => region.members!.includes(d.id));
  return data;
}

// ── Rang africain d'un pays pour un indicateur ──────────────────────────────
export function africanRank(
  data: CountryDatum[], code: string, countryId: string, better: Direction,
): { rank: number; total: number } | null {
  const withVal = data
    .filter((d) => d.values[code] != null)
    .sort((a, b) => better === "low"
      ? a.values[code] - b.values[code]
      : b.values[code] - a.values[code]);
  const idx = withVal.findIndex((d) => d.id === countryId);
  if (idx === -1) return null;
  return { rank: idx + 1, total: withVal.length };
}

// ── Moyenne régionale d'un indicateur ───────────────────────────────────────
export function regionalAverage(data: CountryDatum[], code: string): number | null {
  const vals = data.map((d) => d.values[code]).filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
