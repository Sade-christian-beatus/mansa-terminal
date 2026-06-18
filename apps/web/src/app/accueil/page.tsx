"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Globe2, Sparkles, BarChart2, TrendingUp, Map, ShieldAlert,
  CloudRain, Zap, Database, ArrowRight, CheckCircle2,
} from "lucide-react";
import { ImageWithFallback } from "@/components/common/ImageWithFallback";

const STATS = [
  { value: "54",  label: "Économies africaines",    color: "var(--mansa-green)" },
  { value: "141", label: "Indicateurs macro",        color: "#3B82F6"            },
  { value: "14",  label: "Sources de données",       color: "#F59E0B"            },
  { value: "24h", label: "Fréquence de mise à jour", color: "#EC4899"            },
];

const FEATURES = [
  {
    icon: Globe2,
    color: "#00D4AA",
    title: "54 Pays africains",
    desc: "Couverture complète du continent : indicateurs macro, fiscaux, monétaires et sociaux pour chaque économie.",
    href: "/countries",
    cta: "Explorer les pays",
  },
  {
    icon: Sparkles,
    color: "#8B5CF6",
    title: "MANSA AI",
    desc: "Posez vos questions économiques en langage naturel. L'IA analyse les données et génère des insights contextualisés.",
    href: "/ai",
    cta: "Lancer l'analyse IA",
  },
  {
    icon: BarChart2,
    color: "#3B82F6",
    title: "141 Indicateurs",
    desc: "PIB, inflation, dette, balance commerciale, IDH, chômage, accès à l'électricité… Visualisez les tendances de 2000 à 2025.",
    href: "/indicators",
    cta: "Voir les indicateurs",
  },
  {
    icon: TrendingUp,
    color: "#F59E0B",
    title: "Marchés africains",
    desc: "BRVM, NGX, JSE, EGX. Taux de change, Eurobonds, matières premières, énergie. Données quasi-temps réel.",
    href: "/markets",
    cta: "Voir les marchés",
  },
  {
    icon: Map,
    color: "#10B981",
    title: "Analyse régionale",
    desc: "8 Communautés Économiques Régionales (CEDEAO, SADC, EAC, COMESA…) + Alliance des États du Sahel. Critères de convergence.",
    href: "/regions",
    cta: "Analyse CER",
  },
  {
    icon: ShieldAlert,
    color: "#EF4444",
    title: "Conflits & Risques",
    desc: "Carte des conflits armés, niveaux de risque pays, groupes actifs et tendances 2024. Données ACLED.",
    href: "/conflicts",
    cta: "Évaluation des risques",
  },
  {
    icon: CloudRain,
    color: "#06B6D4",
    title: "Climat & Catastrophes",
    desc: "Sécheresses, inondations, cyclones et impacts sur les économies africaines. Données NASA, FAO, EM-DAT.",
    href: "/climate",
    cta: "Risques climatiques",
  },
  {
    icon: Zap,
    color: "#A78BFA",
    title: "Signaux haute fréquence",
    desc: "Alertes en temps réel : mouvements de prix, tensions sécuritaires, météo extrême et signaux économiques avancés.",
    href: "/signals",
    cta: "Voir les signaux",
  },
];

const DATA_SOURCES = [
  "FMI World Economic Outlook", "Banque Mondiale WDI", "BCEAO", "BEAC",
  "Banque Africaine de Développement", "ACLED", "NASA VIIRS", "UN Comtrade",
  "OMS GHO", "OIT", "FAO IPC", "EIA", "OCDE DAC", "EM-DAT",
];

