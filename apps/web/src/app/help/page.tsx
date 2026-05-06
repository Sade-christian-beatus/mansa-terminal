"use client";

import { useState } from "react";
import {
  BookOpen, Brain, Globe, BarChart3, Zap,
  ChevronDown, ChevronRight, ExternalLink, Mail,
} from "lucide-react";

const FAQS = [
  {
    q: "D'où proviennent les données macro-économiques ?",
    a: "Les données proviennent de deux sources principales : le FMI (World Economic Outlook — WEO) et la Banque Mondiale (World Development Indicators — WDI). Les données sont rafraîchies automatiquement : quotidiennement pour les taux de change, hebdomadairement pour les indicateurs de marché, et mensuellement pour les agrégats macro.",
  },
  {
    q: "Comment fonctionne l'AI Analyst ?",
    a: "L'AI Analyst est alimenté par Claude (Anthropic). Il dispose d'un contexte enrichi avec les données macro en temps réel de vos pays d'intérêt. Posez vos questions en langage naturel — l'IA génère une analyse structurée, cite ses sources et peut comparer plusieurs économies.",
  },
  {
    q: "Quelle est la couverture géographique ?",
    a: "MANSA Terminal couvre les 54 États membres de l'Union Africaine, organisés en 5 régions : Afrique du Nord, Afrique de l'Ouest, Afrique Centrale, Afrique de l'Est, et Afrique Australe.",
  },
  {
    q: "Puis-je exporter les données ?",
    a: "Oui. Les plans Starter et supérieurs permettent l'export CSV. Les plans Professional et Enterprise permettent également l'export Excel et PDF, ainsi qu'un accès direct à l'API REST.",
  },
  {
    q: "Qu'est-ce que le MEAI Index ?",
    a: "Le MANSA Economic Activity Index (MEAI) est un indicateur propriétaire de haute fréquence qui agrège des signaux alternatifs (données satellitaires VIIRS nightlights, ACLED, données portuaires IMF PortWatch) pour estimer l'activité économique réelle en temps quasi-réel. Disponible en Phase 3.",
  },
];

const GUIDES = [
  {
    icon: BarChart3,
    title: "Macro Dashboard",
    description: "Naviguez la heatmap africaine, sélectionnez un indicateur et explorez les séries temporelles.",
    steps: [
      "Sélectionnez un indicateur dans le menu déroulant (GDP Growth, Inflation…)",
      "Choisissez l'année avec le sélecteur à droite",
      "Survolez un pays sur la heatmap pour voir sa valeur",
      "Cliquez sur un pays pour accéder à son analyse complète",
    ],
  },
  {
    icon: Brain,
    title: "AI Analyst",
    description: "Posez des questions en langage naturel sur l'économie africaine.",
    steps: [
      "Tapez votre question dans le champ en bas (ex : « Compare le déficit budgétaire du Sénégal et du Maroc »)",
      "L'IA streame sa réponse en temps réel avec des données factuelles",
      "Retrouvez l'historique de vos analyses dans le panneau de gauche",
      "Chaque réponse cite les indicateurs et sources utilisés",
    ],
  },
  {
    icon: Globe,
    title: "Country Deep Dive",
    description: "Analyse approfondie pays par pays avec KPIs, tendances et comparaisons régionales.",
    steps: [
      "Utilisez la barre de recherche ou filtrez par région",
      "Cliquez sur un pays pour accéder à sa fiche complète",
      "Les KPIs sont calculés sur la dernière année disponible",
      "Les graphiques affichent les 10 dernières années par défaut",
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1E2A42] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="text-sm text-gray-200 font-medium">{q}</span>
        {open
          ? <ChevronDown size={15} className="text-[#00D4AA] shrink-0" />
          : <ChevronRight size={15} className="text-gray-500 shrink-0" />
        }
      </button>
      {open && (
        <p className="text-sm text-gray-400 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [activeGuide, setActiveGuide] = useState(0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Aide & Documentation</h1>
        <p className="text-gray-400 text-sm mt-1">
          Tout ce qu&apos;il faut savoir pour tirer le meilleur de MANSA Terminal
        </p>
      </div>

      {/* Guides rapides */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Guides rapides
        </h2>

        <div className="flex gap-2">
          {GUIDES.map((g, i) => {
            const Icon = g.icon;
            return (
              <button
                key={i}
                onClick={() => setActiveGuide(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors
                             ${activeGuide === i
                               ? "bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/30"
                               : "text-gray-400 bg-[#141B2E] hover:text-gray-200 border border-transparent"}`}
              >
                <Icon size={14} />
                {g.title}
              </button>
            );
          })}
        </div>

        <div className="bg-[#0F1629] border border-[#1E2A42] rounded-xl p-6">
          {(() => {
            const guide = GUIDES[activeGuide];
            const Icon = guide.icon;
            return (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/10 flex items-center justify-center">
                    <Icon size={16} className="text-[#00D4AA]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{guide.title}</h3>
                    <p className="text-xs text-gray-500">{guide.description}</p>
                  </div>
                </div>
                <ol className="space-y-2 mt-4">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                      <span className="w-5 h-5 rounded-full bg-[#1E2A42] text-[#00D4AA] text-xs
                                       flex items-center justify-center shrink-0 mt-0.5 font-semibold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </>
            );
          })()}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Questions fréquentes
        </h2>
        <div className="bg-[#0F1629] border border-[#1E2A42] rounded-xl px-6">
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>

      {/* Ressources & contact */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#0F1629] border border-[#1E2A42] rounded-xl p-5 hover:border-[#00D4AA]/30
                     transition-colors flex items-center gap-4 group"
        >
          <div className="w-9 h-9 rounded-lg bg-[#1E2A42] flex items-center justify-center">
            <BookOpen size={16} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Documentation API</p>
            <p className="text-xs text-gray-500 mt-0.5">Swagger — /docs</p>
          </div>
          <ExternalLink size={13} className="text-gray-600 group-hover:text-[#00D4AA]" />
        </a>

        <a
          href="mailto:support@mansa.ai"
          className="bg-[#0F1629] border border-[#1E2A42] rounded-xl p-5 hover:border-[#00D4AA]/30
                     transition-colors flex items-center gap-4 group"
        >
          <div className="w-9 h-9 rounded-lg bg-[#1E2A42] flex items-center justify-center">
            <Mail size={16} className="text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Support</p>
            <p className="text-xs text-gray-500 mt-0.5">support@mansa.ai</p>
          </div>
          <Zap size={13} className="text-gray-600 group-hover:text-[#00D4AA]" />
        </a>
      </div>
    </div>
  );
}
