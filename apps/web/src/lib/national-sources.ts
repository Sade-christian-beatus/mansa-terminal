/**
 * Catalogue des sources nationales (repli côté client).
 *
 * Miroir léger de `apps/api/app/data/national_sources.py`. Permet d'afficher
 * les institutions (institut de statistique, banque centrale) et quelques
 * indicateurs nationaux même quand le backend / Dagster n'est pas disponible
 * (mode démo). Quand l'API répond, ses données priment.
 */
import type { Institution } from "@/lib/api";

const UEMOA = new Set(["SEN", "CIV", "MLI", "BFA", "NER", "TGO", "BEN", "GNB"]);
const CEMAC = new Set(["CMR", "TCD", "CAF", "COG", "GAB", "GNQ"]);

const BCEAO: Institution = {
  name: "Banque Centrale des États de l'Afrique de l'Ouest",
  abbrev: "BCEAO",
  url: "https://www.bceao.int",
};
const BEAC: Institution = {
  name: "Banque des États de l'Afrique Centrale",
  abbrev: "BEAC",
  url: "https://www.beac.int",
};

const CENTRAL_BANKS: Record<string, Institution> = {
  NGA: { name: "Central Bank of Nigeria",          abbrev: "CBN",  url: "https://www.cbn.gov.ng" },
  ZAF: { name: "South African Reserve Bank",       abbrev: "SARB", url: "https://www.resbank.co.za" },
  EGY: { name: "Central Bank of Egypt",            abbrev: "CBE",  url: "https://www.cbe.org.eg" },
  MAR: { name: "Bank Al-Maghrib",                  abbrev: "BAM",  url: "https://www.bkam.ma" },
  KEN: { name: "Central Bank of Kenya",            abbrev: "CBK",  url: "https://www.centralbank.go.ke" },
  GHA: { name: "Bank of Ghana",                    abbrev: "BoG",  url: "https://www.bog.gov.gh" },
  TUN: { name: "Banque Centrale de Tunisie",       abbrev: "BCT",  url: "https://www.bct.gov.tn" },
  ETH: { name: "National Bank of Ethiopia",        abbrev: "NBE",  url: "https://nbe.gov.et" },
  TZA: { name: "Bank of Tanzania",                 abbrev: "BoT",  url: "https://www.bot.go.tz" },
  UGA: { name: "Bank of Uganda",                   abbrev: "BoU",  url: "https://www.bou.or.ug" },
  RWA: { name: "National Bank of Rwanda",          abbrev: "BNR",  url: "https://www.bnr.rw" },
  ZMB: { name: "Bank of Zambia",                   abbrev: "BoZ",  url: "https://www.boz.zm" },
  MOZ: { name: "Banco de Moçambique",              abbrev: "BdM",  url: "https://www.bancomoc.mz" },
  DZA: { name: "Banque d'Algérie",                 abbrev: "BA",   url: "https://www.bank-of-algeria.dz" },
  AGO: { name: "Banco Nacional de Angola",         abbrev: "BNA",  url: "https://www.bna.ao" },
  MUS: { name: "Bank of Mauritius",                abbrev: "BoM",  url: "https://www.bom.mu" },
  BWA: { name: "Bank of Botswana",                 abbrev: "BoB",  url: "https://www.bankofbotswana.bw" },
  NAM: { name: "Bank of Namibia",                  abbrev: "BoN",  url: "https://www.bon.com.na" },
  ZWE: { name: "Reserve Bank of Zimbabwe",         abbrev: "RBZ",  url: "https://www.rbz.co.zw" },
  MWI: { name: "Reserve Bank of Malawi",           abbrev: "RBM",  url: "https://www.rbm.mw" },
  MDG: { name: "Banky Foiben'i Madagasikara",      abbrev: "BFM",  url: "https://www.banky-foibe.mg" },
  GIN: { name: "Banque Centrale de la République de Guinée", abbrev: "BCRG", url: "https://www.bcrg-guinee.org" },
  MRT: { name: "Banque Centrale de Mauritanie",    abbrev: "BCM",  url: "https://www.bcm.mr" },
  SLE: { name: "Bank of Sierra Leone",             abbrev: "BSL",  url: "https://www.bsl.gov.sl" },
  LBR: { name: "Central Bank of Liberia",          abbrev: "CBL",  url: "https://www.cbl.org.lr" },
  GMB: { name: "Central Bank of The Gambia",       abbrev: "CBG",  url: "https://www.cbg.gm" },
};

