"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Bot, User, Loader2, History, X, Clock, Coins,
  Download, Copy, Check, Sparkles, Database, AlertCircle,
  Zap, MessageSquare, ChevronDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { streamAIQuery, aiApi, type AIHistoryItem } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportData } from "@/lib/export-utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  sources?: string[];
  error?: boolean;
  errorCode?: number;
}

/* ── Diagnostic d'erreur précis ── */
function getErrorMessage(err: unknown): { message: string; code?: number } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("401")) return { message: "Session expirée. Veuillez vous reconnecter.", code: 401 };
  if (msg.includes("403")) return { message: "Abonnement requis pour accéder à MANSA AI.", code: 403 };
  if (msg.includes("429")) return { message: "Quota journalier atteint. Réessayez demain ou passez au plan supérieur.", code: 429 };
  if (msg.includes("422")) return { message: "Question invalide ou trop courte. Reformulez votre question.", code: 422 };
  if (msg.includes("500")) return { message: "Erreur serveur. L'équipe MANSA a été notifiée.", code: 500 };
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ECONNREFUSED"))
    return { message: "Impossible de joindre le serveur MANSA. Vérifiez votre connexion.", code: 0 };
  return { message: "Une erreur inattendue est survenue. Réessayez dans quelques instants." };
}

/* ── Suggested queries enrichies avec nouvelles sources ── */
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

const SOURCES = ["IMF WEO", "World Bank", "WHO GHO", "EM-DAT", "EIA", "IPC/CH", "PortWatch", "Comtrade", "WB PIP", "MANSA Research"];

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
  const [showSources,  setShowSources]  = useState(false);
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
          const errText = chunk.content ?? "Erreur inconnue du service IA.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errText, isStreaming: false, error: true }
                : m
            )
          );
        }
      }
    } catch (err) {
      const { message: errMsg, code } = getErrorMessage(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: errMsg, isStreaming: false, error: true, errorCode: code }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m)
        prev.map((m) => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)
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
    const rows = messages.map((m, i) => ({ index: i + 1, role: m.role, content: m.content, timestamp: new Date().toISOString() }));
    exportData(rows, "json", "mansa-ai-conversation");
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
    exportData(rows, "json", "mansa-conversation");
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4AA] to-[#3B82F6] flex items-center justify-center shadow-lg">
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
              IA spécialisée · 54 économies africaines · Données temps réel
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

      {/* ── Sources déroulantes ── */}
      <div className="mb-3">
        <button
          onClick={() => setShowSources((v) => !v)}
          className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 border transition-colors"
          style={{ background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }}
        >
          <Database size={11} />
          <span>Sources de données actives</span>
          <ChevronDown size={11} className={`transition-transform ${showSources ? "rotate-180" : ""}`} />
        </button>
        {showSources && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap px-1 animate-fade-in">
            {SOURCES.map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border"
                    style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)", background: "var(--sidebar-bg)" }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Zone messages ── */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ scrollbarWidth: "thin" }}>

        {/* État vide */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-xl"
                 style={{ background: "linear-gradient(135deg, rgba(0,212,170,0.15), rgba(59,130,246,0.15))", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)" }}>
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#3B82F6]
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
                        {message.errorCode === 403 && (
                          <a href="/billing" className="text-xs mt-1 block underline" style={{ color: "var(--mansa-green)" }}>
                            → Voir les plans d&apos;abonnement
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="prose prose-invert prose-sm max-w-none
                                      prose-headings:font-semibold
                                      prose-code:text-[#00D4AA]
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#3B82F6] flex items-center justify-center flex-shrink-0">
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