export default function AccueilPage() {
  return (
    <div className="space-y-12 animate-fade-in pb-12">

      {/* ── Hero ── */}
      <div
        className="relative rounded-3xl overflow-hidden px-8 py-14 text-center"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--mansa-green) 8%, var(--card-bg)) 0%, var(--card-bg) 60%)",
          border: "1px solid color-mix(in srgb, var(--mansa-green) 15%, var(--bg-border))",
        }}
      >
        {/* Image de fond (IA) + voile de lisibilité */}
        <ImageWithFallback
          src="/images/hero-africa.jpg"
          alt="Skyline d'une métropole africaine au crépuscule"
          priority
          className="absolute inset-0"
          imgClassName="object-cover opacity-30"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 55%, transparent), color-mix(in srgb, var(--card-bg) 88%, transparent))" }}
        />

        <div className="relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <Image src="/logo.png" alt="MANSA Terminal" fill className="object-contain drop-shadow-[0_0_30px_rgba(0,212,170,0.4)]" />
          </div>
        </div>

        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 border"
          style={{ background: "color-mix(in srgb, var(--mansa-green) 10%, transparent)", borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)", color: "var(--mansa-green)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Plateforme d'intelligence macro-fiscale africaine
        </div>

        <h1 className="text-4xl font-bold mb-4 leading-tight" style={{ color: "var(--text-primary)" }}>
          Décisions stratégiques
          <br />
          <span style={{ color: "var(--mansa-green)" }}>fondées sur les données</span>
        </h1>

        <p className="text-base max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          MANSA Terminal agrège les données macroéconomiques de 54 pays africains en temps réel.
          Analyse IA, visualisations interactives, alertes de risques — tout ce qu'il vous faut pour comprendre les économies africaines.
        </p>

        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/" className="mansa-btn-primary flex items-center gap-2 px-6 py-2.5">
            <BarChart2 size={15} />
            Ouvrir le Dashboard
          </Link>
          <Link href="/ai" className="mansa-btn-ghost flex items-center gap-2 px-6 py-2.5">
            <Sparkles size={15} />
            Essayer MANSA AI
          </Link>
        </div>
        </div>
      </div>

      {/* ── Statistiques clés ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="mansa-card rounded-2xl p-5 text-center">
            <div className="text-4xl font-bold font-mono mb-1" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Fonctionnalités ── */}
      <div>
        <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
          Ce que vous pouvez faire avec MANSA Terminal
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.href} className="mansa-card rounded-2xl p-5 flex flex-col gap-3 group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${f.color} 12%, transparent)` }}
                >
                  <Icon size={18} style={{ color: f.color }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</p>
                </div>
                <Link
                  href={f.href}
                  className="mt-auto flex items-center gap-1.5 text-xs font-semibold hover:gap-2.5 transition-all"
                  style={{ color: f.color }}
                >
                  {f.cta} <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bande visuelle Données / IA ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            src: "/images/accueil-data.jpg",
            from: "var(--mansa-green)", to: "#0EA5A0",
            icon: BarChart2,
            badge: "Données",
            title: "141 indicateurs, 54 pays, en temps réel",
            desc: "Séries macro, fiscales et monétaires harmonisées — FMI, Banque Mondiale, banques centrales africaines.",
            href: "/indicators", cta: "Explorer les données",
          },
          {
            src: "/images/accueil-ai.jpg",
            from: "#8B5CF6", to: "#3B82F6",
            icon: Sparkles,
            badge: "Intelligence",
            title: "MANSA AI, spécialisé sur l'Afrique",
            desc: "Posez vos questions macro en langage naturel : l'IA lit la base et rédige des analyses sourcées.",
            href: "/ai", cta: "Lancer l'analyse IA",
          },
        ].map((b) => {
          const Icon = b.icon;
          return (
            <Link key={b.href} href={b.href}
              className="mansa-card rounded-2xl overflow-hidden group relative flex flex-col">
              <div className="relative h-40">
                <ImageWithFallback src={b.src} alt={b.title} from={b.from} to={b.to}
                  className="absolute inset-0" imgClassName="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--card-bg) 92%, transparent))" }} />
                <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{ background: "color-mix(in srgb, var(--card-bg) 70%, transparent)", color: b.from, border: `1px solid color-mix(in srgb, ${b.from} 40%, transparent)` }}>
                  <Icon size={12} /> {b.badge}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-base mb-1" style={{ color: "var(--text-primary)" }}>{b.title}</h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>{b.desc}</p>
                <span className="flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2.5 transition-all" style={{ color: b.from }}>
                  {b.cta} <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Sources de données ── */}
      <div className="mansa-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} style={{ color: "var(--mansa-green)" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Sources de données intégrées
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATA_SOURCES.map((src) => (
            <div
              key={src}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border"
              style={{ background: "var(--input-bg)", borderColor: "var(--bg-border)", color: "var(--text-secondary)" }}
            >
              <CheckCircle2 size={10} style={{ color: "var(--mansa-green)", flexShrink: 0 }} />
              {src}
            </div>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          Données mises à jour quotidiennement (taux de change), hebdomadairement et mensuellement selon les sources. Pipelines Dagster automatisés.
        </p>
      </div>

      {/* ── CTA final ── */}
      <div
        className="rounded-2xl p-8 text-center border"
        style={{
          background: "color-mix(in srgb, var(--mansa-green) 5%, var(--card-bg))",
          borderColor: "color-mix(in srgb, var(--mansa-green) 20%, var(--bg-border))",
        }}
      >
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Prêt à analyser les économies africaines ?
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Explorez le dashboard ou posez directement votre question à MANSA AI.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link href="/countries" className="mansa-btn-primary flex items-center gap-2 px-5 py-2.5">
            <Globe2 size={14} />
            Explorer les 54 pays
          </Link>
          <Link href="/ai" className="mansa-btn-ghost flex items-center gap-2 px-5 py-2.5">
            <Sparkles size={14} />
            MANSA AI
          </Link>
        </div>
      </div>
    </div>
  );
}
