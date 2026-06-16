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

        // Erreur réseau (backend indisponible) → message honnête, pas de simulation
        const offlineMessage = `**Service temporairement indisponible**

MANSA AI nécessite une connexion au backend pour générer des analyses avec des données réelles.

**Ce que vous pouvez faire :**
- Vérifiez votre connexion internet
- Réessayez dans quelques instants
- Consultez les données macro directement via l'onglet **Pays** ou **Indicateurs**

*Vos données restent accessibles même sans MANSA AI.*`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: offlineMessage, isStreaming: false, error: true }
              : m
          )
        );
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
          <p className="text-[10px]" style={{ color: input.length > 1800 ? "#ef4444" : input.length > 1500 ? "#f59e0b" : "var(--text-muted)" }}>
            {input.length}/2000
          </p>
        </div>
      </div>
    </div>
  );
}
