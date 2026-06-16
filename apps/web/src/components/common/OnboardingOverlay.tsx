"use client";

import { useState } from "react";
import { Globe2, BarChart2, Sparkles, ArrowRight, X } from "lucide-react";

const ONBOARDING_KEY = "mansa_onboarding_done";

const STEPS = [
  {
    icon: Globe2,
    color: "#3B82F6",
    title: "Explorez 54 économies africaines",
    description:
      "Accédez aux données macro-fiscales de chaque pays — PIB, inflation, dette, balance courante — issues du FMI, de la Banque Mondiale et de 12 sources spécialisées.",
    action: "Voir les pays →",
    href: "/countries",
  },
  {
    icon: BarChart2,
    color: "#8B5CF6",
    title: "Analysez les indicateurs clés",
    description:
      "Comparez des indicateurs sur 10 ans, visualisez les tendances régionales UEMOA/CEMAC/SSA et exportez vos données en CSV ou JSON.",
    action: "Voir les indicateurs →",
    href: "/indicators",
  },
  {
    icon: Sparkles,
    color: "#0ea5a0",
    title: "Interrogez MANSA AI",
    description:
      "Posez vos questions en français ou en anglais. MANSA AI analyse les données en temps réel et vous livre une analyse structurée : contexte, risques, recommandations.",
    action: "Essayer MANSA AI →",
    href: "/ai",
  },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingOverlay({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
           style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>

        {/* Bouton ignorer */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <X size={16} />
        </button>

        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? current.color : "var(--bg-border)" }}
            />
          ))}
        </div>

        {/* Icône */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
             style={{ background: `color-mix(in srgb, ${current.color} 15%, transparent)` }}>
          <Icon size={32} style={{ color: current.color }} />
        </div>

        {/* Contenu */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-2"
           style={{ color: current.color }}>
          Étape {step + 1} sur {STEPS.length}
        </p>
        <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
          {current.title}
        </h2>
        <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
          {current.description}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {isLast ? (
            <button
              onClick={finish}
              className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              style={{ background: current.color, color: "#fff" }}
            >
              Commencer <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: current.color, color: "#fff" }}
              >
                Suivant <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