const STATS_INSTITUTES: Record<string, Institution> = {
  BFA: { name: "Institut National de la Statistique et de la Démographie", abbrev: "INSD",   url: "https://www.insd.bf" },
  SEN: { name: "Agence Nationale de la Statistique et de la Démographie",   abbrev: "ANSD",   url: "https://www.ansd.sn" },
  CIV: { name: "Institut National de la Statistique",                       abbrev: "INS",    url: "https://www.ins.ci" },
  MLI: { name: "Institut National de la Statistique",                       abbrev: "INSTAT", url: "https://www.instat-mali.org" },
  NER: { name: "Institut National de la Statistique",                       abbrev: "INS",    url: "https://www.stat-niger.org" },
  BEN: { name: "Institut National de la Statistique et de la Démographie",  abbrev: "INStaD", url: "https://instad.bj" },
  TGO: { name: "Institut National de la Statistique (INSEED)",              abbrev: "INSEED", url: "https://inseed.tg" },
  GNB: { name: "Instituto Nacional de Estatística",                         abbrev: "INE",    url: "https://www.stat-guinebissau.com" },
  CMR: { name: "Institut National de la Statistique",                       abbrev: "INS",    url: "https://ins-cameroun.cm" },
  TCD: { name: "Institut National de la Statistique (INSEED)",              abbrev: "INSEED", url: "https://www.inseed.td" },
  CAF: { name: "Institut Centrafricain des Statistiques",                   abbrev: "ICASEES",url: "https://www.icasees.org" },
  COG: { name: "Institut National de la Statistique",                       abbrev: "INS",    url: "https://ins-congo.cg" },
  GAB: { name: "Direction Générale de la Statistique",                      abbrev: "DGS",    url: "https://www.dgstat.ga" },
  GNQ: { name: "Instituto Nacional de Estadística",                         abbrev: "INEGE",  url: "https://www.inege.gq" },
  NGA: { name: "National Bureau of Statistics",                            abbrev: "NBS",    url: "https://www.nigerianstat.gov.ng" },
  ZAF: { name: "Statistics South Africa",                                  abbrev: "StatsSA",url: "https://www.statssa.gov.za" },
  EGY: { name: "Central Agency for Public Mobilization and Statistics",    abbrev: "CAPMAS", url: "https://www.capmas.gov.eg" },
  MAR: { name: "Haut-Commissariat au Plan",                               abbrev: "HCP",    url: "https://www.hcp.ma" },
  GHA: { name: "Ghana Statistical Service",                                abbrev: "GSS",    url: "https://www.statsghana.gov.gh" },
  KEN: { name: "Kenya National Bureau of Statistics",                      abbrev: "KNBS",   url: "https://www.knbs.or.ke" },
  ETH: { name: "Ethiopian Statistical Service",                            abbrev: "ESS",    url: "https://www.statsethiopia.gov.et" },
  TZA: { name: "National Bureau of Statistics",                            abbrev: "NBS",    url: "https://www.nbs.go.tz" },
  UGA: { name: "Uganda Bureau of Statistics",                              abbrev: "UBOS",   url: "https://www.ubos.org" },
  RWA: { name: "National Institute of Statistics of Rwanda",               abbrev: "NISR",   url: "https://www.statistics.gov.rw" },
  DZA: { name: "Office National des Statistiques",                         abbrev: "ONS",    url: "https://www.ons.dz" },
  TUN: { name: "Institut National de la Statistique",                      abbrev: "INS",    url: "https://www.ins.tn" },
  AGO: { name: "Instituto Nacional de Estatística",                        abbrev: "INE",    url: "https://www.ine.gov.ao" },
  MOZ: { name: "Instituto Nacional de Estatística",                        abbrev: "INE",    url: "https://www.ine.gov.mz" },
  ZMB: { name: "Zambia Statistics Agency",                                 abbrev: "ZamStats",url: "https://www.zamstats.gov.zm" },
  ZWE: { name: "Zimbabwe National Statistics Agency",                      abbrev: "ZimStat",url: "https://www.zimstat.co.zw" },
  MUS: { name: "Statistics Mauritius",                                     abbrev: "StatsMU",url: "https://statsmauritius.govmu.org" },
  BWA: { name: "Statistics Botswana",                                      abbrev: "StatsBW",url: "https://www.statsbots.org.bw" },
  NAM: { name: "Namibia Statistics Agency",                                abbrev: "NSA",    url: "https://nsa.org.na" },
  MWI: { name: "National Statistical Office",                              abbrev: "NSO",    url: "http://www.nsomalawi.mw" },
  MDG: { name: "Institut National de la Statistique",                      abbrev: "INSTAT", url: "https://www.instat.mg" },
  GIN: { name: "Institut National de la Statistique",                      abbrev: "INS",    url: "https://www.stat-guinee.org" },
  SLE: { name: "Statistics Sierra Leone",                                  abbrev: "StatsSL",url: "https://www.statistics.sl" },
  GMB: { name: "Gambia Bureau of Statistics",                              abbrev: "GBoS",   url: "https://www.gbosdata.org" },
  MRT: { name: "Agence Nationale de la Statistique (ANSADE)",              abbrev: "ANSADE", url: "https://www.ansade.mr" },
};

