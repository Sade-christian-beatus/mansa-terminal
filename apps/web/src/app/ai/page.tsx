"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Bot, User, Loader2, History, X, Clock, Coins,
  Download, Copy, Check, Sparkles, Database, AlertCircle,
  Zap, MessageSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { streamAIQuery, aiApi, type AIHistoryItem } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportData } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/ai-utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  sources?: string[];
  error?: boolean;
  errorCode?: number;
  isDemo?: boolean;
}


// ── Réponses de démonstration locales (quand le backend est indisponible) ─────
const DEMO_RESPONSES: { keywords: string[]; response: string }[] = [
  {
    keywords: ["dette", "nigeria", "ghana"],
    response: `## Dynamique de la dette publique : Nigeria vs Ghana (2019–2025e)

### Nigeria
| Année | Dette/PIB | Fiscal | Service/Recettes |
|-------|-----------|--------|-----------------|
| 2019 | 28,4% | -4,7% | 47% |
| 2021 | 35,0% | -5,5% | 83% |
| 2023 | 42,1% | -4,9% | 61% |
| 2025e | **46,0%** | -4,6% | 52% |

Le Nigeria maintient une dette relativement modérée en % du PIB, **mais le service de la dette absorbe plus de 50% des recettes fiscales**, limitant sévèrement l'espace budgétaire pour l'investissement.

### Ghana
| Année | Dette/PIB | Fiscal | Notes |
|-------|-----------|--------|-------|
| 2019 | 62,3% | -7,5% | Pre-crise |
| 2022 | 92,4% | -9,4% | Défaut sélectif |
| 2023 | 83,8% | -4,9% | Restructuration FMI |
| 2025e | **75–80%** | -3,5% | Post-DDEP |

Le Ghana a subi une **crise de dette sévère en 2022**, nécessitant un programme FMI de 3 Mds USD et une restructuration (DDEP) portant sur ~90 Mds GHS de dette domestique.

### Facteurs différenciants
- **Pétrole** : Les recettes pétrolières du Nigeria offrent un tampon que le Ghana n'a plus depuis l'épuisement de ses champs.
- **Accès marchés** : Le Nigeria peut encore émettre des Eurobonds ; le Ghana est en restructuration.
- **FMI** : Les deux pays ont des programmes actifs, mais Ghana est sous supervision plus stricte.

*Sources : FMI WEO Avril 2025, IMF Article IV Ghana/Nigeria, Banque Mondiale*`,
  },
  {
    keywords: ["côte d'ivoire", "cote d'ivoire", "côte divoire", "investir", "risques"],
    response: `## Analyse macro-risques — Côte d'Ivoire 2025

### Fondamentaux (FMI WEO 2025e)
- **Croissance PIB** : +6,5% (parmi les plus élevés d'Afrique subsaharienne)
- **Inflation** : 3,8% (maîtrisée, ancrage CFA)
- **Dette publique** : 57% du PIB
- **Solde budgétaire** : -4,0% du PIB
- **IDE** : ~800 M USD/an

### Atouts
✅ Stabilité politique retrouvée depuis 2011
✅ Hub régional UEMOA (Abidjan = capitale économique)
✅ Économie diversifiée : cacao (#1 mondial), café, caoutchouc, pétrole
✅ Infrastructures parmi les meilleures d'Afrique de l'Ouest
✅ Accès aux marchés de capitaux (Eurobonds à 8,25% 2033)

### Risques à surveiller
⚠️ **Dépendance cacao** : 40% des recettes export — vulnérable à la volatilité des prix
⚠️ **Risque politique 2025** : Présidentielle à risque (Ouattara 3e mandat controversé)
⚠️ **Compte courant** : -3,7% du PIB, dépendance aux financements externes
⚠️ **Secteur financier** : Créances douteuses en hausse post-COVID

### Recommandation MANSA
Profil **Investissement BB** — Attractive pour les secteurs agro-industrie, énergie et infrastructure. Prime de risque correcte au regard des fondamentaux.

*Sources : FMI Article IV 2024, Banque Mondiale, BCEAO, MANSA Research*`,
  },
  {
    keywords: ["uemoa", "convergence", "bceao"],
    response: `## Critères de convergence UEMOA — Bilan 2025e

L'UEMOA impose 4 critères de premier rang et 4 de second rang. Voici l'état des 8 membres :

### Critère 1 : Solde budgétaire ≥ -3% du PIB
| Pays | 2025e | Statut |
|------|-------|--------|
| Côte d'Ivoire | -4,0% | ❌ Hors critère |
| Sénégal | -4,9% | ❌ |
| Bénin | -4,7% | ❌ |
| **Togo** | **-3,8%** | ⚠️ Proche |
| Mali | -3,5% | ⚠️ |

> **Aucun pays ne satisfait pleinement le critère budgétaire en 2025e.**

### Critère 2 : Inflation ≤ 3% (moyenne annuelle)
✅ Côte d'Ivoire (3,8%) — marginal
✅ Sénégal (2,8%) — **conforme**
✅ Bénin (2,7%) — **conforme**
✅ Togo (4,0%) — ⚠️ légèrement au-dessus

### Pays les mieux positionnés globalement
1. **Bénin** — Croissance robuste (+6,4%), inflation maîtrisée, dette sous contrôle
2. **Togo** — Réformes structurelles avancées, hub logistique
3. **Côte d'Ivoire** — Croissance forte mais déficits élevés

*Sources : BCEAO, FMI WEO 2025, Rapport de convergence UEMOA 2024*`,
  },
  {
    keywords: ["kenya", "climat", "catastrophe", "risque"],
    response: `## Profil climatique et risques catastrophes — Kenya 2025

### Exposition aux risques climatiques
Le Kenya figure parmi les pays africains **les plus vulnérables aux chocs climatiques**, avec un score ND-GAIN de 48/100 (vulnérabilité élevée, adaptation modérée).

### Événements récents (2023–2025)
- **Inondations 2024** : 200+ décès, 50 000 déplacés, dommages estimés à 1,5% du PIB
- **Sécheresse 2022–2023** : Déficit alimentaire touchant 4,3 M personnes (nord et est)
- **El Niño 2023** : Précipitations +200% au-dessus de la normale dans les Highlands

### Indices quantitatifs
| Indicateur | Valeur | Benchmark ASS |
|-----------|--------|--------------|
| Temp. anomalie vs 1980 | +1,2°C | +0,9°C |
| Événements extrêmes/an (moy. 2015-25) | 3,8 | 2,1 |
| Population exposée inondations | 12% | 8% |
| Pertes agricoles/an (% PIB) | 1,8% | 1,2% |

### Initiatives d'adaptation
- **Kenya Climate Change Act 2016** : Cadre légal pionnier en Afrique
- **Green Climate Fund** : 100 M USD alloués (NCCAP 2023–2027)
- **Géothermie** : 35% du mix électrique — résilience énergétique forte

*Sources : EM-DAT, WRI Aqueduct, OCHA, NOAA, Gouvernement Kenya*`,
  },
  {
    keywords: ["énergie renouvelable", "energie renouvelable", "solaire", "hydro"],
    response: `## Production d'énergie renouvelable en Afrique — Top pays 2025

### Classement par capacité installée (GW)
| # | Pays | Capacité | Part ENR |
|---|------|----------|---------|
| 1 | **Maroc** | 5,4 GW | 42% |
| 2 | **Égypte** | 11,0 GW | 28% |
| 3 | **Afrique du Sud** | 10,2 GW | 22% |
| 4 | **Kenya** | 3,1 GW | **92%** ← 🏆 |
| 5 | **Éthiopie** | 5,7 GW | 98% |

### Kenya — Champion toutes catégories
Le Kenya est le leader africain en **part ENR dans le mix électrique** :
- Géothermie : 988 MW (Valley du Rift)
- Hydro : 826 MW
- Éolien : 310 MW (Lake Turkana — plus grand parc éolien d'Afrique)
- Solaire : 120 MW

### Éthiopie — Hydro dominante
Le GERD (Grand Ethiopian Renaissance Dam, 5,1 GW) fait de l'Éthiopie un exportateur net d'électricité en devenir.

### Maroc — Solaire CSP leader
**Noor Ouarzazate** (580 MW) reste le plus grand complexe solaire CSP du monde. Objectif : 52% ENR d'ici 2030.

*Sources : IRENA 2024, EIA, Banque Africaine de Développement*`,
  },
  {
    keywords: ["sénégal", "senegal", "dette", "soutenabilité"],
    response: `## Soutenabilité de la dette — Sénégal 2025e

### Indicateurs clés (FMI WEO Avril 2025)
| Indicateur | 2023 | 2024e | 2025e |
|-----------|------|-------|-------|
| Dette/PIB | 79,1% | 73,4% | 68–70% |
| Solde budgétaire | -5,5% | -4,9% | -4,2% |
| Croissance | +4,3% | +8,3% | +9,5% |
| Réserves (mois imports) | 3,1 | 3,8 | 4,2 |

### Facteur pétrole & gaz
Le **premier pétrole Sangomar** (extrait depuis juin 2024, ~100 000 bpj) et le **GNL Grand Tortue Ahmeyim** (phase 1 : ~2,5 Mtpa) vont transformer les finances publiques sénégalaises :
- Recettes supplémentaires estimées à **+2–3% du PIB** dès 2025
- Réduction attendue du déficit courant (actuellement -12% du PIB)

### Risques résiduels
⚠️ Recettes pétrolières inférieures aux prévisions initiales (retards PETROSEN)
⚠️ Dette en devises élevée (~65% du total) — risque de change
⚠️ Révision statistique 2024 : dette réelle 79% vs 73% initialement annoncé

### Verdict FMI
**Risque de surendettement : MODÉRÉ** — La dynamique de croissance et les recettes extractives compensent le niveau élevé de la dette.

*Sources : FMI DSA Sénégal 2024, Rapport FMI Article IV, PETROSEN, Banque Mondiale*`,
  },
];

