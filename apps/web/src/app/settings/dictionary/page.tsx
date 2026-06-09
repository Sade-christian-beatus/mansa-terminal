"use client";

import { useState, useMemo } from "react";
import { BookOpen, Search, ChevronRight, TrendingUp, BarChart2, DollarSign, Percent, Globe2, Zap, Shield, ArrowUpDown } from "lucide-react";
import { useLangStore } from "@/lib/lang-store";

// ── Types ────────────────────────────────────────────────────────────────────
type DictCategory = "croissance" | "inflation" | "dette" | "fiscal" | "commerce" | "monnaie" | "esg" | "investissement";

interface DictEntry {
  id: string;
  term: string;
  termEn: string;
  definition: string;
  formula?: string;
  example?: string;
  category: DictCategory;
  relatedTerms?: string[];
}

// ── Données ──────────────────────────────────────────────────────────────────
const DICTIONARY: DictEntry[] = [
  {
    id: "pib",
    term: "PIB — Produit Intérieur Brut",
    termEn: "GDP — Gross Domestic Product",
    definition: "Valeur totale de tous les biens et services produits dans un pays au cours d'une période donnée (généralement une année). C'est la mesure la plus utilisée pour évaluer la taille d'une économie.",
    formula: "PIB = C + I + G + (X - M)  [C : Consommation, I : Investissement, G : Dépenses publiques, X-M : Balance commerciale]",
    example: "Le PIB du Nigeria est d'environ 477 Mds USD en 2024, faisant de lui la plus grande économie d'Afrique.",
    category: "croissance",
    relatedTerms: ["Croissance du PIB", "PIB par habitant", "PIB nominal", "PIB PPA"],
  },
  {
    id: "croissance_pib",
    term: "Croissance du PIB réel",
    termEn: "Real GDP Growth",
    definition: "Variation annuelle du PIB après correction de l'inflation (déflateur du PIB). Mesure la croissance effective de l'activité économique, indépendamment des variations de prix.",
    formula: "Croissance réelle = ((PIB réel t - PIB réel t-1) / PIB réel t-1) × 100",
    example: "L'Éthiopie affiche une croissance du PIB réel de 6,8% en 2024, l'une des plus élevées du continent.",
    category: "croissance",
    relatedTerms: ["PIB", "Déflateur du PIB", "Croissance potentielle"],
  },
  {
    id: "pib_habitant",
    term: "PIB par habitant",
    termEn: "GDP per Capita",
    definition: "PIB total divisé par la population du pays. Indicateur approximatif du niveau de vie moyen, souvent exprimé en dollars US ou en parité de pouvoir d'achat (PPA).",
    formula: "PIB par habitant = PIB total / Population",
    example: "Les Seychelles ont le PIB par habitant le plus élevé d'Afrique (~16 000 USD), tandis que le Burundi (~230 USD) est parmi les plus bas.",
    category: "croissance",
    relatedTerms: ["PIB", "Parité de pouvoir d'achat", "Indice de développement humain"],
  },
  {
    id: "inflation",
    term: "Inflation (IPC)",
    termEn: "Inflation (CPI)",
    definition: "Hausse générale et durable du niveau des prix dans une économie, mesurée par l'Indice des Prix à la Consommation (IPC). Elle érode le pouvoir d'achat des ménages et la compétitivité des exportations.",
    formula: "Taux d'inflation = ((IPC t - IPC t-1) / IPC t-1) × 100",
    example: "Le Zimbabwe a connu une hyperinflation dépassant 500% en 2020, tandis que le Maroc maintient une inflation sous 4%.",
    category: "inflation",
    relatedTerms: ["IPC", "Déflation", "Stagflation", "Taux directeur", "Politique monétaire"],
  },
  {
    id: "taux_directeur",
    term: "Taux directeur",
    termEn: "Policy Rate / Key Interest Rate",
    definition: "Taux d'intérêt fixé par la banque centrale pour réguler l'inflation et la croissance économique. Un taux élevé freine le crédit et l'inflation ; un taux bas stimule l'investissement.",
    example: "La CBN (Nigeria) a relevé son taux à 26,25% en 2024 pour lutter contre une inflation de 33%. La BCEAO maintient son taux à 3,5% pour soutenir la zone UEMOA.",
    category: "monnaie",
    relatedTerms: ["Inflation", "Politique monétaire", "BCEAO", "BEAC", "Crédit bancaire"],
  },
  {
    id: "dette_publique",
    term: "Dette publique (% du PIB)",
    termEn: "Public Debt (% of GDP)",
    definition: "Ensemble des emprunts contractés par l'État, exprimé en pourcentage du PIB. Mesure la soutenabilité de la dette publique. Le seuil de 60% est souvent cité comme limite dans les critères de convergence africains.",
    formula: "Ratio dette/PIB = (Stock de dette publique / PIB) × 100",
    example: "Le Mozambique affiche une dette publique de 100% du PIB, exposant le pays à un risque de surendettement élevé selon le FMI.",
    category: "dette",
    relatedTerms: ["Service de la dette", "Soutenabilité de la dette", "Restructuration", "Eurobonds"],
  },
  {
    id: "service_dette",
    term: "Service de la dette",
    termEn: "Debt Service",
    definition: "Somme des remboursements du principal et des paiements d'intérêts sur la dette publique au cours d'une période donnée. Un service de la dette élevé laisse moins de marges pour les dépenses sociales.",
    formula: "Service de la dette = Remboursements capital + Intérêts payés",
    example: "En 2024, plusieurs pays africains consacrent plus de 20% de leurs recettes fiscales au service de la dette, dont le Ghana (56%), le Kenya (38%).",
    category: "dette",
    relatedTerms: ["Dette publique", "Taux d'intérêt", "Restructuration de dette"],
  },
  {
    id: "solde_budgetaire",
    term: "Solde budgétaire (% du PIB)",
    termEn: "Fiscal Balance (% of GDP)",
    definition: "Différence entre les recettes et les dépenses de l'État. Un déficit (solde négatif) signifie que l'État dépense plus qu'il ne reçoit et doit s'endetter pour financer la différence.",
    formula: "Solde budgétaire = Recettes totales - Dépenses totales (en % du PIB)",
    example: "Le critère de convergence UEMOA impose un déficit budgétaire inférieur à 3% du PIB. La Côte d'Ivoire cible -3,2% en 2025.",
    category: "fiscal",
    relatedTerms: ["Recettes fiscales", "Dépenses publiques", "Dette publique", "Politique budgétaire"],
  },
  {
    id: "compte_courant",
    term: "Solde du compte courant",
    termEn: "Current Account Balance",
    definition: "Mesure la différence entre les recettes et les dépenses d'un pays vis-à-vis du reste du monde, incluant le commerce de biens, de services, les revenus et les transferts courants.",
    formula: "CA = Balance commerciale + Services + Revenus primaires + Transferts courants",
    example: "L'Afrique du Sud affiche un déficit courant chronique d'environ -2% du PIB, financé par des entrées de capitaux étrangers.",
    category: "commerce",
    relatedTerms: ["Balance commerciale", "IDE", "Réserves de change", "Taux de change"],
  },
  {
    id: "reserves_change",
    term: "Réserves de change",
    termEn: "Foreign Exchange Reserves",
    definition: "Actifs en devises étrangères détenus par une banque centrale pour stabiliser le taux de change, rembourser la dette externe et assurer les importations. Conventionnellement exprimées en mois d'importations.",
    example: "L'Algérie dispose de ~60 Mds USD de réserves (~15 mois d'importations). La Zambie n'en a que ~2,4 Mds USD (~2,3 mois), situation jugée insuffisante par le FMI.",
    category: "monnaie",
    relatedTerms: ["Taux de change", "Compte courant", "Balance des paiements"],
  },
  {
    id: "ide",
    term: "IDE — Investissements Directs Étrangers",
    termEn: "FDI — Foreign Direct Investment",
    definition: "Investissements réalisés par des entités étrangères dans une économie, impliquant une participation durable dans une entreprise locale (généralement au moins 10% du capital). Vecteur clé de transfert technologique et de création d'emplois.",
    example: "L'Éthiopie a attiré 3,7 Mds USD d'IDE en 2024, notamment grâce aux zones industrielles dédiées aux industries légères.",
    category: "investissement",
    relatedTerms: ["Compte courant", "Investissement de portefeuille", "Zone économique spéciale"],
  },
  {
    id: "esg",
    term: "ESG — Environnement, Social, Gouvernance",
    termEn: "ESG — Environmental, Social, Governance",
    definition: "Cadre d'évaluation des risques et opportunités non financiers d'une entité (pays ou entreprise). Les critères environnementaux évaluent l'impact climatique, les critères sociaux mesurent le capital humain, et la gouvernance évalue les institutions et la transparence.",
    example: "Le Rwanda obtient régulièrement les meilleures notes ESG d'Afrique sub-saharienne, notamment sur la gouvernance (G) et la gestion environnementale (E).",
    category: "esg",
    relatedTerms: ["Risque souverain", "Obligations vertes", "Indice de gouvernance", "Climat"],
  },
  {
    id: "ppa",
    term: "Parité de Pouvoir d'Achat (PPA)",
    termEn: "Purchasing Power Parity (PPP)",
    definition: "Taux de change théorique permettant de comparer les niveaux de vie entre pays en tenant compte des différences de coût de la vie. Le PIB en PPA donne une image plus juste du niveau de bien-être réel que le PIB au taux de change nominal.",
    example: "En PIB PPA, la Chine dépasse les États-Unis. En Afrique, l'Égypte a un PIB PPA supérieur à sa part en USD, car le coût de la vie y est plus bas.",
    category: "croissance",
    relatedTerms: ["PIB", "Taux de change", "Indice Big Mac"],
  },
  {
    id: "eurobonds",
    term: "Eurobonds souverains africains",
    termEn: "African Sovereign Eurobonds",
    definition: "Obligations émises par des États africains libellées en devises étrangères (généralement USD ou EUR) sur les marchés internationaux. Permettent de lever des capitaux mais exposent à un risque de change et de refinancement.",
    example: "En 2024, le Kenya a émis un Eurobond à 10 ans de 1,5 Mds USD à un taux d'intérêt de 10,375%, reflétant la prime de risque élevée perçue par les marchés.",
    category: "dette",
    relatedTerms: ["Dette publique", "Service de la dette", "Spread souverain", "Notation de crédit"],
  },
  {
    id: "croissance_inclusive",
    term: "Croissance inclusive",
    termEn: "Inclusive Growth",
    definition: "Croissance économique qui profite à l'ensemble de la population, en réduisant les inégalités et en élargissant l'accès aux opportunités économiques. Concept central dans les stratégies de développement de la Banque Mondiale et de l'UA.",
    example: "Le Rwanda est cité comme exemple de croissance inclusive : malgré un PIB modeste, la pauvreté a chuté de 77% (2001) à 38% (2024) grâce à des politiques redistributives.",
    category: "croissance",
    relatedTerms: ["Coefficient de Gini", "IDH", "Pauvreté multidimensionnelle", "Capital humain"],
  },
];

