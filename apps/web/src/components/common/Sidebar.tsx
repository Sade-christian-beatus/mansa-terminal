"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Globe2,
  BarChart2,
  TrendingUp,
  CloudRain,
  Zap,
  Receipt,
  SlidersHorizontal,
  HelpCircle,
  Newspaper,
  Map,
  ShieldAlert,
  Home,
  Gauge,
  GitBranch,
  GitFork,
  Bell,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useLangStore } from "@/lib/lang-store";
import { t, type TKey } from "@/lib/translations";

interface SidebarProps {
  onClose?: () => void;
}

type Item = {
  href: string;
  icon: typeof Home;
  labelKey?: TKey;
  label?: string;
  badge?: string | null;
};

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const locale   = useLangStore((s) => s.locale);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  // ── Définition des groupes ──
  const PRINCIPAL: Item[] = [
    { href: "/accueil", icon: Home,            labelKey: "nav_accueil"   },
    { href: "/",        icon: LayoutDashboard, labelKey: "nav_dashboard" },
    { href: "/ai",      icon: Sparkles,        labelKey: "nav_ai", badge: "AI" },
    { href: "/meai",    icon: Gauge,           labelKey: "nav_meai"      },
  ];

  const ANALYSE: Item[] = [
    { href: "/countries", icon: Globe2,    labelKey: "nav_countries"   },
    { href: "/regions",   icon: Map,       labelKey: "nav_regions"     },
    { href: "/scenarios", icon: GitBranch, labelKey: "nav_predictions" },
  ];

  const MARKETS: Item[] = [
    { href: "/markets",     icon: TrendingUp, labelKey: "nav_markets"     },
    { href: "/indicators",  icon: BarChart2,  labelKey: "nav_indicators"  },
    { href: "/correlation", icon: GitFork,    labelKey: "nav_correlation" },
    { href: "/news",        icon: Newspaper,  labelKey: "nav_news"        },
  ];

  const RISKS: Item[] = [
    { href: "/signals",   icon: Zap,         labelKey: "nav_signals",   badge: "HF"    },
    { href: "/alerts",    icon: Bell,        labelKey: "nav_alerts"                    },
    { href: "/climate",   icon: CloudRain,   labelKey: "nav_climate"                   },
    { href: "/conflicts", icon: ShieldAlert, labelKey: "nav_conflicts", badge: "ACLED" },
  ];

  const NAV_BOTTOM: Item[] = [
    { href: "/billing",  icon: Receipt,           labelKey: "nav_billing"  },
    { href: "/settings", icon: SlidersHorizontal, labelKey: "nav_settings" },
    { href: "/help",     icon: HelpCircle,        labelKey: "nav_help"     },
  ];

  // Le sous-menu Analyse est ouvert par défaut si on est sur l'une de ses pages
  const analyseActive = ANALYSE.some((i) => isActive(i.href));
  const [analyseOpen, setAnalyseOpen] = useState(true);

  const activeStyle   = { background: `color-mix(in srgb, var(--mansa-green) 12%, transparent)`, color: "var(--mansa-green)" };
  const inactiveStyle = { color: "var(--text-muted)" };

  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (!isActive(el.getAttribute("href") ?? "___none")) {
      el.style.background = "var(--sidebar-item-bg)";
      el.style.color = "var(--text-primary)";
    }
  };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (!isActive(el.getAttribute("href") ?? "___none")) {
      el.style.background = "";
      el.style.color = "var(--text-muted)";
    }
  };

  const renderBadge = (badge: string | null | undefined, active: boolean) =>
    badge ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
        style={active
          ? { background: `color-mix(in srgb, var(--mansa-green) 20%, transparent)`, color: "var(--mansa-green)" }
          : { background: "var(--bg-border)", color: "var(--text-muted)" }}>
        {badge}
      </span>
    ) : null;

  const NavLink = ({ item, nested = false }: { item: Item; nested?: boolean }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const label = item.label ?? (item.labelKey ? t(item.labelKey, locale) : "");
    return (
      <Link href={item.href}
        className={`flex items-center gap-3 ${nested ? "pl-9 pr-3 py-2" : "px-3 py-2.5"} rounded-xl transition-all duration-150`}
        style={active ? activeStyle : inactiveStyle}
        onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        <Icon size={nested ? 15 : 17} strokeWidth={active ? 2.2 : 1.8} />
        <span className="text-sm font-medium flex-1">{label}</span>
        {renderBadge(item.badge, active)}
      </Link>
    );
  };

  const GroupLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
       style={{ color: "var(--text-muted)", opacity: 0.5 }}>
      {children}
    </p>
  );

  const Divider = () => (
    <div className="my-3 mx-1 border-t" style={{ borderColor: "var(--sidebar-border)" }} />
  );

  return (
    <aside
      className="w-64 flex flex-col flex-shrink-0 border-r transition-colors duration-200 h-full"
      style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}
    >
      {/* ── Logo ── */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image src="/logo.png" alt="MANSA" fill className="object-contain" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide" style={{ color: "var(--text-primary)" }} translate="no">
              MANSA Terminal
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }} translate="no">
              Africa Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {/* Groupe Principal */}
        <div className="mb-1">
          <GroupLabel>{t("navgrp_principal", locale)}</GroupLabel>
          <div className="space-y-0.5">
            {PRINCIPAL.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        </div>

        <Divider />

        {/* Groupe Analyse — sous-menu dépliable */}
        <div className="mb-1">
          <button
            onClick={() => setAnalyseOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
            style={analyseActive ? activeStyle : inactiveStyle}
            onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
            <BarChart3 size={17} strokeWidth={analyseActive ? 2.2 : 1.8} />
            <span className="text-sm font-medium flex-1 text-left">{t("nav_analyse", locale)}</span>
            {analyseOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {analyseOpen && (
            <div className="space-y-0.5 mt-0.5">
              {ANALYSE.map((item) => <NavLink key={item.href} item={item} nested />)}
            </div>
          )}
        </div>

        <Divider />

        {/* Groupe Marchés & Données */}
        <div className="mb-1">
          <GroupLabel>{t("navgrp_markets", locale)}</GroupLabel>
          <div className="space-y-0.5">
            {MARKETS.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        </div>

        <Divider />

        {/* Groupe Risques & Climat */}
        <div className="mb-1">
          <GroupLabel>{t("navgrp_risks", locale)}</GroupLabel>
          <div className="space-y-0.5">
            {RISKS.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        </div>
      </nav>

      {/* ── Navigation secondaire ── */}
      <div className="px-3 pb-4 border-t pt-3 space-y-0.5" style={{ borderColor: "var(--sidebar-border)" }}>
        {NAV_BOTTOM.map((item) => {
          const Icon   = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-sm"
              style={active ? { color: "var(--mansa-green)" } : { color: "var(--text-muted)" }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              <Icon size={14} />
              {item.labelKey ? t(item.labelKey, locale) : item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