function getDemoResponse(question: string): string {
  const q = question.toLowerCase();
  for (const dr of DEMO_RESPONSES) {
    if (dr.keywords.some((k) => q.includes(k))) return dr.response;
  }
  // Réponse générique
  const country = q.includes("nigeria") ? "Nigeria" : q.includes("kenya") ? "Kenya"
    : q.includes("ghana") ? "Ghana" : q.includes("maroc") ? "Maroc"
    : q.includes("ethiopia") || q.includes("éthiopie") ? "Éthiopie" : "Afrique";
  return `## Analyse macro-fiscale — ${country}

Je traite votre question : *"${question}"*

> ⚡ **Mode démonstration** — Le service IA en temps réel est temporairement indisponible. Voici une analyse basée sur nos données intégrées (FMI WEO 2025, Banque Mondiale).

### Contexte économique régional (Afrique subsaharienne 2025e)
- **Croissance moyenne** : +3,8% (vs +2,9% en 2023)
- **Inflation moyenne** : 15,2% (en baisse vs 19,4% en 2022)
- **Solde budgétaire moyen** : -4,2% du PIB
- **Dette publique moyenne** : 57% du PIB

### Thèmes clés 2025
1. **Transition énergétique** : 48 pays africains ont soumis des NDC révisées à la COP29
2. **Accès marchés de capitaux** : Les spreads Eurobond africains se resserrent après la Fed
3. **Croissance portée par l'extractif** : Pétrole Sénégal, cuivre Zambie, charbon Mozambique
4. **Risques politiques** : Élections dans 12 pays en 2025 — volatilité accrue

Pour une analyse approfondie et en temps réel, connectez le service MANSA AI (nécessite la configuration du backend).

*Sources : FMI WEO Avril 2025 · Banque Mondiale · MANSA Research*`;
}

