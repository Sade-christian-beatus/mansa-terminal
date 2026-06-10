"use client";

import { useState, useMemo } from "react";
import {
  Newspaper,
  Search,
  ExternalLink,
  TrendingUp,
  Globe2,
  Zap,
  CloudRain,
  BarChart2,
  Sparkles,
  Clock,
  Tag,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useLangStore } from "@/lib/lang-store";
import { useQuery } from "@tanstack/react-query";
import { newsApi } from "@/lib/api";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";

// ── Types ────────────────────────────────────────────────────────────────────
interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  aiSummary?: string;
  source: string;
  sourceUrl: string;
  date: string;
  dateRelative: string;
  category: NewsCategory;
  region: string;
  countries: string[];
  readTime: number;
  featured?: boolean;
}

type NewsCategory = "macro" | "marches" | "politique" | "climat" | "energie" | "tech";

// ── Données simulées ─────────────────────────────────────────────────────────
const ARTICLES: NewsArticle[] = [
  {
    id: 1,
    title: "Le FMI relève ses prévisions de croissance pour l'Afrique subsaharienne à 4,2% en 2025",
    summary: "Le Fonds Monétaire International a publié ses nouvelles projections économiques pour le continent africain, soulignant une reprise soutenue portée par la hausse des prix des matières premières et les réformes structurelles engagées dans plusieurs pays.",
    aiSummary: "📊 Points clés : La croissance africaine dépasse la moyenne mondiale (+3,2%). Moteurs : Éthiopie (+6,8%), Sénégal (+8,1%), Côte d'Ivoire (+6,3%). Risques : inflation persistante, dette publique élevée dans 12 pays. Recommandations FMI : consolidation budgétaire + diversification fiscale.",
    source: "FMI — World Economic Outlook",
    sourceUrl: "https://imf.org",
    date: "2025-06-08",
    dateRelative: "Il y a 1 jour",
    category: "macro",
    region: "Afrique",
    countries: ["🌍"],
    readTime: 5,
    featured: true,
  },
  {
    id: 2,
    title: "AfCFTA : Le volume des échanges intra-africains progresse de 18% au premier trimestre 2025",
    summary: "La Zone de libre-échange continentale africaine continue de porter ses fruits. Les données douanières agrégées font état d'une progression significative des flux commerciaux entre pays membres, portée notamment par les corridors Afrique de l'Ouest–Afrique de l'Est.",
    aiSummary: "🔗 AfCFTA Q1 2025 : Volume total 142 Mds USD (+18% y/y). Corridors les plus actifs : Lagos-Nairobi, Abidjan-Dakar, Casablanca-Tunis. Secteurs en tête : agriculture transformée (+31%), textiles (+24%), services financiers (+19%). Obstacle principal : non-harmonisation des règlements douaniers.",
    source: "UA — Commission Économique",
    sourceUrl: "https://au.int",
    date: "2025-06-07",
    dateRelative: "Il y a 2 jours",
    category: "marches",
    region: "Afrique",
    countries: ["🌍"],
    readTime: 4,
    featured: true,
  },
  {
    id: 3,
    title: "Sénégal : Le budget 2025 vise un déficit de 3,9% du PIB après les réformes de Faye",
    summary: "Le gouvernement de Bassirou Diomaye Faye présente un projet de loi de finances rectificative visant à ramener le déficit budgétaire sous le seuil de 4% du PIB, après les révisions à la hausse de la dette publique héritées de l'administration précédente.",
    aiSummary: "🇸🇳 Sénégal fiscal 2025 : Déficit cible 3,9% PIB (vs 7,4% réel 2024). Mesures : audit des PPP, révision des exonérations fiscales, élargissement de l'assiette TVA. Risque : dérapage en cas de retard de la production pétrolière offshore. Notation : Moody's stable B1.",
    source: "Ministère des Finances SN",
    sourceUrl: "https://finances.gouv.sn",
    date: "2025-06-06",
    dateRelative: "Il y a 3 jours",
    category: "macro",
    region: "Afrique de l'Ouest",
    countries: ["🇸🇳"],
    readTime: 6,
  },
  {
    id: 4,
    title: "Nairobi Securities Exchange : le NSE-20 franchit les 2 000 points pour la première fois depuis 2022",
    summary: "La bourse de Nairobi a atteint un nouveau sommet pluriannuel, portée par les bonnes performances du secteur bancaire et l'optimisme des investisseurs face aux réformes économiques engagées par le gouvernement Ruto.",
    aiSummary: "📈 NSE-20 : +12,3% YTD. Leaders : Equity Group (+18%), Safaricom (+9%), KCB (+15%. P/E moyen : 11.4x. Flux étrangers positifs depuis 3 semaines consécutives (+KES 2,4 Mds). Signal : momentum haussier mais RSI en zone de surachat (72).",
    source: "NSE — Nairobi Stock Exchange",
    sourceUrl: "https://nse.co.ke",
    date: "2025-06-05",
    dateRelative: "Il y a 4 jours",
    category: "marches",
    region: "Afrique de l'Est",
    countries: ["🇰🇪"],
    readTime: 3,
  },
  {
    id: 5,
    title: "Nigeria : la Banque Centrale maintient son taux directeur à 26,25% face à une inflation tenace",
    summary: "Le Comité de politique monétaire de la CBN a voté à l'unanimité le maintien du taux directeur à son niveau record, jugeant que les pressions inflationnistes restent trop importantes pour envisager un assouplissement monétaire dans l'immédiat.",
    aiSummary: "🇳🇬 CBN MPC Juin 2025 : Taux maintenu à 26,25%. Inflation : 33,1% (IPC mai). Naira : NGN 1 610/USD (stable depuis 6 semaines). Prochaine réunion : juillet. Marché : courbe des taux tétanisée, T-Bills 91j à 24,8%. Risque de dollarisation des épargnes si maintien prolongé.",
    source: "CBN — Central Bank of Nigeria",
    sourceUrl: "https://cbn.gov.ng",
    date: "2025-06-04",
    dateRelative: "Il y a 5 jours",
    category: "politique",
    region: "Afrique de l'Ouest",
    countries: ["🇳🇬"],
    readTime: 5,
  },
  {
    id: 6,
    title: "Énergie verte : 4,2 GW de nouvelles capacités renouvelables installées en Afrique au T1 2025",
    summary: "L'IRENA recense une progression historique des installations d'énergie renouvelable sur le continent africain, dominées par le solaire en Afrique du Nord et l'éolien en Afrique de l'Est.",
    aiSummary: "⚡ Renouvelables Afrique Q1 2025 : Solaire 2,8 GW (Maroc, Égypte, Afrique du Sud), Éolien 1,1 GW (Kenya, Éthiopie), Hydro 0,3 GW. Investissements : 8,4 Mds USD (+22% y/y). Top bailleurs : UAE (Masdar), France (EDF), Chine (CGPE). Défis : réseau de transport, financement en devises.",
    source: "IRENA — Agence Internationale des Énergies Renouvelables",
    sourceUrl: "https://irena.org",
    date: "2025-06-03",
    dateRelative: "Il y a 6 jours",
    category: "energie",
    region: "Afrique",
    countries: ["🌍"],
    readTime: 4,
  },
  {
    id: 7,
    title: "Sécheresse en Corne de l'Afrique : 20 millions de personnes menacées d'insécurité alimentaire",
    summary: "Le Programme Alimentaire Mondial tire la sonnette d'alarme face à la persistance d'une sécheresse sévère dans la Corne de l'Afrique. L'Éthiopie, la Somalie et Djibouti sont particulièrement touchés, avec des déficits pluviométriques cumulés sur 18 mois.",
    aiSummary: "🌡️ Sécheresse Corne de l'Afrique : SPI-12 < -2.0 dans 60% de la zone. Production céréalière Éthiopie -34% vs normale. Appel humanitaire : 2,1 Mds USD (54% financé). Impact macro : importations alimentaires +28%, pression sur réserves FX. Risque souverain rehaussé pour Éthiopie et Somalie.",
    source: "PAM — Programme Alimentaire Mondial",
    sourceUrl: "https://wfp.org",
    date: "2025-06-02",
    dateRelative: "Il y a 7 jours",
    category: "climat",
    region: "Afrique de l'Est",
    countries: ["🇪🇹", "🇸🇴"],
    readTime: 5,
  },
  {
    id: 8,
    title: "M-Pesa dépasse 65 millions d'utilisateurs actifs en Afrique — Safaricom annonce une expansion en RDC",
    summary: "Le géant kenyan des paiements mobiles confirme sa présence dans 8 pays africains et annonce son entrée imminente sur le marché congolais, fort d'un partenariat stratégique avec Vodacom DRC.",
    aiSummary: "📱 M-Pesa 2025 : 65,3M utilisateurs actifs, volume transactions 3,1 Mds USD/mois. Expansion RDC : lancement T3 2025, marché cible 25M utilisateurs (pénétration mobile 48%). Concurrent : Orange Money, Airtel Money. Modèle de revenus : commissions 1,5-2,0%, float income. Impact inclusion financière : +12% bancarisation dans les zones rurales couvertes.",
    source: "Safaricom — Communiqué de presse",
    sourceUrl: "https://safaricom.co.ke",
    date: "2025-06-01",
    dateRelative: "Il y a 8 jours",
    category: "tech",
    region: "Afrique de l'Est",
    countries: ["🇰🇪", "🇨🇩"],
    readTime: 4,
  },
];