/** Taux directeur officiel (dernier connu) — repli mode démo. */
const POLICY_RATE: Record<string, { rate: number; period: string }> = {
  // UEMOA — BCEAO
  SEN: { rate: 3.5, period: "2024-06" }, CIV: { rate: 3.5, period: "2024-06" },
  MLI: { rate: 3.5, period: "2024-06" }, BFA: { rate: 3.5, period: "2024-06" },
  NER: { rate: 3.5, period: "2024-06" }, TGO: { rate: 3.5, period: "2024-06" },
  BEN: { rate: 3.5, period: "2024-06" }, GNB: { rate: 3.5, period: "2024-06" },
  // CEMAC — BEAC
  CMR: { rate: 5.0, period: "2024-03" }, TCD: { rate: 5.0, period: "2024-03" },
  CAF: { rate: 5.0, period: "2024-03" }, COG: { rate: 5.0, period: "2024-03" },
  GAB: { rate: 5.0, period: "2024-03" }, GNQ: { rate: 5.0, period: "2024-03" },
  // Autres
  NGA: { rate: 26.25, period: "2024-07" }, ZAF: { rate: 8.25, period: "2024-09" },
  EGY: { rate: 27.25, period: "2024-03" }, MAR: { rate: 3.0,  period: "2024-06" },
  KEN: { rate: 13.0,  period: "2024-06" }, GHA: { rate: 29.0, period: "2024-07" },
  TUN: { rate: 8.0,   period: "2024-01" }, ETH: { rate: 15.0, period: "2024-01" },
  TZA: { rate: 5.5,   period: "2024-04" }, UGA: { rate: 10.25,period: "2024-06" },
  RWA: { rate: 6.5,   period: "2024-04" }, ZMB: { rate: 13.5, period: "2024-02" },
  MOZ: { rate: 15.0,  period: "2024-04" }, DZA: { rate: 3.0,  period: "2024-01" },
};

/** Moyenne continentale des taux directeurs connus (pour la carte KPI). */
export function averagePolicyRate(): number {
  const rates = Object.values(POLICY_RATE).map((p) => p.rate);
  return Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100;
}

export function getCentralBank(countryId: string): Institution | null {
  const cid = countryId.toUpperCase();
  if (UEMOA.has(cid)) return BCEAO;
  if (CEMAC.has(cid)) return BEAC;
  return CENTRAL_BANKS[cid] ?? null;
}

export function getStatsInstitute(countryId: string): Institution | null {
  return STATS_INSTITUTES[countryId.toUpperCase()] ?? null;
}

export interface NationalIndicator {
  code: string;
  period: string;
  value: number;
  unit: string | null;
  source: string;
}

/**
 * Indicateurs nationaux de repli (mode démo) : taux directeur (banque centrale)
 * + IPC national (institut de statistique, dérivé de l'inflation statique).
 */
export function getFallbackNationalIndicators(
  countryId: string,
  fallbackInflation: number | null,
): NationalIndicator[] {
  const cid = countryId.toUpperCase();
  const out: NationalIndicator[] = [];
  const cb = getCentralBank(cid);
  const pr = POLICY_RATE[cid];
  if (cb && pr) {
    out.push({ code: "INT_POLICY", period: pr.period, value: pr.rate, unit: "%", source: cb.abbrev });
  }
  const si = getStatsInstitute(cid);
  if (si && fallbackInflation != null) {
    out.push({ code: "CPI_NAT", period: "2024-12", value: fallbackInflation, unit: "%", source: si.abbrev });
  }
  return out;
}

/* ── Catalogue d'indicateurs publiés par type d'institution ──────────────────
   Permet d'afficher l'offre statistique complète de chaque source nationale,
   et pas seulement les quelques séries déjà ingérées. */

export interface CatalogIndicator {
  code: string;
  label: string;
  unit: string;
}

export interface NationalCatalogGroup {
  inst: Institution;
  role: string;
  indicators: CatalogIndicator[];
}

export interface NationalCatalog {
  centralBank: NationalCatalogGroup | null;
  statsInstitute: NationalCatalogGroup | null;
}

