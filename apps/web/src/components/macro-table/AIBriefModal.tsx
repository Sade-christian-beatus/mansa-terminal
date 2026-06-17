"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Sparkles, RefreshCw, AlertCircle } from "lucide-react";

import { streamAIQuery } from "@/lib/api";
import { INDICATOR_BY_CODE, formatValue, computeBadge, type CountryDatum } from "./data";
import { Flag } from "./ui";

function buildPrompt(country: CountryDatum): string {
  const snapshot = Object.entries(country.values)
    .map(([code, v]) => {
      const def = INDICATOR_BY_CODE[code];
      return def ? `- ${def.label} : ${formatValue(def, v)} ${def.unit}` : null;
    })
    .filter(Boolean)
    .join("\n");
  const badge = computeBadge(country.values);

  return `Rédige un résumé exécutif (Executive Brief) de la situation macroéconomique de ${country.name} (${country.region}) à destination d'analystes, investisseurs et banques de développement.

Données macro actuelles (FMI WEO / Banque Mondiale) :
${snapshot}
Score de performance composite MANSA : ${badge.score}/100 (${badge.label}).

Structure ta réponse en markdown avec ces sections :
**Situation économique** (2-3 phrases de synthèse)
**Forces** (puces)
**Faiblesses** (puces)
**Risques** (puces)
**Opportunités** (puces)

Longueur totale : 150 à 300 mots. Reste factuel, analytique et concis.`;
}

export function AIBriefModal({ country, onClose }: { country: CountryDatum; onClose: () => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"streaming" | "done" | "error">("streaming");
  const [errorMsg, setErrorMsg] = useState("");
  const startedRef = useRef(false);

  const run = async () => {
    setText(""); setStatus("streaming"); setErrorMsg("");
    try {
      for await (const ev of streamAIQuery(buildPrompt(country))) {
        if (ev.type === "text") {
          if (ev.content) setText((t) => t + ev.content);
        } else if (ev.type === "error") {
          setStatus("error"); setErrorMsg(ev.content || "Erreur lors de la génération"); return;
        } else if (ev.type === "done") {
          setStatus("done"); return;
        }
      }
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Erreur de connexion au service IA");
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl animate-fade-in"
        style={{ background: "var(--card-bg)", border: "1px solid var(--bg-border)" }}>
        {/* En-tête */}
        <div className="sticky top-0 z-10 px-5 py-4 border-b flex items-center justify-between"
          style={{ background: "#1F3A5F", borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-3">
            <Flag iso3={country.id} w={36} h={24} />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={15} style={{ color: "#C9A227" }} /> AI Brief — {country.name}
              </h2>
              <p className="text-[11px] text-white/60">Résumé exécutif généré par MANSA AI · Claude</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/80" aria-label="Fermer"><X size={18} /></button>
        </div>

        {/* Contenu */}
        <div className="p-5">
          {status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle size={28} style={{ color: "#EF4444" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{errorMsg}</p>
              <button onClick={run} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#C9A227", color: "#1F3A5F" }}>
                <RefreshCw size={13} /> Réessayer
              </button>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none" style={{ color: "var(--text-secondary)" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              {status === "streaming" && (
                <span className="inline-block w-2 h-4 ml-0.5 align-middle animate-pulse" style={{ background: "#C9A227" }} />
              )}
            </div>
          )}
        </div>

        {status === "done" && (
          <div className="px-5 pb-4 flex items-center justify-between">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Généré par IA — à vérifier avant toute décision d'investissement.
            </span>
            <button onClick={run} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#C9A227" }}>
              <RefreshCw size={12} /> Régénérer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
