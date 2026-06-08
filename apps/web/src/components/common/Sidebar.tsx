"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3, Brain, Globe, Database, TrendingUp, Leaf,
  Radio, Settings, CreditCard, HelpCircle,
} from "lucide-react";
import { useLangStore } from "@/lib/lang-store";
import { t } from "@/lib/translations";

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLangStore((s) => s.locale);

  const NAV_ITEMS = [
    { labelKey: "nav_dashboard" as const, href: "/",         icon: BarChart3, badge: null },
    { labelKey: "nav_ai"        as const, href: "/ai",       icon: Brain,     badge: "NEW" },
    { labelKey: "nav_countries"   as const, href: "/countries",   icon: Globe,     badge: null },
    { labelKey: "nav_indicators"  as const, href: "/indicators",  icon: Database,  badge: null },
    { labelKey: "nav_markets"     as const, href: "/markets",     icon: TrendingUp, badge: null },
    { labelKey: "nav_climate"     as const, href: "/climate",     icon: Leaf,       badge: null },
    { labelKey: "nav_signals"   as const, href: "/signals",  icon: Radio,     badge: "Phase 3", disabled: true },
  ];

  const BOTTOM_ITEMS = [
    { labelKey: "nav_billing"  as const, href: "/billing",  icon: CreditCard },
    { labelKey: "nav_settings" as const, href: "/settings", icon: Settings },
    { labelKey: "nav_help"     as const, href: "/help",     icon: HelpCircle },
  ];

  return (
    <aside className="w-64 bg-[#0F1629] border-r border-[#1E2A42] flex flex-col
                      flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1E2A42]">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="MANSA"
              fill
              className="object-contain"
            />
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-wide" translate="no">
              MANSA Terminal
            </div>
            <div className="text-gray-500 text-xs" translate="no">Africa Intelligence</div>
          </div>
        </div>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const label = t(item.labelKey, locale);

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg
                           text-gray-600 cursor-not-allowed"
              >
                <Icon size={16} />
                <span className="text-sm">{label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded
                                   bg-[#1E2A42] text-gray-600">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                         transition-colors duration-150 ${
                isActive
                  ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                  : "text-gray-400 hover:bg-[#141B2E] hover:text-gray-200"
              }`}
            >
              <Icon size={16} />
              <span className="text-sm font-medium">{label}</span>
              {item.badge && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded
                                 font-medium ${
                  isActive
                    ? "bg-[#00D4AA]/20 text-[#00D4AA]"
                    : "bg-[#1E2A42] text-gray-400"
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="border-t border-[#1E2A42] my-2 mx-1" />

        {/* MEAI Index */}
        <div className="px-3 py-3 rounded-lg bg-gradient-to-r from-[#00D4AA]/5
                        to-[#3B82F6]/5 border border-[#1E2A42]">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={12} className="text-[#00D4AA]" />
            <span className="text-xs font-semibold text-[#00D4AA]">
              {t("meai_label", locale)}
            </span>
          </div>
          <p className="text-xs text-gray-500">{t("meai_desc", locale)}</p>
        </div>
      </nav>

      {/* Navigation secondaire */}
      <div className="px-3 pb-4 border-t border-[#1E2A42] pt-3 space-y-1">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg
                         text-gray-500 hover:text-gray-300 hover:bg-[#141B2E]
                         transition-colors text-sm"
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