async function* simulateDemoStream(question: string): AsyncGenerator<{ type: string; content: string }> {
  const response = getDemoResponse(question);
  const words = response.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    yield { type: "text", content: chunk };
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 20));
  }
  yield { type: "done", content: "" };
}

const SUGGESTED_QUERIES = [
  { q: "Compare la dynamique de la dette publique au Nigeria et au Ghana sur 5 ans", tags: ["IMF", "WB"] },
  { q: "Analyse les risques macro pour investir en Côte d'Ivoire en 2024", tags: ["IMF", "WB", "Comtrade"] },
  { q: "Quels pays UEMOA sont les plus proches des critères de convergence ?", tags: ["IMF", "BCEAO"] },
  { q: "Analyse le profil climatique et les risques catastrophes naturelles au Kenya", tags: ["EM-DAT", "WRI"] },
  { q: "Quels pays africains ont la meilleure production d'énergie renouvelable ?", tags: ["EIA", "WB"] },
  { q: "Analyse l'insécurité alimentaire en Afrique de l'Est en 2024", tags: ["IPC/CH", "FAO"] },
  { q: "Quels ports africains ont subi le plus de pression en 2024 ?", tags: ["PortWatch", "IMF"] },
  { q: "Compare les taux de pauvreté extrême au Sahel", tags: ["WB PIP", "WB"] },
];

