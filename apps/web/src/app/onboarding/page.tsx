"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Globe2, Sparkles, BarChart3, TrendingUp, Zap,
  ArrowRight, Check, ChevronLeft,
} from "lucide-react";

/* ── Persist l'état onboarding ── */
const ONBOARDING_KEY = "mansa_onboarding_done";

/* ══════════════════════════════════════════════════════════════
   ÉCRANS
══════════════════════════════════════════════════════════════ */
const SCREENS = [
  {
    id: 0,
    icon: Globe2,
    iconColor: "#0ea5a0",
    iconBg: "rgba(14,165,160,0.12)",
    badge: "Bienvenue sur",
    title: "MANSA Terminal",
    subtitle: "Africa's AI-Powered Macro-Fiscal Intelligence Platform",
    desc: "La première plateforme d'intelligence macroéconomique africaine en temps réel — conçue pour les investisseurs, les analystes et les décideurs.",
    visual: "globe",
    features: [
      "54 économies africaines couvertes",
      "Données temps réel · IMF · World Bank",
      "IA générative spécialisée Afrique",
    ],
  },
  {
    id: 1,
    icon: BarChart3,
    iconColor: "#3B82F6",
    iconBg: "rgba(59,130,246,0.12)",
    badge: "Intelligence",
    title: "Macro-économie africaine",
    subtitle: "141 indicateurs · 14 sources de données · Mise à jour quotidienne",
    desc: "PIB, inflation, dette publique, solde courant, réserves de change — toutes les données macro dont vous avez besoin pour analyser les 54 marchés africains.",
    visual: "chart",
    features: [
      "Heatmap interactive de l'Afrique",
      "Séries temporelles 1990–2025",
      "Export CSV / Excel / JSON",
    ],
  },
  {
    id: 2,
    icon: TrendingUp,
    iconColor: "#8B5CF6",
    iconBg: "rgba(139,92,246,0.12)",
    badge: "Marchés",
    title: "Marchés & Analyses",
    subtitle: "FX · Bourses africaines · Eurobonds · Matières premières",
    desc: "Suivez les devises africaines, les indices boursiers (BRVM, NSE, JSE, EGX), les Eurobonds et les matières premières stratégiques en temps réel.",
    visual: "markets",
    features: [
      "10+ paires de devises africaines",
      "8 bourses africaines · Top actions",
      "Signaux haute fréquence (HF)",
    ],
  },
  {
    id: 3,
    icon: Sparkles,
    iconColor: "#F59E0B",
    iconBg: "rgba(245,158,11,0.12)",
    badge: "Intelligence Artificielle",
    title: "MANSA AI",
    subtitle: "Powered by Claude · Spécialisé sur l'Afrique",
    desc: "Posez vos questions macro en langage naturel. MANSA AI analyse la base de données en temps réel et vous génère des rapports économiques professionnels.",
    visual: "ai",
    features: [
      "Analyses macro-fiscales en français/anglais",
      "Risques souverains · Profils pays",
      "Contexte IMF, Banque Mondiale, BCEAO",
    ],
  },
  {
    id: 4,
    icon: Zap,
    iconColor: "#0ea5a0",
    iconBg: "rgba(14,165,160,0.12)",
    badge: "Prêt",
    title: "Commencer l'exploration",
    subtitle: "Votre plateforme est prête",
    desc: "Accédez au dashboard principal pour commencer votre analyse macroéconomique de l'Afrique. Toutes les données sont disponibles immédiatement.",
    visual: "start",
    features: [
      "Dashboard interactif disponible",
      "MANSA AI activé et prêt",
      "Mode sombre / clair configurable",
    ],
  },
] as const;