const CATEGORIES: { key: DictCategory | "all"; label: string; icon: React.ElementType; color: string }[] = [
  { key: "all",          label: "Tous",          icon: BookOpen,    color: "var(--mansa-green)" },
  { key: "croissance",   label: "Croissance",    icon: TrendingUp,  color: "#00D4AA" },
  { key: "inflation",    label: "Inflation",     icon: Percent,     color: "#F59E0B" },
  { key: "dette",        label: "Dette",         icon: BarChart2,   color: "#EF4444" },
  { key: "fiscal",       label: "Fiscal",        icon: DollarSign,  color: "#8B5CF6" },
  { key: "commerce",     label: "Commerce",      icon: Globe2,      color: "#3B82F6" },
  { key: "monnaie",      label: "Monnaie",       icon: ArrowUpDown, color: "#EC4899" },
  { key: "esg",          label: "ESG",           icon: Shield,      color: "#10B981" },
  { key: "investissement", label: "Investissement", icon: Zap,      color: "#F97316" },
];

const CATEGORY_COLORS: Record<DictCategory, string> = {
  croissance:    "#00D4AA",
  inflation:     "#F59E0B",
  dette:         "#EF4444",
  fiscal:        "#8B5CF6",
  commerce:      "#3B82F6",
  monnaie:       "#EC4899",
  esg:           "#10B981",
  investissement:"#F97316",
};

