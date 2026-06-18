"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, X, Sun, Moon, UserCircle2, LogOut, Settings, AlertTriangle, Menu, RefreshCw, Check } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { macroApi, alertsApi } from "@/lib/api";

const NOTIFS = [
  { id: 1, title: "FMI WEO mis à jour",        desc: "Nouvelles projections macro Q1 2025",           time: "2h",  dot: "bg-[#00D4AA]",  unread: true  },
  { id: 2, title: "World Bank WDI",             desc: "70 indicateurs rafraîchis — 54 pays",           time: "4h",  dot: "bg-blue-400",   unread: true  },
  { id: 3, title: "WHO GHO",                    desc: "Données santé Afrique sub-saharienne",          time: "1j",  dot: "bg-purple-400", unread: true  },
  { id: 4, title: "Alerte souveraine",           desc: "Éthiopie : restructuration dette en cours",    time: "1j",  dot: "bg-amber-400",  unread: false },
  { id: 5, title: "MANSA Research",             desc: "Nouveau rapport : AfCFTA — État d'avancement", time: "2j",  dot: "bg-teal-400",   unread: false },
];

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { email, fullName, logout } = useAuthStore();
  const locale = useLangStore((s) => s.locale);
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [refreshState, setRefreshState] = useState<"idle" | "loading" | "done">("idle");

  const queryClient = useQueryClient();
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  const displayName = fullName || email?.split("@")[0] || "Utilisateur";
  const initials    = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const unreadCount = NOTIFS.filter((n) => n.unread).length;

  const { data: freshness } = useQuery({
    queryKey: ["data-freshness"],
    queryFn: () => macroApi.getFreshness(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["macro-alerts-count"],
    queryFn: () => alertsApi.getMacroAlerts({ severity: "critical,high", limit: 5 }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const criticalCount = alertsData?.summary?.critical ?? 0;
  const highCount     = alertsData?.summary?.high ?? 0;
  const totalAlerts   = criticalCount + highCount;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (menuRef.current  && !menuRef.current.contains(e.target as Node))  setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Actualisation générale des données ──
  async function handleRefresh() {
    if (refreshState === "loading") return;
    setRefreshState("loading");
    try {
      // Déclenche le rafraîchissement côté serveur (ignore l'erreur en mode démo)
      await macroApi.refresh("all").catch(() => null);
      // Recharge tous les caches react-query (KPIs, tables, fraîcheur, alertes…)
      await queryClient.invalidateQueries();
      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 1800);
    } catch {
      setRefreshState("idle");
    }
  }

  return (
    <header
      className="h-14 px-6 flex items-center justify-between flex-shrink-0 z-30 relative border-b transition-colors duration-200"
      style={{ background: "var(--topbar-bg)", borderColor: "var(--topbar-border)" }}
    >
      {/* ── Bouton hamburger — mobile uniquement ── */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg mr-2 transition-colors"
          style={{ color: "var(--text-muted)" }}
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* ── Indicateur de fraîcheur des données + actualisation ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: freshness?.is_live ? "var(--mansa-green)" : "#F59E0B",
              animation: freshness?.is_live ? "pulse 2s infinite" : "none",
            }}
          />
          <span className="text-xs font-medium hidden sm:inline" style={{ color: "var(--text-muted)" }}>
            {freshness?.is_live
              ? `Données live · ${freshness.sources?.[0]?.source ?? "IMF"} · ${
                  freshness.last_updated
                    ? new Date(freshness.last_updated).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short",
                      })
                    : "À jour"
                }`
              : "Données démo"}
          </span>
        </div>

        {/* Bouton d'actualisation générale */}
        <button
          onClick={handleRefresh}
          disabled={refreshState === "loading"}
          title="Actualiser toutes les données"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-70"
          style={{
            color: refreshState === "done" ? "var(--mansa-green)" : "var(--text-muted)",
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
          }}
          onMouseEnter={(e) => { if (refreshState === "idle") e.currentTarget.style.color = "var(--mansa-green)"; }}
          onMouseLeave={(e) => { if (refreshState === "idle") e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          {refreshState === "done"
            ? <Check size={13} />
            : <RefreshCw size={13} className={refreshState === "loading" ? "animate-spin" : ""} />}
          <span className="hidden sm:inline">
            {refreshState === "loading" ? "Actualisation…" : refreshState === "done" ? "À jour" : "Actualiser"}
          </span>
        </button>

        {/* Badge alertes critiques */}
        {totalAlerts > 0 && (
          <Link
            href="/alerts"
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-opacity hover:opacity-80"
            style={{
              background: criticalCount > 0 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              color: criticalCount > 0 ? "#ef4444" : "#F59E0B",
              border: `1px solid ${criticalCount > 0 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
            }}
            title="Voir les alertes macro"
          >
            <AlertTriangle size={9} />
            {totalAlerts} alerte{totalAlerts > 1 ? "s" : ""}
          </Link>
        )}
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