/* ── Visual illustrations per screen ── */
function ScreenVisual({ type, color }: { type: string; color: string }) {
  if (type === "globe") return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Outer rings */}
      {[1, 0.7, 0.45].map((scale, i) => (
        <div key={i} className="absolute rounded-full border"
             style={{
               width: `${100 * scale}%`, height: `${100 * scale}%`,
               borderColor: `color-mix(in srgb, ${color} ${30 - i * 8}%, transparent)`,
               animation: `spin ${8 + i * 4}s linear infinite`,
             }} />
      ))}
      {/* Center */}
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center z-10"
           style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, border: `2px solid ${color}` }}>
        <Globe2 size={28} style={{ color }} />
      </div>
      {/* Country dots */}
      {[
        { top: "15%", left: "50%", label: "🇳🇬" },
        { top: "35%", left: "15%", label: "🇸🇳" },
        { top: "60%", left: "25%", label: "🇨🇩" },
        { top: "25%", left: "75%", label: "🇪🇬" },
        { top: "65%", left: "70%", label: "🇿🇦" },
        { top: "45%", left: "55%", label: "🇰🇪" },
      ].map((dot, i) => (
        <div key={i} className="absolute text-sm" style={{ top: dot.top, left: dot.left, transform: "translate(-50%,-50%)" }}>
          {dot.label}
        </div>
      ))}
    </div>
  );

  if (type === "chart") return (
    <div className="w-64 h-40 flex items-end gap-1.5 px-3 pb-2">
      {[45, 62, 55, 78, 65, 85, 72, 90, 68, 95].map((h, i) => (
        <div key={i} className="flex-1 rounded-t-md transition-all"
             style={{
               height: `${h}%`,
               background: `linear-gradient(to top, ${color}, color-mix(in srgb, ${color} 50%, transparent))`,
               opacity: 0.7 + i * 0.03,
             }} />
      ))}
    </div>
  );

  if (type === "markets") return (
    <div className="w-64 space-y-2">
      {[
        { pair: "USD/XOF", val: "655.96", change: "+0.0%", pos: true },
        { pair: "USD/NGN", val: "1,620",  change: "-8.2%", pos: false },
        { pair: "BRVM",    val: "296.85", change: "+0.42%", pos: true },
        { pair: "JSE",     val: "82,450", change: "-2.1%", pos: false },
      ].map((row) => (
        <div key={row.pair} className="flex items-center justify-between px-3 py-2 rounded-xl"
             style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span className="text-xs font-mono font-semibold" style={{ color: "#F1F5F9" }}>{row.pair}</span>
          <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>{row.val}</span>
          <span className="text-xs font-bold" style={{ color: row.pos ? "#10B981" : "#EF4444" }}>{row.change}</span>
        </div>
      ))}
    </div>
  );

  if (type === "ai") return (
    <div className="w-64 space-y-2">
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-xs leading-relaxed"
           style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
        Analyse la dette publique du Sénégal sur 10 ans.
      </div>
      <div className="flex gap-1 px-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
               style={{ background: "#F59E0B", animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed ml-4"
           style={{ background: "rgba(14,165,160,0.1)", color: "#94A3B8", border: "1px solid rgba(14,165,160,0.2)" }}>
        <span style={{ color: "#0ea5a0" }}>MANSA AI · </span>
        La dette publique du Sénégal a progressé de 48.2% à 76.3% du PIB entre 2015 et 2024…
      </div>
    </div>
  );

  // start
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <div className="w-24 h-24 rounded-full flex items-center justify-center"
           style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, border: `2px solid ${color}` }}>
        <Zap size={40} style={{ color }} />
      </div>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div key={i} className="absolute w-2 h-2 rounded-full"
             style={{
               background: color,
               top: `calc(50% + ${Math.sin(deg * Math.PI / 180) * 70}px - 4px)`,
               left: `calc(50% + ${Math.cos(deg * Math.PI / 180) * 70}px - 4px)`,
               opacity: 0.6 + i * 0.07,
             }} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE ONBOARDING
══════════════════════════════════════════════════════════════ */
export default function OnboardingPage() {
  const router  = useRouter();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const screen = SCREENS[step];
  const Icon   = screen.icon;
  const isLast = step === SCREENS.length - 1;

  function markDone() {
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_KEY, "1");
    }
    router.push("/");
  }

  function next() {
    if (isLast) { markDone(); return; }
    setExiting(true);
    setTimeout(() => { setStep((s) => s + 1); setExiting(false); }, 200);
  }

  function prev() {
    if (step === 0) return;
    setStep((s) => s - 1);
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft" && step > 0) prev();
      if (e.key === "Escape") markDone();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-5 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${screen.iconColor}, transparent)`, filter: "blur(60px)" }} />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full opacity-5 pointer-events-none"
           style={{ background: "radial-gradient(circle, #3B82F6, transparent)", filter: "blur(40px)" }} />

      {/* Header: Logo + Skip */}
      <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
               style={{ background: "color-mix(in srgb, #0ea5a0 15%, transparent)", border: "1px solid #0ea5a0" }}>
            <Globe2 size={14} style={{ color: "#0ea5a0" }} />
          </div>
          <span className="text-sm font-bold" style={{ color: "#F1F5F9" }} translate="no">MANSA Terminal</span>
        </div>
        <button
          onClick={markDone}
          className="text-sm px-4 py-1.5 rounded-xl transition-colors"
          style={{ color: "#64748B", border: "1px solid var(--bg-border)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
        >
          Ignorer
        </button>
      </div>

      {/* Main card */}
      <div
        className="relative w-full max-w-2xl rounded-3xl p-8 md:p-12 transition-all duration-200"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--bg-border)",
          opacity: exiting ? 0 : 1,
          transform: exiting ? "translateY(8px)" : "translateY(0)",
        }}
      >
        {/* Badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: screen.iconBg }}>
            <Icon size={16} style={{ color: screen.iconColor }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: screen.iconColor }}>
            {screen.badge}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left: text */}
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#F1F5F9" }}>
              {screen.title}
            </h1>
            <p className="text-sm font-medium mb-4" style={{ color: screen.iconColor }}>
              {screen.subtitle}
            </p>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#94A3B8" }}>
              {screen.desc}
            </p>

            {/* Feature checklist */}
            <div className="space-y-2.5">
              {screen.features.map((feat, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: `color-mix(in srgb, ${screen.iconColor} 15%, transparent)` }}>
                    <Check size={11} style={{ color: screen.iconColor }} />
                  </div>
                  <span className="text-sm" style={{ color: "#CBD5E1" }}>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: visual */}
          <div className="flex items-center justify-center">
            <ScreenVisual type={screen.visual} color={screen.iconColor} />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 w-full max-w-2xl flex items-center justify-between">
        {/* Back */}
        <button
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all"
          style={{
            opacity: step === 0 ? 0 : 1,
            pointerEvents: step === 0 ? "none" : "auto",
            color: "#64748B", border: "1px solid var(--bg-border)",
          }}
        >
          <ChevronLeft size={14} /> Retour
        </button>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                background: i === step ? screen.iconColor : i < step ? "#374151" : "var(--bg-border)",
              }}
            />
          ))}
        </div>

        {/* Next / Start */}
        <button
          onClick={next}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: screen.iconColor, color: "var(--bg-primary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(1.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
        >
          {isLast ? "Commencer" : "Suivant"}
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Step counter */}
      <p className="mt-4 text-[11px]" style={{ color: "#475569" }}>
        {step + 1} / {SCREENS.length}
      </p>
    </div>
  );
}