const CATEGORIES: { key: NewsCategory | "all"; label: string; icon: React.ElementType; color: string }[] = [
  { key: "all",      label: "Toutes",       icon: Globe2,     color: "var(--text-muted)" },
  { key: "macro",    label: "Macro",        icon: BarChart2,  color: "#00D4AA" },
  { key: "marches",  label: "Marchés",      icon: TrendingUp, color: "#3B82F6" },
  { key: "politique",label: "Politique",    icon: Globe2,     color: "#8B5CF6" },
  { key: "climat",   label: "Climat",       icon: CloudRain,  color: "#F59E0B" },
  { key: "energie",  label: "Énergie",      icon: Zap,        color: "#10B981" },
  { key: "tech",     label: "Tech & Fintech",icon: Sparkles,  color: "#EC4899" },
];

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  macro:     "Macro",
  marches:   "Marchés",
  politique: "Politique",
  climat:    "Climat",
  energie:   "Énergie",
  tech:      "Tech",
};

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  macro:     "#00D4AA",
  marches:   "#3B82F6",
  politique: "#8B5CF6",
  climat:    "#F59E0B",
  energie:   "#10B981",
  tech:      "#EC4899",
};

// ── Composant carte ──────────────────────────────────────────────────────────
function ArticleCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const [showAI, setShowAI] = useState(false);
  const catColor = CATEGORY_COLORS[article.category];

  if (featured) {
    return (
      <div
        className="rounded-2xl border p-6 transition-all duration-200 hover:shadow-lg"
        style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)" }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide"
              style={{ background: `color-mix(in srgb, ${catColor} 15%, transparent)`, color: catColor }}
            >
              {CATEGORY_LABELS[article.category]}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {article.region}
            </span>
            {article.countries.map((f, i) => <span key={i} className="text-base">{f}</span>)}
          </div>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "color-mix(in srgb, #F59E0B 15%, transparent)", color: "#F59E0B" }}
          >
            ★ À la une
          </span>
        </div>

        <h2 className="text-lg font-bold leading-snug mb-3" style={{ color: "var(--text-primary)" }}>
          {article.title}
        </h2>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
          {article.summary}
        </p>

        {article.aiSummary && (
          <div className="mb-4">
            <button
              onClick={() => setShowAI((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: showAI ? "color-mix(in srgb, var(--mansa-green) 12%, transparent)" : "var(--input-bg)",
                color: showAI ? "var(--mansa-green)" : "var(--text-muted)",
                border: "1px solid var(--input-border)",
              }}
            >
              <Sparkles size={12} />
              Résumé IA MANSA
            </button>
            {showAI && (
              <div
                className="mt-2 p-3 rounded-xl text-xs leading-relaxed"
                style={{ background: "color-mix(in srgb, var(--mansa-green) 6%, transparent)", color: "var(--text-secondary)", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)" }}
              >
                {article.aiSummary}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{article.source}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{article.dateRelative}</span>
            <span>{article.readTime} min de lecture</span>
          </div>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "var(--mansa-green)", border: "1px solid color-mix(in srgb, var(--mansa-green) 30%, transparent)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--mansa-green) 10%, transparent)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            Lire l'article <ExternalLink size={11} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-4 transition-all duration-200 hover:shadow-md"
      style={{ background: "var(--card-bg)", borderColor: "var(--bg-border)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-1 rounded-full flex-shrink-0 mt-1"
          style={{ background: catColor, height: "calc(100% - 8px)", minHeight: 36 }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ background: `color-mix(in srgb, ${catColor} 12%, transparent)`, color: catColor }}
            >
              {CATEGORY_LABELS[article.category]}
            </span>
            {article.countries.map((f, i) => <span key={i} className="text-sm">{f}</span>)}
            <span className="text-xs ml-auto flex-shrink-0 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Clock size={10} />{article.dateRelative}
            </span>
          </div>

          <h3 className="text-sm font-semibold leading-snug mb-1.5" style={{ color: "var(--text-primary)" }}>
            {article.title}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2 mb-2" style={{ color: "var(--text-secondary)" }}>
            {article.summary}
          </p>

          {article.aiSummary && (
            <div className="mb-2">
              <button
                onClick={() => setShowAI((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors"
                style={{
                  background: showAI ? "color-mix(in srgb, var(--mansa-green) 10%, transparent)" : "var(--input-bg)",
                  color: showAI ? "var(--mansa-green)" : "var(--text-muted)",
                  border: "1px solid var(--input-border)",
                }}
              >
                <Sparkles size={10} />
                Résumé IA
              </button>
              {showAI && (
                <div
                  className="mt-1.5 p-2.5 rounded-lg text-[11px] leading-relaxed"
                  style={{ background: "color-mix(in srgb, var(--mansa-green) 6%, transparent)", color: "var(--text-secondary)", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)" }}
                >
                  {article.aiSummary}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{article.source}</span>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-medium transition-colors"
              style={{ color: "var(--mansa-green)" }}
            >
              Lire <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers RSS ──────────────────────────────────────────────────────────────
function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Il y a moins d'1h";
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(diff / 86400000);
    return d === 1 ? "Hier" : `Il y a ${d} jours`;
  } catch { return ""; }
}

function mapCategory(raw: string): NewsCategory {
  const map: Record<string, NewsCategory> = {
    macro: "macro", macroéconomie: "macro",
    marchés: "marches", marches: "marches", markets: "marches",
    politique: "politique", politics: "politique",
    climat: "climat", climate: "climat",
    énergie: "energie", energie: "energie", energy: "energie",
    tech: "tech", fintech: "tech",
    développement: "macro", commerce: "macro", actualité: "macro",
  };
  return map[raw?.toLowerCase()] ?? "macro";
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function NewsPage() {
  const locale = useLangStore((s) => s.locale);
  const [activeCategory, setActiveCategory] = useState<NewsCategory | "all">("all");
  const [search, setSearch] = useState("");

  // Tenter de charger les actualités live depuis le backend RSS
  const { data: liveData, refetch, isFetching } = useQuery({
    queryKey: ["news-feed"],
    queryFn: () => newsApi.getFeed({ limit: 30 }),
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  // Normaliser les articles live en format NewsArticle local
  const liveArticles: NewsArticle[] = useMemo(() => {
    if (!liveData?.articles?.length) return [];
    return liveData.articles.map((a: any, i: number) => ({
      id: a.id ?? i,
      title: a.title ?? "",
      summary: a.summary ?? "",
      source: a.source ?? "Source inconnue",
      sourceUrl: a.url ?? "#",
      date: a.published_at?.split("T")[0] ?? "",
      dateRelative: a.published_at ? formatRelative(a.published_at) : "",
      category: mapCategory(a.category),
      region: a.region ?? "Afrique",
      countries: [],
      readTime: Math.max(1, Math.round((a.summary?.length ?? 200) / 200)),
      featured: a.is_featured ?? false,
    }));
  }, [liveData]);

  const articles = liveArticles.length > 0 ? liveArticles : ARTICLES;
  const isLive = liveData?.is_live ?? false;

  const filtered = useMemo(() => {
    let list = articles;
    if (activeCategory !== "all") list = list.filter((a) => a.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          a.region.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, search, articles]);

  const featured = filtered.filter((a) => a.featured);
  const regular  = filtered.filter((a) => !a.featured);

  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--bg-primary)" }}>
      {/* ── En-tête ── */}
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: "var(--bg-border)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)" }}
              >
                <Newspaper size={18} style={{ color: "var(--mansa-green)" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {locale === "fr" ? "Actualités Macroéconomiques" : "Macro News"}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {locale === "fr"
                    ? "54 économies africaines · Sources officielles · Résumés IA"
                    : "54 African economies · Official sources · AI summaries"}
                </p>
              </div>
            </div>
          </div>

          {/* Recherche + badge live */}
          <div className="flex items-center gap-2">
            <DataSourceBadge isLive={isLive} source={isLive ? "RSS" : undefined} />
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-lg transition-all"
              title="Actualiser"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-muted)" }}
            >
              <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            </button>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 w-64"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)" }}
            >
              <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={locale === "fr" ? "Rechercher une actualité..." : "Search news..."}
                className="bg-transparent text-sm focus:outline-none w-full"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
          </div>
        </div>

        {/* Filtres catégories */}
        <div className="flex items-center gap-2 mt-5 flex-wrap">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={{
                  background: active
                    ? `color-mix(in srgb, ${cat.color === "var(--text-muted)" ? "var(--mansa-green)" : cat.color} 15%, transparent)`
                    : "var(--input-bg)",
                  color: active
                    ? cat.color === "var(--text-muted)" ? "var(--mansa-green)" : cat.color
                    : "var(--text-muted)",
                  border: active
                    ? `1px solid color-mix(in srgb, ${cat.color === "var(--text-muted)" ? "var(--mansa-green)" : cat.color} 40%, transparent)`
                    : "1px solid var(--input-border)",
                }}
              >
                <Icon size={12} />
                {cat.label}
                <span
                  className="ml-0.5 text-[10px] px-1 py-0.5 rounded-full"
                  style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}
                >
                  {cat.key === "all" ? ARTICLES.length : ARTICLES.filter((a) => a.category === cat.key).length}
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
            <Newspaper size={48} style={{ color: "var(--text-muted)", marginBottom: 16, opacity: 0.4 }} />
            <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>
              {locale === "fr" ? "Aucune actualité trouvée" : "No news found"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              {locale === "fr" ? "Essayez d'autres filtres ou termes de recherche." : "Try different filters or search terms."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Articles à la une */}
            {featured.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={14} style={{ color: "#F59E0B" }} />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    À la une
                  </h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {featured.map((a) => (
                    <ArticleCard key={a.id} article={a} featured />
                  ))}
                </div>
              </section>
            )}

            {/* Autres articles */}
            {regular.length > 0 && (
              <section>
                {featured.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {locale === "fr" ? "Dernières actualités" : "Latest news"}
                    </h2>
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {regular.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ── Pied de page sources ── */}
      <div className="px-8 py-4 border-t text-xs flex items-center gap-1" style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
        <Globe2 size={11} />
        <span>
          Sources : FMI · Banque Mondiale · Banques centrales africaines · UA · IRENA · PAM · Communiqués officiels
        </span>
      </div>
    </div>
  );
}