const SOURCES = ["FMI WEO", "Banque Mondiale", "BCEAO", "BEAC", "ACLED", "EM-DAT", "NASA GLDAS", "EIA", "PortWatch", "Comtrade", "IPC/CH", "MANSA Research"];

function SourceChip({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "IMF": "text-blue-400 bg-blue-400/10", "WB": "text-green-400 bg-green-400/10",
    "EM-DAT": "text-red-400 bg-red-400/10", "EIA": "text-amber-400 bg-amber-400/10",
    "IPC/CH": "text-orange-400 bg-orange-400/10", "BCEAO": "text-violet-400 bg-violet-400/10",
    "FAO": "text-lime-400 bg-lime-400/10", "PortWatch": "text-cyan-400 bg-cyan-400/10",
    "WRI": "text-teal-400 bg-teal-400/10", "WB PIP": "text-emerald-400 bg-emerald-400/10",
    "Comtrade": "text-indigo-400 bg-indigo-400/10",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[label] ?? "text-gray-400 bg-gray-400/10"}`}>
      {label}
    </span>
  );
}

export default function MansaAIPage() {
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState("");
  const [isLoading,    setIsLoading]    = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);
  const [copied,       setCopied]       = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  const { data: history, isLoading: historyLoading } = useQuery<AIHistoryItem[]>({
    queryKey: ["ai-history"],
    queryFn: () => aiApi.getHistory(30),
    enabled: showHistory,
    staleTime: 30_000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId, role: "assistant", content: "", isStreaming: true, sources: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let fullContent = "";
      try {
        // Tentative connexion backend réel
        for await (const chunk of streamAIQuery(question)) {
          if (chunk.type === "text" && chunk.content) {
            fullContent += chunk.content;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m)
            );
          } else if (chunk.type === "done") {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m)
            );
          } else if (chunk.type === "error") {
            // Erreur retournée par le backend dans le stream SSE
            const errText = chunk.content ?? "Erreur du service IA.";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: errText, isStreaming: false, error: true }
                  : m
              )
            );
          }
        }
      } catch (err: unknown) {
        // Distinguer erreur API (status connu) vs erreur réseau
        const status = (err as { status?: number }).status;

        if (status === 401) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Session expirée. Reconnectez-vous pour utiliser MANSA AI.", isStreaming: false, error: true, errorCode: 401 }
                : m
            )
          );
          return;
        }
        if (status === 402) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "Abonnement requis pour accéder à MANSA AI.", isStreaming: false, error: true, errorCode: 402 }
                : m
            )
          );
          return;
        }
        if (status === 429) {
          const msg = (err as Error).message || "Quota journalier atteint.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: msg, isStreaming: false, error: true, errorCode: 429 }
                : m
            )
          );
          return;
        }
        if (status && status >= 400 && status < 500) {
          // Autre erreur client connue — afficher sans démo
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: (err as Error).message, isStreaming: false, error: true, errorCode: status }
                : m
            )
          );
          return;
        }

        // Erreur réseau (backend indisponible) → mode démonstration
        let demoContent = "";
        for await (const demoChunk of simulateDemoStream(question)) {
          if (demoChunk.type === "text") {
            demoContent += demoChunk.content;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: demoContent, isDemo: true } : m)
            );
          }
        }
      }
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m)
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportConversation = () => {
    if (messages.length === 0) return;
    const rows = messages.map((m, i) => ({
      index: i + 1,
      role: m.role,
      content: m.content,
      timestamp: new Date().toISOString(),
    }));
    exportData(rows, "json", "mansa-ai-conversation");
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}>
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              MANSA AI
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", color: "var(--mansa-green)" }}>
                Powered by Claude
              </span>
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              IA spécialisée · 54 économies africaines · FMI WEO · Banque Mondiale
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={exportConversation} className="mansa-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
              <Download size={12} /> Exporter
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              <MessageSquare size={12} /> Nouveau
            </button>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="mansa-card px-4 py-2 text-sm flex items-center gap-2 rounded-lg transition-colors"
            style={showHistory ? { color: "var(--mansa-green)" } : { color: "var(--text-muted)" }}
          >
            <History size={14} /> Historique
          </button>
        </div>
      </div>

      {/* ── Sources filtrables ── */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <Database size={10} />
            <span className="font-medium uppercase tracking-wider">Sources :</span>
          </div>
          {SOURCES.map((s) => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border cursor-default select-none"
                  style={{ borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)", color: "var(--mansa-green)", background: "color-mix(in srgb, var(--mansa-green) 8%, transparent)" }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Zone messages ── */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ scrollbarWidth: "thin" }}>

        {/* État vide */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-xl"
                 style={{ background: "linear-gradient(135deg, rgba(14,165,160,0.15), rgba(10,122,118,0.15))", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)" }}>
              <Zap size={36} style={{ color: "var(--mansa-green)" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Interrogez MANSA AI
            </h2>
            <p className="text-sm mb-2 max-w-lg" style={{ color: "var(--text-muted)" }}>
              Analyses macro-fiscales, risques souverains, profils pays, données FMI, Banque Mondiale
              et 12 sources spécialisées pour 54 économies africaines.
            </p>
            <p className="text-xs mb-8 max-w-md" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              Les réponses s&apos;appuient sur la base de données MANSA, puis les APIs connectées, puis la base de connaissances RAG.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
              {SUGGESTED_QUERIES.map(({ q, tags }) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="mansa-card text-left px-4 py-3 rounded-xl text-sm transition-all hover:shadow-md group"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--mansa-green) 40%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles size={13} className="text-amber-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="leading-snug mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>{q}</p>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => <SourceChip key={t} label={t} />)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-fade-in ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0ea5a0] to-[#0a7a76]
                              flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <Bot size={14} className="text-white" />
              </div>
            )}

            <div className={`max-w-3xl rounded-2xl px-4 py-3 group relative ${
              message.role === "user"
                ? "bg-[#3B82F6] text-white"
                : message.error
                  ? "border border-red-500/30"
                  : "mansa-card"
            }`}
            style={message.error ? { background: "rgba(239,68,68,0.07)" } : {}}>

              {message.role === "assistant" ? (
                <>
                  {message.error ? (
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400">{message.content}</p>
                        {message.errorCode === 401 && (
                          <a href="/auth/login" className="text-xs mt-1 block underline" style={{ color: "var(--mansa-green)" }}>
                            → Se reconnecter
                          </a>
                        )}
                        {(message.errorCode === 402 || message.errorCode === 403) && (
                          <a href="/billing" className="text-xs mt-1 block underline" style={{ color: "var(--mansa-green)" }}>
                            → Voir les plans d&apos;abonnement
                          </a>
                        )}
                        {message.errorCode === 429 && (
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            Réessayez demain ou passez à un plan supérieur.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.isDemo && (
                        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded text-[10px] font-medium w-fit"
                             style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)" }}>
                          ⚡ Mode démonstration — backend indisponible
                        </div>
                      )}
                      <div className="prose prose-invert prose-sm max-w-none
                                      prose-headings:font-semibold
                                      prose-code:text-[#0ea5a0]
                                      prose-table:text-sm
                                      prose-strong:text-white"
                           style={{ color: "var(--text-secondary)" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 animate-pulse ml-1 rounded-sm"
                                style={{ background: "var(--mansa-green)" }} />
                        )}
                      </div>
                      {!message.isStreaming && message.content && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity"
                             style={{ borderColor: "var(--bg-border)" }}>
                          <button
                            onClick={() => copyMessage(message.id, message.content)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                            style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)" }}
                          >
                            {copied === message.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                            {copied === message.id ? "Copié !" : "Copier"}
                          </button>
                          <button
                            onClick={() => exportData([{ content: message.content }], "json", "mansa-ai-response")}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                            style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)" }}
                          >
                            <Download size={10} /> Exporter
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm leading-relaxed">{message.content}</p>
              )}
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                   style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}>
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Indicateur de frappe */}
        {isLoading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex gap-3 justify-start animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0ea5a0] to-[#0a7a76] flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="mansa-card rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Historique panel ── */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-96 z-50 flex flex-col shadow-2xl border-l"
             style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
               style={{ borderColor: "var(--bg-border)" }}>
            <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <History size={16} style={{ color: "var(--mansa-green)" }} />
              Historique des conversations
            </h2>
            <button onClick={() => setShowHistory(false)} style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {historyLoading && (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--mansa-green)" }} />
              </div>
            )}
            {!historyLoading && (!history || history.length === 0) && (
              <div className="text-center py-12">
                <MessageSquare size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune requête pour l&apos;instant.</p>
              </div>
            )}
            {history?.map((item) => (
              <button
                key={item.id}
                onClick={() => { setInput(item.question); setShowHistory(false); textareaRef.current?.focus(); }}
                className="w-full text-left mansa-card rounded-xl px-4 py-3 transition-all group"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--mansa-green) 40%, transparent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
              >
                <p className="text-sm line-clamp-2 mb-2" style={{ color: "var(--text-secondary)" }}>
                  {item.question}
                </p>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {item.tokens_used > 0 && (
                    <span className="flex items-center gap-1">
                      <Coins size={10} />{item.tokens_used.toLocaleString()} tokens
                    </span>
                  )}
                  {item.countries.length > 0 && (
                    <span style={{ color: "var(--mansa-green)" }}>{item.countries.slice(0, 3).join(", ")}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone saisie ── */}
      <div className="mansa-card rounded-2xl p-4 shadow-lg" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Analyse la soutenabilité de la dette du Sénégal avec les dernières données IMF..."
            rows={2}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:cursor-not-allowed shadow-md"
            style={{
              background: !input.trim() || isLoading ? "var(--bg-border)" : "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))",
              color: "#fff",
            }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Entrée pour envoyer · Maj+Entrée pour saut de ligne
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            IMF · Banque Mondiale · WHO · EM-DAT · EIA · PortWatch
          </p>
        </div>
      </div>
    </div>
  );
}
