/**
 * MANSA Terminal — Catalogue complet des indicateurs
 * Source : mansa-data-mapping-v3.xlsx (141 indicateurs · 9 domaines · 54 pays)
 */

export type ThemeId =
  | "real_sector"
  | "fiscal_debt"
  | "external"
  | "financial"
  | "mining"
  | "climate"
  | "social"
  | "private"
  | "trade";

export type ApiAvailability = "yes" | "partial" | "no" | "paid";

export interface IndicatorDef {
  id: string;
  theme: ThemeId;
  category: string;
  name_en: string;
  name_fr: string;
  source_primary: string;
  sources_secondary: string[];
  frequency: string;
  lag: string;
  coverage: string;
  api: ApiAvailability;
  use_case: string;
  /** Phase MANSA où cet indicateur est/sera disponible */
  phase: 1 | 2 | 3;
}

export const THEMES: Record<ThemeId, { name_fr: string; name_en: string; phase: 1 | 2 | 3 }> = {
  real_sector: { name_fr: "Secteur réel",           name_en: "Real Sector",                  phase: 1 },
  fiscal_debt:  { name_fr: "Fiscal & Dette",         name_en: "Fiscal & Public Debt",         phase: 1 },
  external:     { name_fr: "Secteur extérieur",      name_en: "External Sector",              phase: 1 },
  financial:    { name_fr: "Secteur financier",      name_en: "Financial Sector",             phase: 2 },
  mining:       { name_fr: "Mines & Extractifs",     name_en: "Mining & Extractives",         phase: 3 },
  climate:      { name_fr: "Climat & Environnement", name_en: "Climate & Environment",        phase: 2 },
  social:       { name_fr: "Social & Gouvernance",   name_en: "Social & Governance",          phase: 2 },
  private:      { name_fr: "Secteur privé",          name_en: "Private Sector & Investment",  phase: 2 },
  trade:        { name_fr: "Commerce & Intégration", name_en: "Trade & Regional Integration", phase: 2 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Secteur réel (20 indicateurs)
// ─────────────────────────────────────────────────────────────────────────────
const REAL_SECTOR: IndicatorDef[] = [
  {
    id: "gdp_growth",         theme: "real_sector", category: "National Accounts",
    name_en: "GDP Real Growth Rate",              name_fr: "Croissance du PIB réel",
    source_primary: "IMF WEO",                   sources_secondary: ["World Bank WDI", "AfDB"],
    frequency: "Annual",   lag: "3-12 months",   coverage: "54", api: "yes",
    use_case: "Macro dashboard, AI growth analysis, country brief", phase: 1,
  },
  {
    id: "gdp_by_sector",      theme: "real_sector", category: "National Accounts",
    name_en: "GDP by Sector (Agri/Industry/Services)",name_fr: "PIB par secteur",
    source_primary: "World Bank WDI",            sources_secondary: ["IMF Article IV"],
    frequency: "Annual",   lag: "6-18 months",   coverage: "54", api: "yes",
    use_case: "Structural transformation analysis", phase: 1,
  },
  {
    id: "gdp_per_capita",     theme: "real_sector", category: "National Accounts",
    name_en: "GDP per Capita (USD, PPP)",         name_fr: "PIB par habitant",
    source_primary: "IMF WEO",                   sources_secondary: ["World Bank WDI", "Penn World Table"],
    frequency: "Annual",   lag: "3-12 months",   coverage: "54", api: "yes",
    use_case: "Income convergence, peer benchmarking", phase: 1,
  },
  {
    id: "gdp_quarterly",      theme: "real_sector", category: "National Accounts",
    name_en: "Quarterly GDP Estimates",           name_fr: "PIB trimestriel",
    source_primary: "National Stats Offices",    sources_secondary: ["IMF IFS"],
    frequency: "Quarterly",lag: "1-3 months",    coverage: "~20", api: "partial",
    use_case: "High-frequency growth tracking, nowcasting", phase: 2,
  },
  {
    id: "gdp_nightlights",    theme: "real_sector", category: "National Accounts",
    name_en: "Nightlights-based GDP Proxy (VIIRS)",name_fr: "Proxy PIB satellite (VIIRS)",
    source_primary: "NASA VIIRS (NOAA)",         sources_secondary: ["World Bank DMSP/VIIRS"],
    frequency: "Monthly",  lag: "~1 month",      coverage: "54", api: "yes",
    use_case: "MANSA Economic Activity Index (MEAI), subnational maps", phase: 3,
  },
  {
    id: "cpi_headline",       theme: "real_sector", category: "Prices & Inflation",
    name_en: "Headline CPI / Inflation Rate",     name_fr: "IPC / Inflation IPC",
    source_primary: "IMF IFS",                   sources_secondary: ["World Bank WDI", "BCEAO", "BEAC"],
    frequency: "Monthly",  lag: "1-2 months",    coverage: "54", api: "yes",
    use_case: "Inflation tracker, monetary dashboard, AI inflation alert", phase: 1,
  },
  {
    id: "cpi_components",     theme: "real_sector", category: "Prices & Inflation",
    name_en: "CPI by Component (Food, Energy, Core)",name_fr: "IPC par composante",
    source_primary: "National Stats Offices",    sources_secondary: ["FAO Food Price Index", "BCEAO"],
    frequency: "Monthly",  lag: "1-2 months",    coverage: "~35", api: "partial",
    use_case: "Food inflation early warning, cost-of-living analysis", phase: 2,
  },
  {
    id: "ppi",                theme: "real_sector", category: "Prices & Inflation",
    name_en: "Producer Price Index (PPI)",        name_fr: "Indice des prix à la production",
    source_primary: "National Stats Offices",    sources_secondary: ["IMF IFS"],
    frequency: "Monthly/Quarterly", lag: "2-4 months", coverage: "~25", api: "partial",
    use_case: "Input cost tracking, manufacturing competitiveness", phase: 2,
  },
  {
    id: "gdp_deflator",       theme: "real_sector", category: "Prices & Inflation",
    name_en: "GDP Deflator",                      name_fr: "Déflateur du PIB",
    source_primary: "IMF WEO",                   sources_secondary: ["World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Real vs nominal growth decomposition", phase: 1,
  },
  {
    id: "unemployment",       theme: "real_sector", category: "Employment",
    name_en: "Unemployment Rate",                 name_fr: "Taux de chômage",
    source_primary: "ILO ILOSTAT",               sources_secondary: ["World Bank WDI", "IMF WEO"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "~45", api: "yes",
    use_case: "Labour market dashboard, social vulnerability tracker", phase: 1,
  },
  {
    id: "informal_employment",theme: "real_sector", category: "Employment",
    name_en: "Informal Employment Share",         name_fr: "Part de l'emploi informel",
    source_primary: "ILO ILOSTAT",               sources_secondary: ["World Bank WDI", "AfDB"],
    frequency: "Irregular",lag: "1-3 years",     coverage: "~40", api: "partial",
    use_case: "Labour market structural analysis", phase: 2,
  },
  {
    id: "population",         theme: "real_sector", category: "Demographics",
    name_en: "Population (total, growth rate, density)",name_fr: "Population totale et croissance",
    source_primary: "World Bank WDI",            sources_secondary: ["UN DESA; AfDB"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Demographic dashboard, market size analysis", phase: 1,
  },
  {
    id: "urban_population",   theme: "real_sector", category: "Demographics",
    name_en: "Urban Population Share",            name_fr: "Part de la population urbaine",
    source_primary: "World Bank WDI",            sources_secondary: ["UN DESA; AfDB"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Urbanisation tracker, consumer market potential", phase: 2,
  },
  {
    id: "agricultural_production",theme:"real_sector",category:"Production",
    name_en: "Agricultural Production Index",     name_fr: "Production agricole",
    source_primary: "FAO FAOSTAT",               sources_secondary: ["World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Food security analysis, agricultural sector tracker", phase: 2,
  },
  {
    id: "electricity_access",  theme: "real_sector", category: "Production",
    name_en: "Electricity Access Rate",           name_fr: "Taux d'accès à l'électricité",
    source_primary: "World Bank WDI",            sources_secondary: ["IEA; AfDB"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Energy access dashboard, infrastructure gap", phase: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fiscal & Dette (22 indicateurs)
// ─────────────────────────────────────────────────────────────────────────────
const FISCAL_DEBT: IndicatorDef[] = [
  {
    id: "gov_revenue_total",  theme: "fiscal_debt", category: "Revenue",
    name_en: "Total Government Revenue (% GDP)",  name_fr: "Recettes publiques totales (% PIB)",
    source_primary: "IMF GFS/WEO",               sources_secondary: ["World Bank WDI", "AfDB"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Fiscal dashboard, revenue performance tracker", phase: 1,
  },
  {
    id: "tax_revenue",        theme: "fiscal_debt", category: "Revenue",
    name_en: "Tax Revenue (% GDP)",               name_fr: "Recettes fiscales (% PIB)",
    source_primary: "IMF GFS",                   sources_secondary: ["OECD Revenue Stats Africa", "ICTD/UNU-WIDER"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Tax effort analysis, DRM benchmarking", phase: 1,
  },
  {
    id: "tax_by_type",        theme: "fiscal_debt", category: "Revenue",
    name_en: "Tax Revenue by Type (VAT, Income, Trade)",name_fr: "Recettes par type d'impôt",
    source_primary: "IMF GFS",                   sources_secondary: ["OECD Revenue Stats Africa", "ICTD"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "~45", api: "partial",
    use_case: "Tax structure analysis, DRM reform tracking", phase: 2,
  },
  {
    id: "non_tax_revenue",    theme: "fiscal_debt", category: "Revenue",
    name_en: "Non-Tax Revenue (incl. Resource Royalties)",name_fr: "Recettes non fiscales et extractives",
    source_primary: "IMF GFS",                   sources_secondary: ["EITI Reports"],
    frequency: "Annual",   lag: "6-18 months",   coverage: "54", api: "partial",
    use_case: "Resource revenue dependency analysis", phase: 2,
  },
  {
    id: "official_grants",    theme: "fiscal_debt", category: "Revenue",
    name_en: "Official Grants Received (% GDP)",  name_fr: "Dons officiels reçus (% PIB)",
    source_primary: "IMF GFS/WEO",               sources_secondary: ["OECD DAC", "World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Aid dependency tracker, fiscal sustainability", phase: 1,
  },
  {
    id: "budget_execution_revenue",theme:"fiscal_debt",category:"Revenue",
    name_en: "Budget Execution Rate (Revenue)",   name_fr: "Taux d'exécution budgétaire (recettes)",
    source_primary: "National Finance Ministries",sources_secondary: ["IMF MFTS"],
    frequency: "Monthly/Quarterly",lag:"1-3 months",coverage:"~30",api:"no",
    use_case: "MANSA proprietary: real-time fiscal tracking", phase: 3,
  },
  {
    id: "gov_expenditure",    theme: "fiscal_debt", category: "Expenditure",
    name_en: "Total Government Expenditure (% GDP)",name_fr: "Dépenses publiques totales (% PIB)",
    source_primary: "IMF GFS/WEO",               sources_secondary: ["World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Spending efficiency dashboard", phase: 1,
  },
  {
    id: "expenditure_by_function",theme:"fiscal_debt",category:"Expenditure",
    name_en: "Expenditure by Function (Education, Health, Defense)",name_fr: "Dépenses par fonction",
    source_primary: "IMF GFS",                   sources_secondary: ["World Bank BOOST", "UNESCO", "WHO"],
    frequency: "Annual",   lag: "6-18 months",   coverage: "~40", api: "partial",
    use_case: "Social spending tracker, sectoral allocation", phase: 2,
  },
  {
    id: "capital_vs_recurrent",theme:"fiscal_debt",category:"Expenditure",
    name_en: "Capital vs Recurrent Expenditure Split",name_fr: "Investissement vs dépenses courantes",
    source_primary: "National budget docs",       sources_secondary: ["IMF Article IV", "World Bank PERs"],
    frequency: "Annual",   lag: "6-18 months",   coverage: "~35", api: "no",
    use_case: "Investment effort analysis, infrastructure gap", phase: 2,
  },
  {
    id: "fiscal_balance",     theme: "fiscal_debt", category: "Fiscal Balance",
    name_en: "Fiscal Balance / Budget Deficit (% GDP)",name_fr: "Solde budgétaire (% PIB)",
    source_primary: "IMF GFS/WEO",               sources_secondary: ["World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Fiscal sustainability analysis, twin deficit tracker", phase: 1,
  },
  {
    id: "primary_balance",    theme: "fiscal_debt", category: "Fiscal Balance",
    name_en: "Primary Fiscal Balance (% GDP)",    name_fr: "Solde primaire (% PIB)",
    source_primary: "IMF Fiscal Monitor",         sources_secondary: ["IMF Article IV"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Debt sustainability analysis (DSA)", phase: 1,
  },
  {
    id: "public_debt_total",  theme: "fiscal_debt", category: "Public Debt",
    name_en: "General Government Gross Debt (% GDP)",name_fr: "Dette publique brute (% PIB)",
    source_primary: "IMF Fiscal Monitor/WEO",    sources_secondary: ["World Bank WDI", "WB IDS"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Debt sustainability dashboard, DSA analysis", phase: 1,
  },
  {
    id: "external_debt_total",theme: "fiscal_debt", category: "Public Debt",
    name_en: "External Debt (% GDP, % Exports)",  name_fr: "Dette extérieure (% PIB, % exports)",
    source_primary: "World Bank IDS",             sources_secondary: ["IMF WEO", "BIS"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "External vulnerability, debt distress risk", phase: 1,
  },
  {
    id: "debt_service",       theme: "fiscal_debt", category: "Public Debt",
    name_en: "Debt Service Ratio (% Revenue, % Exports)",name_fr: "Service de la dette (% recettes, % exports)",
    source_primary: "IMF WEO/WB IDS",            sources_secondary: ["AfDB"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Debt service capacity, IMF DSA replication", phase: 1,
  },
  {
    id: "debt_by_creditor",   theme: "fiscal_debt", category: "Public Debt",
    name_en: "Public Debt by Creditor (Bilateral, Multilateral, Commercial)",name_fr: "Dette par créancier",
    source_primary: "World Bank IDS / DRS",       sources_secondary: ["Paris Club", "AidData", "OECD CRS"],
    frequency: "Annual",   lag: "6-18 months",   coverage: "~50", api: "partial",
    use_case: "Debt restructuring analysis, China debt tracker", phase: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Secteur extérieur (19 indicateurs)
// ─────────────────────────────────────────────────────────────────────────────
const EXTERNAL: IndicatorDef[] = [
  {
    id: "merchandise_trade",  theme: "external", category: "Trade",
    name_en: "Merchandise Exports & Imports (USD, % GDP)",name_fr: "Exportations et importations de biens",
    source_primary: "UN Comtrade",               sources_secondary: ["IMF DOTS", "World Bank WDI", "WTO"],
    frequency: "Annual (monthly for major)", lag:"3-6 months",coverage:"54",api:"yes",
    use_case: "Trade balance dashboard, export diversification", phase: 1,
  },
  {
    id: "trade_by_partner",   theme: "external", category: "Trade",
    name_en: "Bilateral Trade Flows (Top Partners)",name_fr: "Commerce bilatéral par partenaire",
    source_primary: "IMF DOTS",                  sources_secondary: ["UN Comtrade"],
    frequency: "Annual/Quarterly",lag:"3-6 months",coverage:"54",api:"yes",
    use_case: "Trade dependency map, China/EU/US flow tracker", phase: 2,
  },
  {
    id: "trade_by_commodity", theme: "external", category: "Trade",
    name_en: "Export/Import Composition by Product (HS codes)",name_fr: "Composition du commerce par produit",
    source_primary: "UN Comtrade",               sources_secondary: ["UNCTAD"],
    frequency: "Annual",   lag: "3-12 months",   coverage: "54", api: "yes",
    use_case: "Export concentration, commodity dependency", phase: 2,
  },
  {
    id: "services_trade",     theme: "external", category: "Trade",
    name_en: "Services Trade (Tourism, Transport, Financial)",name_fr: "Commerce des services",
    source_primary: "WTO/UNCTAD",                sources_secondary: ["IMF BOP"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "partial",
    use_case: "Services sector analysis, tourism revenue", phase: 2,
  },
  {
    id: "terms_of_trade",     theme: "external", category: "Trade",
    name_en: "Net Barter Terms of Trade Index",   name_fr: "Termes de l'échange",
    source_primary: "World Bank WDI",            sources_secondary: ["UNCTAD"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "External vulnerability analysis", phase: 1,
  },
  {
    id: "port_activity",      theme: "external", category: "Trade",
    name_en: "Port Vessel Calls & Cargo Throughput (AIS)",name_fr: "Activité portuaire (AIS/suivi navires)",
    source_primary: "IMF PortWatch",             sources_secondary: ["MarineTraffic", "UNCTAD"],
    frequency: "Daily",    lag: "Real-time",     coverage: "38+ coastal", api: "yes",
    use_case: "MANSA MEAI: real-time trade proxy, port efficiency", phase: 3,
  },
  {
    id: "current_account",    theme: "external", category: "Balance of Payments",
    name_en: "Current Account Balance (% GDP)",   name_fr: "Solde du compte courant (% PIB)",
    source_primary: "IMF BOP/WEO",               sources_secondary: ["World Bank WDI"],
    frequency: "Annual/Quarterly",lag:"3-12 months",coverage:"54",api:"yes",
    use_case: "External vulnerability, twin deficit analysis", phase: 1,
  },
  {
    id: "fdi_inflows",        theme: "external", category: "Balance of Payments",
    name_en: "FDI Net Inflows (USD, % GDP)",      name_fr: "IDE nets entrants (% PIB)",
    source_primary: "UNCTAD World Investment Report",sources_secondary:["IMF BOP","World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "FDI tracker, investment climate dashboard", phase: 1,
  },
  {
    id: "remittances",        theme: "external", category: "Balance of Payments",
    name_en: "Personal Remittances (USD, % GDP)", name_fr: "Envois de fonds (% PIB)",
    source_primary: "World Bank Remittance Data", sources_secondary: ["IMF BOP", "KNOMAD"],
    frequency: "Annual/Quarterly",lag:"3-6 months",coverage:"54",api:"yes",
    use_case: "Remittance flow tracker, diaspora finance", phase: 1,
  },
  {
    id: "exchange_rate",      theme: "external", category: "Exchange Rate",
    name_en: "Official Exchange Rate (LCU per USD)",name_fr: "Taux de change officiel",
    source_primary: "IMF IFS",                   sources_secondary: ["World Bank WDI", "Central banks"],
    frequency: "Daily/Monthly",lag:"Real-time",  coverage: "54", api: "yes",
    use_case: "FX dashboard, currency risk tracker", phase: 1,
  },
  {
    id: "reer",               theme: "external", category: "Exchange Rate",
    name_en: "Real Effective Exchange Rate (REER)",name_fr: "Taux de change effectif réel (TCER)",
    source_primary: "IMF IFS/BIS",               sources_secondary: ["World Bank WDI"],
    frequency: "Monthly",  lag: "1-2 months",    coverage: "~45", api: "yes",
    use_case: "Competitiveness analysis, misalignment detection", phase: 2,
  },
  {
    id: "fx_reserves",        theme: "external", category: "Exchange Rate",
    name_en: "Foreign Exchange Reserves (USD, Months of Imports)",name_fr: "Réserves de change (mois d'importations)",
    source_primary: "IMF IFS",                   sources_secondary: ["Central banks", "World Bank WDI"],
    frequency: "Monthly",  lag: "1-2 months",    coverage: "54", api: "yes",
    use_case: "Reserve adequacy tracker, external buffer analysis", phase: 1,
  },
  {
    id: "commodity_prices",   theme: "external", category: "Commodities",
    name_en: "Key Commodity Prices (Oil, Gold, Cocoa, Coffee, Cotton, Copper)",name_fr: "Prix des matières premières clés",
    source_primary: "World Bank Pink Sheet",      sources_secondary: ["IMF Primary Commodity Prices", "Bloomberg"],
    frequency: "Monthly",  lag: "Real-time",     coverage: "Global", api: "yes",
    use_case: "Commodity dashboard, terms-of-trade impact analysis", phase: 1,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. Secteur financier (17 indicateurs)
// ─────────────────────────────────────────────────────────────────────────────
const FINANCIAL: IndicatorDef[] = [
  {
    id: "policy_rate",        theme: "financial", category: "Monetary Policy",
    name_en: "Central Bank Policy Interest Rate", name_fr: "Taux directeur de la banque centrale",
    source_primary: "Central Banks",             sources_secondary: ["IMF IFS", "BCEAO", "BEAC", "BIS"],
    frequency: "Event-driven",lag:"Real-time",   coverage: "54", api: "partial",
    use_case: "Monetary policy tracker, MPC decision timeline", phase: 2,
  },
  {
    id: "money_supply",       theme: "financial", category: "Monetary Policy",
    name_en: "Broad Money (M2/M3) Growth",        name_fr: "Masse monétaire (M2/M3) croissance",
    source_primary: "IMF IFS",                   sources_secondary: ["Central banks", "BCEAO", "BEAC"],
    frequency: "Monthly",  lag: "1-3 months",    coverage: "54", api: "yes",
    use_case: "Money supply tracker, monetization analysis", phase: 2,
  },
  {
    id: "credit_private_sector",theme:"financial",category:"Monetary Policy",
    name_en: "Credit to Private Sector (% GDP, Growth)",name_fr: "Crédit au secteur privé",
    source_primary: "IMF IFS",                   sources_secondary: ["World Bank WDI", "Central banks"],
    frequency: "Monthly/Quarterly",lag:"1-3 months",coverage:"54",api:"yes",
    use_case: "Credit growth dashboard, financial deepening", phase: 2,
  },
  {
    id: "bank_fsi",           theme: "financial", category: "Banking Sector",
    name_en: "Financial Soundness Indicators (CAR, NPL, ROA, ROE, Liquidity)",name_fr: "Indicateurs de solidité financière (ISF)",
    source_primary: "IMF FSI Database",          sources_secondary: ["Central banks", "World Bank GFDD"],
    frequency: "Quarterly/Annual",lag:"3-6 months",coverage:"~40",api:"yes",
    use_case: "Banking health dashboard, NPL heatmap, systemic risk", phase: 2,
  },
  {
    id: "bank_assets",        theme: "financial", category: "Banking Sector",
    name_en: "Total Banking Assets, Deposits, Loans",name_fr: "Actifs, dépôts et crédits bancaires",
    source_primary: "Central Banks",             sources_secondary: ["IMF IFS", "BankFocus"],
    frequency: "Quarterly/Annual",lag:"3-6 months",coverage:"~40",api:"partial",
    use_case: "Banking sector depth analysis", phase: 2,
  },
  {
    id: "interest_rates",     theme: "financial", category: "Banking Sector",
    name_en: "Lending Rate, Deposit Rate, Interest Spread",name_fr: "Taux prêteurs, taux dépôts, marge",
    source_primary: "IMF IFS",                   sources_secondary: ["Central banks"],
    frequency: "Monthly/Quarterly",lag:"1-3 months",coverage:"~45",api:"yes",
    use_case: "Interest rate spread analysis, monetary transmission", phase: 2,
  },
  {
    id: "financial_inclusion",theme: "financial", category: "Banking Sector",
    name_en: "Financial Inclusion (Account Ownership, Mobile Money, ATM Density)",name_fr: "Inclusion financière",
    source_primary: "World Bank Global Findex",  sources_secondary: ["GSMA", "FinMark Trust"],
    frequency: "Triennial (Findex)",lag:"1-2 years",coverage:"54",api:"yes",
    use_case: "Financial inclusion dashboard, mobile money penetration", phase: 2,
  },
  {
    id: "stock_market",       theme: "financial", category: "Capital Markets",
    name_en: "Stock Market Indices (JSE, NSE, BRVM, GSE, EGX…)",name_fr: "Indices boursiers africains",
    source_primary: "Stock Exchanges",           sources_secondary: ["Bloomberg", "LSEG"],
    frequency: "Daily",    lag: "Real-time",     coverage: "~25 exchanges", api: "paid",
    use_case: "Equity market dashboard, sector performance", phase: 3,
  },
  {
    id: "gov_bond_yields",    theme: "financial", category: "Capital Markets",
    name_en: "Government Bond Yields (local & Eurobond)",name_fr: "Rendements obligataires souverains",
    source_primary: "Bloomberg / LSEG",          sources_secondary: ["DMOs", "BRVM"],
    frequency: "Daily",    lag: "Real-time",     coverage: "~30", api: "paid",
    use_case: "Sovereign spread analysis, eurobond tracker", phase: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mines & Extractifs (9 indicateurs)
// ─────────────────────────────────────────────────────────────────────────────
const MINING: IndicatorDef[] = [
  {
    id: "mineral_production", theme: "mining", category: "Production",
    name_en: "Mineral Production (Gold, Copper, Cobalt, Lithium…)",name_fr: "Production minière",
    source_primary: "USGS Mineral Commodity Summaries",sources_secondary:["BGS","S&P Global"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "~30 producers", api: "partial",
    use_case: "Mining production dashboard, country mineral profiles", phase: 3,
  },
  {
    id: "oil_gas_production", theme: "mining", category: "Production",
    name_en: "Oil & Gas Production (bpd, bcf)",   name_fr: "Production pétrolière et gazière",
    source_primary: "EIA / OPEC / IEA",           sources_secondary: ["National oil companies"],
    frequency: "Monthly/Annual",lag:"1-3 months", coverage: "~15", api: "yes",
    use_case: "Oil production tracker, OPEC quota compliance", phase: 3,
  },
  {
    id: "extractive_revenue", theme: "mining", category: "Revenue",
    name_en: "Government Revenue from Extractives (% Total Revenue)",name_fr: "Revenus extractifs (% recettes totales)",
    source_primary: "EITI Reports",              sources_secondary: ["IMF GFS"],
    frequency: "Annual",   lag: "12-24 months",  coverage: "~25 EITI", api: "partial",
    use_case: "Resource revenue dependency, resource curse analysis", phase: 3,
  },
  {
    id: "resource_governance",theme: "mining", category: "Governance",
    name_en: "Resource Governance Index (NRGI)",  name_fr: "Index de gouvernance des ressources (NRGI)",
    source_primary: "NRGI",                       sources_secondary: [],
    frequency: "Biennial",  lag: "N/A",           coverage: "~30", api: "yes",
    use_case: "Governance quality dashboard, reform progress", phase: 3,
  },
  {
    id: "critical_minerals",  theme: "mining", category: "Critical Minerals",
    name_en: "Critical Minerals Reserves (Lithium, Cobalt, REEs, Graphite)",name_fr: "Minéraux critiques (réserves)",
    source_primary: "USGS / BGS",                sources_secondary: ["National geological surveys"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "~20", api: "partial",
    use_case: "Critical minerals dashboard, energy transition supply chain", phase: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. Climat & Environnement (16 indicateurs)
// ─────────────────────────────────────────────────────────────────────────────
const CLIMATE: IndicatorDef[] = [
  {
    id: "ghg_emissions",      theme: "climate", category: "Emissions",
    name_en: "Total GHG Emissions (CO2e by Sector)",name_fr: "Émissions GES totales par secteur",
    source_primary: "UNFCCC / Climate Watch (WRI)",sources_secondary:["World Bank WDI","EDGAR"],
    frequency: "Annual",   lag: "1-2 years",     coverage: "54", api: "yes",
    use_case: "Emissions tracker, sector decomposition, per-capita comparison", phase: 2,
  },
  {
    id: "energy_co2",         theme: "climate", category: "Emissions",
    name_en: "Energy-related CO2 Emissions",       name_fr: "Émissions CO2 liées à l'énergie",
    source_primary: "IEA / Global Carbon Project",sources_secondary:["World Bank WDI"],
    frequency: "Annual",   lag: "1-2 years",     coverage: "54", api: "partial",
    use_case: "Energy transition analysis, decarbonization pathway", phase: 2,
  },
  {
    id: "ndc_targets",        theme: "climate", category: "NDCs & Policy",
    name_en: "NDC Targets and Implementation Progress",name_fr: "Objectifs NDC et avancement",
    source_primary: "UNFCCC NDC Registry",        sources_secondary: ["Climate Action Tracker"],
    frequency: "Updated with submissions",lag:"N/A",coverage:"54",api:"yes",
    use_case: "NDC tracker dashboard, commitment vs action gap", phase: 2,
  },
  {
    id: "climate_finance",    theme: "climate", category: "Climate Finance",
    name_en: "Climate Finance Flows to Africa",    name_fr: "Flux de finance climatique vers l'Afrique",
    source_primary: "Climate Policy Initiative",  sources_secondary: ["OECD DAC", "GCF", "AfDB"],
    frequency: "Annual",   lag: "12-18 months",  coverage: "54 (aggregate)", api: "partial",
    use_case: "Climate finance gap analysis, adaptation vs mitigation split", phase: 2,
  },
  {
    id: "green_bonds",        theme: "climate", category: "Climate Finance",
    name_en: "Sovereign & Corporate Green Bond Issuance",name_fr: "Émissions d'obligations vertes",
    source_primary: "Climate Bonds Initiative",   sources_secondary: ["AfDB", "Bloomberg NEF"],
    frequency: "Quarterly/Annual",lag:"1-3 months",coverage:"~10 issuers",api:"partial",
    use_case: "Green bond tracker, sustainable finance pipeline", phase: 3,
  },
  {
    id: "climate_vulnerability",theme:"climate",category:"Physical Risk",
    name_en: "ND-GAIN Climate Vulnerability & Readiness Index",name_fr: "Indice de vulnérabilité climatique (ND-GAIN)",
    source_primary: "Notre Dame Global Adaptation Initiative",sources_secondary:["Germanwatch CRI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Climate vulnerability dashboard, adaptation priority ranking", phase: 2,
  },
  {
    id: "renewable_energy",   theme: "climate", category: "Energy Transition",
    name_en: "Renewable Energy Share (% Total Energy Mix)",name_fr: "Part des énergies renouvelables",
    source_primary: "IRENA",                     sources_secondary: ["IEA", "World Bank WDI"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Energy transition tracker, renewable capacity analysis", phase: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 7. Social & Gouvernance (20 indicateurs — sélection représentative)
// ─────────────────────────────────────────────────────────────────────────────
const SOCIAL: IndicatorDef[] = [
  {
    id: "poverty_headcount",  theme: "social", category: "Poverty & Inequality",
    name_en: "Poverty Headcount Ratio ($2.15/day)",name_fr: "Taux de pauvreté (2,15 $/jour)",
    source_primary: "World Bank PIP",            sources_secondary: ["National household surveys"],
    frequency: "Irregular (survey years)",lag:"1-3 years",coverage:"~45",api:"yes",
    use_case: "Poverty dashboard, distributional impact analysis", phase: 2,
  },
  {
    id: "gini",               theme: "social", category: "Poverty & Inequality",
    name_en: "Gini Coefficient (Income Inequality)",name_fr: "Coefficient de Gini (inégalités)",
    source_primary: "World Bank PIP",            sources_secondary: ["UNDP HDR", "WIDER WIID"],
    frequency: "Irregular", lag: "1-3 years",    coverage: "~40", api: "yes",
    use_case: "Inequality tracker, shared prosperity analysis", phase: 2,
  },
  {
    id: "hdi",                theme: "social", category: "Human Development",
    name_en: "Human Development Index (HDI)",     name_fr: "Indice de développement humain (IDH)",
    source_primary: "UNDP HDR",                  sources_secondary: [],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "HDI dashboard, regional comparison", phase: 2,
  },
  {
    id: "governance_wgi",     theme: "social", category: "Governance",
    name_en: "Worldwide Governance Indicators (WGI) — 6 dimensions",name_fr: "Indicateurs de gouvernance WGI",
    source_primary: "World Bank WGI",            sources_secondary: ["Mo Ibrahim Foundation"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Governance quality tracker, rule of law analysis", phase: 2,
  },
  {
    id: "conflict_acled",     theme: "social", category: "Governance",
    name_en: "Conflict Events & Fatalities (ACLED)",name_fr: "Conflits et violence politique (ACLED)",
    source_primary: "ACLED",                     sources_secondary: ["Armed Conflict Dataset"],
    frequency: "Weekly",   lag: "Real-time",     coverage: "54", api: "yes",
    use_case: "Political risk dashboard, conflict heatmap, investor alert", phase: 2,
  },
  {
    id: "ibrahim_index",      theme: "social", category: "Governance",
    name_en: "Mo Ibrahim Index of African Governance",name_fr: "Index Mo Ibrahim de gouvernance africaine",
    source_primary: "Mo Ibrahim Foundation",     sources_secondary: [],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "African governance benchmark, trend analysis", phase: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 8. Secteur privé & Investissement (sélection)
// ─────────────────────────────────────────────────────────────────────────────
const PRIVATE: IndicatorDef[] = [
  {
    id: "vc_funding",         theme: "private", category: "Startup & VC Ecosystem",
    name_en: "Venture Capital Deals & Funding (Africa)",name_fr: "Capital-risque (deals & montants)",
    source_primary: "Partech Africa / Africa: The Big Deal",sources_secondary:["Briter Bridges","Disrupt Africa"],
    frequency: "Quarterly/Annual",lag:"1-4 weeks",coverage:"54 (major deals)",api:"partial",
    use_case: "VC deal flow dashboard, sector funding heatmap", phase: 3,
  },
  {
    id: "pe_deal_activity",   theme: "private", category: "Private Equity",
    name_en: "Private Equity Transactions (Africa)",name_fr: "Transactions de capital-investissement",
    source_primary: "AVCA",                      sources_secondary: ["Preqin", "PitchBook"],
    frequency: "Quarterly/Annual",lag:"1-3 months",coverage:"~25",api:"paid",
    use_case: "PE deal flow dashboard, sector allocation", phase: 3,
  },
  {
    id: "dfi_investment",     theme: "private", category: "Private Equity",
    name_en: "DFI Investment Activity (IFC, AfDB, CDC/BII, DEG, FMO, Proparco)",name_fr: "Investissements DFI",
    source_primary: "IFC Project Database / AfDB Project Portal",sources_secondary:["EDFI"],
    frequency: "Quarterly/Annual",lag:"1-3 months",coverage:"54",api:"partial",
    use_case: "DFI pipeline tracker, co-investment opportunity mapping", phase: 2,
  },
  {
    id: "fdi_greenfield",     theme: "private", category: "FDI & Cross-Border",
    name_en: "Greenfield FDI Projects (by Source, Sector, Destination)",name_fr: "IDE greenfield par secteur et origine",
    source_primary: "fDi Intelligence (Financial Times)",sources_secondary:["UNCTAD WIR"],
    frequency: "Quarterly", lag: "1-3 months",   coverage: "54", api: "paid",
    use_case: "Greenfield FDI tracker, source country heatmap", phase: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 9. Commerce & Intégration régionale (sélection)
// ─────────────────────────────────────────────────────────────────────────────
const TRADE: IndicatorDef[] = [
  {
    id: "afcfta_tariff",      theme: "trade", category: "AfCFTA",
    name_en: "AfCFTA Tariff Liberalization Schedule",name_fr: "Calendrier de libéralisation tarifaire AfCFTA",
    source_primary: "AfCFTA Secretariat",        sources_secondary: ["UNCTAD", "WTO", "Tralac"],
    frequency: "Updated with protocol",lag:"N/A",coverage:"54",api:"no",
    use_case: "AfCFTA implementation tracker, tariff reduction timeline", phase: 3,
  },
  {
    id: "ntb_reporting",      theme: "trade", category: "AfCFTA",
    name_en: "Non-Tariff Barriers (NTB) Reporting",name_fr: "Barrières non tarifaires (BNT)",
    source_primary: "AU/AfCFTA NTB Mechanism",   sources_secondary: ["Tralac", "UNCTAD"],
    frequency: "Event-driven",lag:"Real-time",   coverage: "54", api: "partial",
    use_case: "NTB tracker, trade friction analysis", phase: 3,
  },
  {
    id: "intra_african_trade",theme: "trade", category: "AfCFTA",
    name_en: "Intra-African Trade Volumes",        name_fr: "Commerce intra-africain",
    source_primary: "UNCTAD / UN Comtrade",       sources_secondary: ["AfDB", "Afreximbank"],
    frequency: "Annual",   lag: "6-12 months",   coverage: "54", api: "yes",
    use_case: "Intra-African trade dashboard, integration progress", phase: 2,
  },
  {
    id: "waemu_convergence",  theme: "trade", category: "Regional Economic Communities",
    name_en: "WAEMU Convergence Criteria Compliance",name_fr: "Critères de convergence UEMOA",
    source_primary: "BCEAO / WAEMU Commission",   sources_secondary: ["IMF WAEMU Staff Report"],
    frequency: "Semi-annual/Annual",lag:"3-6 months",coverage:"8",api:"partial",
    use_case: "WAEMU convergence dashboard, monetary union health", phase: 2,
  },
  {
    id: "cemac_convergence",  theme: "trade", category: "Regional Economic Communities",
    name_en: "CEMAC Convergence Criteria Compliance",name_fr: "Critères de convergence CEMAC",
    source_primary: "BEAC / CEMAC Commission",    sources_secondary: ["IMF CEMAC Staff Report"],
    frequency: "Semi-annual/Annual",lag:"3-6 months",coverage:"6",api:"partial",
    use_case: "CEMAC convergence dashboard", phase: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue complet
// ─────────────────────────────────────────────────────────────────────────────
export const INDICATOR_CATALOG: IndicatorDef[] = [
  ...REAL_SECTOR,
  ...FISCAL_DEBT,
  ...EXTERNAL,
  ...FINANCIAL,
  ...MINING,
  ...CLIMATE,
  ...SOCIAL,
  ...PRIVATE,
  ...TRADE,
];

/** Indicateurs disponibles dans la Phase 1 (IMF WEO / World Bank WDI) */
export const PHASE1_INDICATORS = INDICATOR_CATALOG.filter((i) => i.phase === 1);

/** Catalogue indexé par id */
export const CATALOG_BY_ID = Object.fromEntries(
  INDICATOR_CATALOG.map((i) => [i.id, i])
) as Record<string, IndicatorDef>;

/** Catalogue groupé par thème */
export const CATALOG_BY_THEME = INDICATOR_CATALOG.reduce<Record<ThemeId, IndicatorDef[]>>(
  (acc, ind) => {
    if (!acc[ind.theme]) acc[ind.theme] = [];
    acc[ind.theme].push(ind);
    return acc;
  },
  {} as Record<ThemeId, IndicatorDef[]>
);
