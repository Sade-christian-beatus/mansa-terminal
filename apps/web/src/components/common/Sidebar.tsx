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
  Bell,
  UserCircle2,
  Sun,
  Moon,
  Activity,
} from "lucide-react";
import { useLangStore } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";

export function Sidebar() {
  const pathname = usePathname();
  const locale   = useLangStore((s) => s.locale);
  const { theme, toggle } = useThemeStore();
  const isDark   = theme === "dark";

  const NAV_ITEMS = [
    { labelKey: "nav_dashboard"  as const, href: "/",           icon: LayoutDashboard, badge: null       },
    { labelKey: "nav_ai"         as const, href: "/ai",          icon: Sparkles,        badge: "AI"       },
    { labelKey: "nav_countries"  as const, href: "/countries",   icon: Globe2,          badge: null       },
    { labelKey: "nav_indicators" as const, href: "/indicators",  icon: BarChart2,       badge: null       },
    { labelKey: "nav_markets"    as const, href: "/markets",     icon: TrendingUp,     badge: null       },
    { labelKey: "nav_signals"    as const, href: "/signals",     icon: Zap,             badge: "HF"       },
    { labelKey: "nav_climate"    as const, href: "/climate",     icon: CloudRain,       badge: null       },
  ];

  const BOTTOM_ITEMS = [
    { labelKey: "nav_notifications" as const, href: "/notifications", icon: Bell        },
    { labelKey: "nav_billing"       as const, href: "/billing",       icon: Receipt     },
    { labelKey: "nav_settings"      as const, href: "/settings",      icon: SlidersHorizontal },
    { labelKey: "nav_help"          as const, href: "/help",          icon: HelpCircle  },
    { labelKey: "nav_profile"       as const, href: "/profile",       icon: UserCircle2 },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <aside
      className="w-64 flex flex-col flex-shrink-0 border-r transition-colors duration-200"
      style={{
        background: "var(--sidebar-bg)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image src="/logo.png" alt="MANSA" fill className="object-contain" />
          </div>
          <div>
            <div
              className="font-bold text-sm tracking-wide"
              style={{ color: "var(--text-primary)" }}
              translate="no"
            >
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
        {NAV_ITEMS.map((item) => {
          const Icon   = item.icon;
          const active = isActive(item.href);
          const label  = t(item.labelKey, locale);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
              style={
                active
                  ? {
                      background: `color-mix(in srgb, var(--mansa-green) 12%, transparent)`,
                      color: "var(--mansa-green)",
                    }
                  : { color: "var(--text-muted)" }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-sm font-medium flex-1">{label}</span>
              {item.badge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                  style={
                    active
                      ? {
                          background: `color-mix(in srgb, var(--mansa-green) 20%, transparent)`,
                          color: "var(--mansa-green)",
                        }
                      : { background: "var(--bg-border)", color: "var(--text-muted)" }
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* ── Divider + MEAI Index ── */}
        <div className="my-3 mx-1 border-t" style={{ borderColor: "var(--sidebar-border)" }} />

        <div
          className="px-3 py-3 rounded-xl mx-0"
          style={{ background: "var(--bg-border)", border: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Activity size={12} style={{ color: "var(--mansa-green)" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--mansa-green)" }}>
              {t("meai_label", locale)}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t("meai_desc", locale)}
          </p>
        </div>
      </nav>

      {/* ── Navigation secondaire + Theme toggle ── */}
      <div
        className="px-3 pb-3 border-t pt-3 space-y-0.5"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {BOTTOM_ITEMS.map((item) => {
          const Icon   = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-sm"
              style={
                active
                  ? { color: "var(--mansa-green)", background: `color-mix(in srgb, var(--mansa-green) 10%, transparent)` }
                  : { color: "var(--text-muted)" }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <Icon size={14} />
              {t(item.labelKey, locale)}
            </Link>
          );
        })}

        {/* ── Dark / Light toggle ── */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-sm mt-1"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "";
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          <span>{isDark ? t("theme_light", locale) : t("theme_dark", locale)}</span>
        </button>
      </div>
    </aside>
  );
}
