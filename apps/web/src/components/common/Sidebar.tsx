"use client";

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
  Activity,
  Newspaper,
  BookOpen,
  Map,
  Bell,
  GitBranch,
  GitFork,
  ShieldAlert,
} from "lucide-react";
import { useLangStore } from "@/lib/lang-store";
import { t } from "@/lib/translations";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const locale   = useLangStore((s) => s.locale);

  const NAV_MAIN = [
    { labelKey: "nav_dashboard"  as const, href: "/",          icon: LayoutDashboard, badge: null },
    { labelKey: "nav_ai"         as const, href: "/ai",         icon: Sparkles,        badge: "AI" },
    { labelKey: "nav_news"       as const, href: "/news",       icon: Newspaper,       badge: null },
    { labelKey: "nav_countries"  as const, href: "/countries",  icon: Globe2,          badge: null },
    { labelKey: "nav_indicators" as const, href: "/indicators", icon: BarChart2,       badge: null },
    { labelKey: "nav_markets"    as const, href: "/markets",    icon: TrendingUp,      badge: null },
    { labelKey: "nav_signals"    as const, href: "/signals",    icon: Zap,             badge: "HF" },
    { labelKey: "nav_climate"    as const, href: "/climate",    icon: CloudRain,       badge: null },
  ];

  const NAV_BOTTOM = [
    { labelKey: "nav_billing"  as const, href: "/billing",  icon: Receipt           },
    { labelKey: "nav_settings" as const, href: "/settings", icon: SlidersHorizontal },
    { labelKey: "nav_help"     as const, href: "/help",     icon: HelpCircle        },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  const activeStyle = { background: `color-mix(in srgb, var(--mansa-green) 12%, transparent)`, color: "var(--mansa-green)" };
  const inactiveStyle = { color: "var(--text-muted)" };

  const hoverIn  = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (!isActive(el.getAttribute("href") ?? "")) {
      el.style.background = "var(--sidebar-item-bg)";
      el.style.color = "var(--text-primary)";
    }
  };
  const hoverOut = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (!isActive(el.getAttribute("href") ?? "")) {
      el.style.background = "";
      el.style.color = "var(--text-muted)";
    }
  };

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

      {/* ── Navigation principale ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map((item) => {
          const Icon   = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
              style={active ? activeStyle : inactiveStyle}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-sm font-medium flex-1">{t(item.labelKey, locale)}</span>
              {item.badge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                  style={
                    active
                      ? { background: `color-mix(in srgb, var(--mansa-green) 20%, transparent)`, color: "var(--mansa-green)" }
                      : { background: "var(--bg-border)", color: "var(--text-muted)" }
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* ── Séparateur + MEAI Index ── */}
        <div className="my-3 mx-1 border-t" style={{ borderColor: "var(--sidebar-border)" }} />

        <Link
          href="/meai"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/meai") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <Activity size={17} strokeWidth={isActive("/meai") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">{t("meai_label", locale)}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
            style={
              isActive("/meai")
                ? { background: `color-mix(in srgb, var(--mansa-green) 20%, transparent)`, color: "var(--mansa-green)" }
                : { background: "var(--bg-border)", color: "var(--text-muted)" }
            }
          >
            NEW
          </span>
        </Link>

        {/* ── Séparateur + Régions UEMOA/CEMAC + Alertes + Scénarios ── */}
        <div className="my-3 mx-1 border-t" style={{ borderColor: "var(--sidebar-border)" }} />

        <Link
          href="/regions"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/regions") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <Map size={17} strokeWidth={isActive("/regions") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">Régions</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
            style={
              isActive("/regions")
                ? { background: `color-mix(in srgb, var(--mansa-green) 20%, transparent)`, color: "var(--mansa-green)" }
                : { background: "var(--bg-border)", color: "var(--text-muted)" }
            }
          >
            UEMOA
          </span>
        </Link>

        <Link
          href="/alerts"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/alerts") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <Bell size={17} strokeWidth={isActive("/alerts") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">Alertes</span>
        </Link>

        <Link
          href="/scenarios"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/scenarios") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <GitBranch size={17} strokeWidth={isActive("/scenarios") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">Scénarios</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
            style={
              isActive("/scenarios")
                ? { background: `color-mix(in srgb, var(--mansa-green) 20%, transparent)`, color: "var(--mansa-green)" }
                : { background: "var(--bg-border)", color: "var(--text-muted)" }
            }
          >
            NEW
          </span>
        </Link>

        <Link
          href="/correlation"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/correlation") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <GitFork size={17} strokeWidth={isActive("/correlation") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">Corrélation</span>
        </Link>

        <Link
          href="/conflicts"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/conflicts") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <ShieldAlert size={17} strokeWidth={isActive("/conflicts") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">Conflits</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
            style={
              isActive("/conflicts")
                ? { background: `color-mix(in srgb, #EF4444 20%, transparent)`, color: "#EF4444" }
                : { background: "var(--bg-border)", color: "var(--text-muted)" }
            }
          >
            ACLED
          </span>
        </Link>

        {/* ── Séparateur + Dictionnaire ── */}
        <div className="my-3 mx-1 border-t" style={{ borderColor: "var(--sidebar-border)" }} />

        <Link
          href="/settings/dictionary"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={isActive("/settings/dictionary") ? activeStyle : inactiveStyle}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          <BookOpen size={17} strokeWidth={isActive("/settings/dictionary") ? 2.2 : 1.8} />
          <span className="text-sm font-medium flex-1">{t("nav_dictionary", locale)}</span>
        </Link>
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
              {t(item.labelKey, locale)}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
