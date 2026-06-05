"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Brain, Globe, Database, TrendingUp, Leaf,
  Radio, Settings, CreditCard, HelpCircle, Zap,
} from "lucide-react";
import { useLangStore } from "@/lib/lang-store";
import { t } from "@/lib/translations";

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLangStore((s) => s.locale);

  const NAV_ITEMS = [
    { labelKey: "nav_dashboard"  as const, href: "/",           icon: BarChart3,  badge: null },
    { labelKey: "nav_ai"         as const, href: "/ai",         icon: Brain,      badge: "AI" },
    { labelKey: "nav_countries"  as const, href: "/countries",  icon: Globe,      badge: null },
    { labelKey: "nav_indicators" as const, href: "/indicators", icon: Database,   badge: null },
    { labelKey: "nav_markets"    as const, href: "/markets",    icon: TrendingUp, badge: null },
    { labelKey: "nav_climate"    as const, href: "/climate",    icon: Leaf,       badge: null },
    { labelKey: "nav_signals"    as const, href: "/signals",    icon: Radio,      badge: "Phase 3", disabled: true },
  ];

  const BOTTOM_ITEMS = [
    { labelKey: "nav_billing"  as const, href: "/billing",  icon: CreditCard },
    { labelKey: "nav_settings" as const, href: "/settings", icon: Settings },
    { labelKey: "nav_help"     as const, href: "/help",     icon: HelpCircle },
  ];

  return (
    <aside
      className="w-60 flex flex-col flex-shrink-0"
      style={{
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--bg-border)",
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--bg-border)" }}>
        <div className="flex items-center gap-3">
          {/* Icône M avec gradient */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #00D4AA 0%, #3B82F6 100%)",
              boxShadow: "0 2px 12px rgba(0,212,170,.35)",
            }}
          >
            <span className="text-white font-black text-base tracking-tight">M</span>
          </div>

          {/* Texte logo */}
          <div>
            <div
              className="font-extrabold text-sm tracking-wide"
              translate="no"
              style={{
                background: "linear-gradient(90deg, #F1F5F9 0%, #94A3B8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              MANSA Terminal
            </div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }} translate="no">
              Africa Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation principale ─────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-disabled)" }}
        >
          Navigation
        </p>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const label = t(item.labelKey, locale);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed select-none"
                style={{ color: "var(--text-disabled)" }}
              >
                <Icon size={15} />
                <span className="text-sm flex-1">{label}</span>
                {item.badge && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "var(--bg-border)", color: "var(--text-disabled)" }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                         ${isActive ? "nav-item-active" : ""}`}
              style={
                isActive
                  ? {}
                  : { color: "var(--text-muted)" }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <Icon
                size={15}
                className={isActive ? "text-[#00D4AA]" : ""}
                style={isActive ? {} : { color: "inherit" }}
              />
              <span className="text-sm font-medium flex-1">{label}</span>
              {item.badge && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                  style={
                    isActive
                      ? { background: "rgba(0,212,170,.15)", color: "#00D4AA" }
                      : { background: "var(--bg-border)", color: "var(--text-secondary)" }
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* ── Divider ── */}
        <div className="mx-2 my-3" style={{ borderTop: "1px solid var(--bg-border)" }} />

        {/* ── Bloc MEAI Index ── */}
        <div
          className="mx-0.5 px-3 py-3 rounded-xl"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,170,0.06) 0%, rgba(59,130,246,0.06) 100%)",
            border: "1px solid rgba(0,212,170,0.12)",
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Zap size={11} style={{ color: "#00D4AA" }} />
            <span className="text-[11px] font-bold tracking-wide" style={{ color: "#00D4AA" }}>
              {t("meai_label", locale)}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {t("meai_desc", locale)}
          </p>
        </div>
      </nav>

      {/* ── Navigation secondaire ─────────────────────────────── */}
      <div
        className="px-2.5 pb-4 pt-3 space-y-0.5"
        style={{ borderTop: "1px solid var(--bg-border)" }}
      >
        <p
          className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-disabled)" }}
        >
          Compte
        </p>

        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-sm
                         ${isActive ? "nav-item-active" : ""}`}
              style={isActive ? {} : { color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
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
      </div>
    </aside>
  );
}
