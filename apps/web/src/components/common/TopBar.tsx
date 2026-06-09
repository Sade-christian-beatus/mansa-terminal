"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, X, Sun, Moon, UserCircle2, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";

const NOTIFS = [
  { id: 1, title: "FMI WEO mis à jour",        desc: "Nouvelles projections macro Q1 2025",           time: "2h",  dot: "bg-[#00D4AA]",  unread: true  },
  { id: 2, title: "World Bank WDI",             desc: "70 indicateurs rafraîchis — 54 pays",           time: "4h",  dot: "bg-blue-400",   unread: true  },
  { id: 3, title: "WHO GHO",                    desc: "Données santé Afrique sub-saharienne",          time: "1j",  dot: "bg-purple-400", unread: true  },
  { id: 4, title: "Alerte souveraine",           desc: "Éthiopie : restructuration dette en cours",    time: "1j",  dot: "bg-amber-400",  unread: false },
  { id: 5, title: "MANSA Research",             desc: "Nouveau rapport : AfCFTA — État d'avancement", time: "2j",  dot: "bg-teal-400",   unread: false },
];

export function TopBar() {
  const { email, fullName, logout } = useAuthStore();
  const locale = useLangStore((s) => s.locale);
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  const displayName = fullName || email?.split("@")[0] || "Utilisateur";
  const initials    = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const unreadCount = NOTIFS.filter((n) => n.unread).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (menuRef.current  && !menuRef.current.contains(e.target as Node))  setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="h-14 px-6 flex items-center justify-between flex-shrink-0 z-30 relative border-b transition-colors duration-200"
      style={{ background: "var(--topbar-bg)", borderColor: "var(--topbar-border)" }}
    >
      {/* ── Titre de page / Breadcrumb (espace gauche) ── */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--mansa-green)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Données live · IMF · Banque Mondiale
          </span>
        </div>
      </div>

      {/* ── Côté droit ── */}
      <div className="flex items-center gap-2">

        {/* ── Theme toggle ── */}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
          title={isDark ? "Mode clair" : "Mode sombre"}
          style={{ color: "var(--text-muted)", background: "var(--input-bg)", border: "1px solid var(--input-border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mansa-green)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* ── Notifications ── */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: "var(--text-muted)", background: "var(--input-bg)", border: "1px solid var(--input-border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center font-bold"
                style={{ background: "var(--mansa-green)" }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden border animate-fade-in"
              style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--bg-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white" style={{ background: "var(--mansa-green)" }}>
                      {unreadCount}
                    </span>
                  )}
                </p>
                <button onClick={() => setNotifOpen(false)} style={{ color: "var(--text-muted)" }}>
                  <X size={14} />
                </button>
              </div>

              <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: "var(--bg-border)" }}>
                {NOTIFS.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                    style={{ opacity: n.unread ? 1 : 0.7 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{n.desc}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Il y a {n.time}</p>
                    </div>
                    {n.unread && <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: "var(--mansa-green)" }} />}
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 border-t flex justify-between items-center" style={{ borderColor: "var(--bg-border)" }}>
                <Link
                  href="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--mansa-green)" }}
                >
                  Voir toutes →
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs hover:underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  Paramètres
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Séparateur ── */}
        <div className="w-px h-6 mx-1" style={{ background: "var(--bg-border)" }} />

        {/* ── Menu utilisateur ── */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2.5 cursor-pointer px-2 py-1 rounded-xl transition-all duration-150"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}
            >
              {initials || <UserCircle2 size={14} />}
            </div>
            <div className="text-xs text-left hidden sm:block">
              <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{displayName}</div>
              <div className="truncate max-w-[120px]" style={{ color: "var(--text-muted)" }}>{email}</div>
            </div>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-52 rounded-2xl shadow-xl border py-1.5 animate-fade-in"
              style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)" }}
            >
              <div className="px-4 py-2 border-b mb-1" style={{ borderColor: "var(--bg-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{displayName}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{email}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              >
                <Settings size={14} />
                Paramètres
              </Link>
              <div className="my-1 border-t" style={{ borderColor: "var(--bg-border)" }} />
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-red-400"
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <LogOut size={14} />
                {t("topbar_logout", locale)}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
