"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Bot, User, Loader2, History, X, Clock, Coins,
  Download, Copy, Check, Sparkles, Database,
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
}

/* ── Suggested queries enrichies avec nouvelles sources ── */
const SUGGESTED_QUERIES = [
  { q: "Compare la dynamique de la dette publique au Nigeria et au Ghana sur 5 ans", tags: ["IMF", "WB"] },
  { q: "Analyse les risques macro pour investir en Côte d'Ivoire en 2024", tags: ["IMF", "WB", "Comtrade"] },
  { q: "Quels pays UEMOA sont les plus proches des critères de convergence ?", tags: ["IMF", "BCEAO"] },
  { q: "Analyse le profil climatique et les risques catastrophes naturelles au Kenya (EM-DAT)", tags: ["EM-DAT", "WRI"] },
  { q: "Quels pays africains ont la meilleure production d'énergie renouvelable ? (EIA)", tags: ["EIA", "WB"] },
  { q: "Analyse l'insécurité alimentaire en Afrique de l'Est en 2024 (IPC/CH)", tags: ["IPC/CH", "FAO"] },
  { q: "Quels ports africains ont subi le plus de pression en 2024 ? (PortWatch)", tags: ["PortWatch", "IMF"] },
  { q: "Compare les taux de pauvreté extrême au Sahel (données WB PIP & World Bank)", tags: ["WB PIP", "WB"] },
];

/* ── Chip source ── */
function SourceChip({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "IMF": "text-blue-400 bg-blue-400/10", "WB": "text-green-400 bg-green-400/10",
    "EM-DAT": "text-red-400 bg-red-400/10", "EIA": "text-amber-400 bg-amber-400/10",
    "IPC/CH": "text-orange-400 bg-orange-400/10", "BCEAO": "text-violet-400 bg-violet-400/10",
    "FAO": "text-lime-400 bg-lime-400/10", "PortWatch": "text-cyan-400 bg-cyan-400/10",
    "WRI": "text-teal-400 bg-teal-400/10", "WB PIP": "text-emerald-400 bg-emerald-400/10",
    "Comtrade": "text-indigo-400 bg-indigo-400/10",
  };
  const cls = colors[label] ?? "text-gray-400 bg-gray-400/10";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{label}</span>
  );
}

export default function AIAnalystPage() {
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
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", isStreaming: true, sources: [] };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    try {
      let fullContent = "";
      for await (const chunk of streamAIQuery(question)) {
        if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent } : m)
          );
        } else if (chunk.type === "done") {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)
          );
        } else if (chunk.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "❌ Erreur lors de l'analyse. Veuillez réessayer.", isStreaming: false }
                : m
            )
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: "❌ Erreur de connexion.", isStreaming: false } : m
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D4AA] to-[#3B82F6] flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            MANSA Analyst
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            IA spécialisée · 54 économies africaines · IMF · WB · EM-DAT · EIA · IPC/CH · PortWatch
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={exportConversation} className="mansa-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
              <Download size={12} /> Exporter
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

      {/* Bandeau sources disponibles */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Database size={12} style={{ color: "var(--text-muted)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Sources actives :</span>
        {["IMF WEO", "World Bank", "WHO GHO", "EM-DAT", "EIA", "IPC/CH", "PortWatch", "Comtrade", "WB PIP", "MANSA Research"].map((s) => (
          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)", background: "var(--sidebar-bg)" }}>
            {s}
          </span>
        ))}
      </div>

      {/* Zone messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: "linear-gradient(135deg, rgba(0,212,170,0.15), rgba(59,130,246,0.15))" }}>
              <Bot size={32} style={{ color: "var(--mansa-green)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              Interrogez MANSA Analyst
            </h2>
            <p className="text-sm mb-8 max-w-md" style={{ color: "var(--text-muted)" }}>
              Analyses macro-fiscales, risques souverains, profils pays, catastrophes naturelles,
              sécurité alimentaire, énergie — données FMI, Banque Mondiale et 12 sources spécialisées.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-3xl">
              {SUGGESTED_QUERIES.map(({ q, tags }) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="mansa-card mansa-card-hover text-left px-4 py-3 rounded-xl text-sm transition-all"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="leading-snug mb-2" style={{ color: "var(--text-secondary)" }}>{q}</p>
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

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#3B82F6]
                              flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={14} className="text-white" />
              </div>
            )}

            <div className={`max-w-3xl rounded-2xl px-4 py-3 group relative ${
              message.role === "user" ? "bg-[#3B82F6] text-white" : "mansa-card"
            }`}>
              {message.role === "assistant" ? (
                <>
                  <div className="prose prose-invert prose-sm max-w-none
                                  prose-headings:font-semibold
                                  prose-code:text-[#00D4AA]
                                  prose-table:text-sm"
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
                        {copied === message.id ? "Copié" : "Copier"}
                      </button>
                      <button
                        onClick={() => exportData([{ content: message.content }], "json", "mansa-response")}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                        style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)" }}
                      >
                        <Download size={10} /> Exporter
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                   style={{ background: "var(--bg-border)" }}>
                <User size={14} style={{ color: "var(--text-muted)" }} />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Historique panel */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-96 z-50 flex flex-col shadow-2xl border-l"
             style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b"
               style={{ borderColor: "var(--bg-border)" }}>
            <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <History size={16} style={{ color: "var(--mansa-green)" }} />
              Historique
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
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                Aucune requête pour l&apos;instant.
              </p>
            )}
            {history?.map((item) => (
              <button
                key={item.id}
                onClick={() => { setInput(item.question); setShowHistory(false); textareaRef.current?.focus(); }}
                className="w-full text-left mansa-card rounded-xl px-4 py-3 hover:border-[#00D4AA]/40 transition-all group"
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

      {/* Zone saisie */}
      <div className="mansa-card rounded-2xl p-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Analyse la soutenabilité de la dette du Sénégal avec données EM-DAT et PortWatch..."
            rows={2}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 disabled:cursor-not-allowed"
            style={{
              background: !input.trim() || isLoading ? "var(--bg-border)" : "var(--mansa-green)",
              color: "#fff",
            }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Entrée pour envoyer · Maj+Entrée pour nouvelle ligne ·
          Sources : IMF · Banque Mondiale · WHO · EM-DAT · EIA · IPC/CH · PortWatch · Comtrade · MANSA Research
        </p>
      </div>
    </div>
  );
}
