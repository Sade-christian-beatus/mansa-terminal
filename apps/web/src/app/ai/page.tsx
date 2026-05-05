"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, History, X, Clock, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { streamAIQuery, aiApi, type AIHistoryItem } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const SUGGESTED_QUERIES = [
  "Compare la dynamique de la dette publique au Nigeria et au Ghana sur 5 ans",
  "Analyse les risques macro pour investir en Côte d'Ivoire en 2024",
  "Quels sont les pays UEMOA les plus proches des critères de convergence ?",
  "What is the outlook for East African economies in 2025?",
  "Analyse le risque de change pour un investisseur dollar en zone CFA",
  "Quels pays africains ont le meilleur profil dette/croissance pour les eurobonds ?",
];

export default function AIAnalystPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: history, isLoading: historyLoading } = useQuery<AIHistoryItem[]>({
    queryKey: ["ai-history"],
    queryFn: () => aiApi.getHistory(30),
    enabled: showHistory,
    staleTime: 30_000,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let fullContent = "";

      for await (const chunk of streamAIQuery(question)) {
        if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: fullContent }
                : m
            )
          );
        } else if (chunk.type === "done") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, isStreaming: false }
                : m
            )
          );
        } else if (chunk.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? {
                    ...m,
                    content: "❌ Erreur lors de l'analyse. Veuillez réessayer.",
                    isStreaming: false,
                  }
                : m
            )
          );
        }
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: "❌ Erreur de connexion.", isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D4AA] to-[#3B82F6]
                            flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            MANSA Analyst
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            IA spécialisée sur les 54 économies africaines · FMI · Banque Mondiale · BCEAO
          </p>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`mansa-card px-4 py-2 text-sm flex items-center gap-2 rounded-lg
                     transition-colors ${showHistory ? "text-[#00D4AA]" : "text-gray-400 hover:text-gray-200"}`}
        >
          <History size={14} />
          Historique
        </button>
      </div>

      {/* Zone de messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full
                          text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br
                            from-[#00D4AA]/20 to-[#3B82F6]/20
                            flex items-center justify-center mb-4">
              <Bot size={32} className="text-[#00D4AA]" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Interrogez MANSA Analyst
            </h2>
            <p className="text-gray-400 text-sm mb-8 max-w-md">
              Analyses macro-fiscales, risques souverains, profils pays, données
              FMI et Banque Mondiale — en français ou en anglais.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
              {SUGGESTED_QUERIES.map((query) => (
                <button
                  key={query}
                  onClick={() => sendMessage(query)}
                  className="mansa-card mansa-card-hover text-left px-4 py-3
                             rounded-xl text-sm text-gray-300 transition-all
                             hover:text-white"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br
                              from-[#00D4AA] to-[#3B82F6] flex items-center
                              justify-center flex-shrink-0 mt-1">
                <Bot size={14} className="text-white" />
              </div>
            )}

            <div
              className={`max-w-3xl rounded-2xl px-4 py-3 ${
                message.role === "user"
                  ? "bg-[#3B82F6] text-white"
                  : "mansa-card text-gray-200"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none
                                prose-headings:text-white prose-headings:font-semibold
                                prose-strong:text-gray-100 prose-code:text-[#00D4AA]
                                prose-table:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                  {message.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-[#00D4AA]
                                     animate-pulse ml-1 rounded-sm" />
                  )}
                </div>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center
                              justify-center flex-shrink-0 mt-1">
                <User size={14} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Panel Historique */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-96 bg-[#0F1117] border-l border-gray-800
                        z-50 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <History size={16} className="text-[#00D4AA]" />
              Historique
            </h2>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-500 hover:text-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {historyLoading && (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="text-[#00D4AA] animate-spin" />
              </div>
            )}
            {!historyLoading && (!history || history.length === 0) && (
              <p className="text-gray-500 text-sm text-center py-8">
                Aucune requête pour l&apos;instant.
              </p>
            )}
            {history?.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setInput(item.question);
                  setShowHistory(false);
                  textareaRef.current?.focus();
                }}
                className="w-full text-left mansa-card rounded-xl px-4 py-3
                           hover:border-[#00D4AA]/40 transition-all group"
              >
                <p className="text-sm text-gray-200 group-hover:text-white
                               line-clamp-2 mb-2">
                  {item.question}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(item.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  {item.tokens_used > 0 && (
                    <span className="flex items-center gap-1">
                      <Coins size={10} />
                      {item.tokens_used.toLocaleString()} tokens
                    </span>
                  )}
                  {item.countries.length > 0 && (
                    <span className="text-[#00D4AA]/70">
                      {item.countries.slice(0, 3).join(", ")}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone de saisie */}
      <div className="mansa-card rounded-2xl p-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Analyse la soutenabilité de la dette du Sénégal..."
            rows={2}
            className="flex-1 bg-transparent text-gray-200 placeholder-gray-500
                       text-sm resize-none focus:outline-none leading-relaxed"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-[#00D4AA] hover:bg-[#00A882]
                       disabled:bg-gray-700 disabled:cursor-not-allowed
                       flex items-center justify-center transition-colors
                       flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 size={16} className="text-white animate-spin" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Entrée pour envoyer · Maj+Entrée pour nouvelle ligne ·
          Données : IMF, Banque Mondiale, BCEAO, BEAC
        </p>
      </div>
    </div>
  );
}