/** Séries habituellement publiées par une banque centrale africaine. */
const CENTRAL_BANK_CATALOG: CatalogIndicator[] = [
  { code: "INT_POLICY",      label: "Taux directeur",              unit: "%" },
  { code: "INT_RESERVE_REQ", label: "Réserves obligatoires",       unit: "%" },
  { code: "INT_INTERBANK",   label: "Taux interbancaire",          unit: "%" },
  { code: "FX_CBN_USD",      label: "Taux de change officiel",     unit: "/USD" },
  { code: "FX_RESERVES",     label: "Réserves de change",          unit: "mois imp." },
  { code: "M2_GDP",          label: "Masse monétaire (M2)",        unit: "% PIB" },
  { code: "CREDIT_PRIV",     label: "Crédit au secteur privé",     unit: "% PIB" },
  { code: "BOP_CA_NAT",      label: "Balance des paiements",       unit: "% PIB" },
];

/** Séries habituellement publiées par un institut national de statistique. */
const STATS_CATALOG: CatalogIndicator[] = [
  { code: "CPI_NAT",        label: "Indice des prix (IPC)",       unit: "%" },
  { code: "GDP_GROWTH_NAT", label: "Croissance du PIB",           unit: "%" },
  { code: "GDP_NAT",        label: "PIB nominal",                 unit: "Mds" },
  { code: "UNEMP_NAT",      label: "Taux de chômage",             unit: "%" },
  { code: "IPI_NAT",        label: "Production industrielle",     unit: "indice" },
  { code: "TRADE_BAL_NAT",  label: "Balance commerciale",         unit: "Mds" },
  { code: "POP_NAT",        label: "Population",                  unit: "M hab." },
  { code: "POVERTY_NAT",    label: "Taux de pauvreté",            unit: "%" },
];

/**
 * Catalogue INSD propre au Burkina Faso — « chiffres clés » de l'Annuaire
 * Statistique National (INSD). Ces codes correspondent aux séries ingérées par
 * `scripts/ingest_burkina_insd.py` (source = INSD) : les valeurs s'affichent
 * donc avec leur dernier point réel. Le détail exhaustif des annuaires (≈4 900
 * indicateurs) reste interrogeable via l'API et l'IA, hors de cette vitrine.
 */
const STATS_CATALOG_BFA: CatalogIndicator[] = [
  { code: "INSD_KEY_pib_production",            label: "PIB (optique production)",        unit: "Mds FCFA" },
  { code: "INSD_KEY_taux_inflation",            label: "Taux d'inflation",                unit: "%" },
  { code: "INSD_KEY_population_totale",         label: "Population totale",               unit: "hab." },
  { code: "INSD_KEY_population_urbaine",        label: "Population urbaine",              unit: "hab." },
  { code: "INSD_KEY_densite_population",        label: "Densité de population",           unit: "hab/km²" },
  { code: "INSD_KEY_esperance_vie",             label: "Espérance de vie",                unit: "ans" },
  { code: "INSD_KEY_taux_alphabetisation",      label: "Taux d'alphabétisation",          unit: "%" },
  { code: "INSD_KEY_scolarisation_primaire",    label: "Scolarisation primaire (TBS)",    unit: "%" },
  { code: "INSD_KEY_succes_bac",                label: "Taux de succès au BAC",           unit: "%" },
  { code: "INSD_KEY_rang_idh",                  label: "Rang IDH (/193)",                 unit: "rang" },
  { code: "INSD_KEY_incidence_pauvrete",        label: "Incidence de la pauvreté",        unit: "%" },
  { code: "INSD_KEY_taux_chomage",              label: "Taux de chômage",                 unit: "%" },
  { code: "INSD_KEY_smig_mensuel",              label: "SMIG mensuel",                    unit: "FCFA" },
  { code: "INSD_KEY_agents_publics",            label: "Agents publics",                  unit: "agents" },
  { code: "INSD_KEY_production_cereales",       label: "Production de céréales",          unit: "k tonnes" },
  { code: "INSD_KEY_production_coton",          label: "Production de coton",             unit: "k tonnes" },
  { code: "INSD_KEY_production_or",             label: "Production d'or",                 unit: "tonnes" },
  { code: "INSD_KEY_taux_electrification",      label: "Taux d'électrification",          unit: "%" },
];

const STATS_CATALOG_BY_COUNTRY: Record<string, CatalogIndicator[]> = {
  BFA: STATS_CATALOG_BFA,
};

/**
 * Catalogue des indicateurs proposés par les sources nationales d'un pays,
 * groupé par institution (banque centrale, institut de statistique).
 */
export function getNationalCatalog(countryId: string): NationalCatalog {
  const cid = countryId.toUpperCase();
  const cb = getCentralBank(cid);
  const si = getStatsInstitute(cid);
  const statsIndicators = STATS_CATALOG_BY_COUNTRY[cid] ?? STATS_CATALOG;
  return {
    centralBank: cb ? { inst: cb, role: "Banque centrale", indicators: CENTRAL_BANK_CATALOG } : null,
    statsInstitute: si ? { inst: si, role: "Institut de statistique", indicators: statsIndicators } : null,
  };
}