// ── Composant entrée ─────────────────────────────────────────────────────────
function DictCard({ entry }: { entry: DictEntry }) {
  const [open, setOpen] = useState(false);
  const catColor = CATEGORY_COLORS[entry.category];

  return (
    <div
      className="rounded-xl border transition-all duration-200 overflow-hidden"
      style={{ background: "var(--card-bg)", borderColor: open ? `color-mix(in srgb, ${catColor} 40%, var(--bg-border))` : "var(--bg-border)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
      >
        <div
          className="w-1.5 h-6 rounded-full flex-shrink-0"
          style={{ background: catColor }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{entry.term}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{entry.termEn}</p>
        </div>
        <ChevronRight
          size={14}
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid var(--bg-border)`, paddingTop: 12 }}>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {entry.definition}
          </p>

          {entry.formula && (
            <div
              className="rounded-lg px-3 py-2 font-mono text-xs"
              style={{ background: "var(--input-bg)", color: "var(--mansa-green)", border: "1px solid var(--input-border)" }}
            >
              {entry.formula}
            </div>
          )}

          {entry.example && (
            <div
              className="rounded-lg px-3 py-2 text-xs leading-relaxed"
              style={{ background: `color-mix(in srgb, ${catColor} 6%, transparent)`, color: "var(--text-secondary)", borderLeft: `3px solid ${catColor}` }}
            >
              <span className="font-semibold" style={{ color: catColor }}>Exemple · </span>
              {entry.example}
            </div>
          )}

          {entry.relatedTerms && entry.relatedTerms.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Voir aussi :</span>
              {entry.relatedTerms.map((rt) => (
                <span
                  key={rt}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "var(--bg-border)", color: "var(--text-secondary)" }}
                >
                  {rt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function DictionaryPage() {
  const locale = useLangStore((s) => s.locale);
  const [activeCategory, setActiveCategory] = useState<DictCategory | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = DICTIONARY;
    if (activeCategory !== "all") list = list.filter((e) => e.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.term.toLowerCase().includes(q) ||
          e.termEn.toLowerCase().includes(q) ||
          e.definition.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.term.localeCompare(b.term));
  }, [activeCategory, search]);

  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--bg-primary)" }}>
      {/* ── En-tête ── */}
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: "var(--bg-border)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)" }}
            >
              <BookOpen size={18} style={{ color: "var(--mansa-green)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {locale === "fr" ? "Dictionnaire Économique" : "Economic Dictionary"}
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {locale === "fr"
                  ? `${DICTIONARY.length} termes · Macro, fiscalité, dette, ESG, investissement`
                  : `${DICTIONARY.length} terms · Macro, fiscal, debt, ESG, investment`}
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 w-72"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)" }}
          >
            <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "fr" ? "Rechercher un terme..." : "Search a term..."}
              className="bg-transparent text-sm focus:outline-none w-full"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.key;
            const count = cat.key === "all" ? DICTIONARY.length : DICTIONARY.filter((e) => e.category === cat.key).length;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={{
                  background: active ? `color-mix(in srgb, ${cat.color} 15%, transparent)` : "var(--input-bg)",
                  color: active ? cat.color : "var(--text-muted)",
                  border: active ? `1px solid color-mix(in srgb, ${cat.color} 40%, transparent)` : "1px solid var(--input-border)",
                }}
              >
                <Icon size={12} />
                {cat.label}
                <span
                  className="ml-0.5 text-[10px] px-1 py-0.5 rounded-full"
                  style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenu ── */}
      <div className="flex-1 px-8 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen size={48} style={{ color: "var(--text-muted)", marginBottom: 16, opacity: 0.4 }} />
            <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>
              {locale === "fr" ? "Aucun terme trouvé" : "No term found"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl">
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {filtered.length} {locale === "fr" ? "terme(s) · Cliquez sur un terme pour voir sa définition" : "term(s) · Click a term to expand"}
            </p>
            {filtered.map((entry) => (
              <DictCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
