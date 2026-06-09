"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Bell, TrendingUp, X, Sun, Moon, UserCircle2, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";
import { macroApi } from "@/lib/api";

interface Country {
  id: string;
  name_en: string;
  name_fr: string | null;
  flag_emoji: string | null;
  region: string | null;
}

const NOTIFS = [
  { id: 1, title: "FMI WEO mis à jour",       desc: "Nouvelles projections macro Q1 2025",           time: "2h",  dot: "bg-[#00D4AA]", unread: true  },
  { id: 2, title: "World Bank WDI",            desc: "70 indicateurs rafraîchis — 54 pays",           time: "4h",  dot: "bg-blue-400",  unread: true  },
  { id: 3, title: "WHO GHO",                   desc: "Données santé Afrique sub-saharienne",          time: "1j",  dot: "bg-purple-400", unread: true },
  { id: 4, title: "Alerte souveraine",          desc: "Éthiopie : restructuration dette en cours",    time: "1j",  dot: "bg-amber-400", unread: false },
  { id: 5, title: "MANSA Research",            desc: "Nouveau rapport : AfCFTA — État d'avancement", time: "2j",  dot: "bg-teal-400",  unread: false },
];

export function TopBar() {
  const { email, fullName, logout } = useAuthStore();
  const locale = useLangStore((s) => s.locale);
  const { theme, toggle } = useThemeStore();
  const router = useRouter();
  const isDark = theme === "dark";

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search,    setSearch]    = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);

  const displayName = fullName || email?.split("@")[0] || "Utilisateur";
  const initials    = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const unreadCount = NOTIFS.filter((n) => n.unread).length;

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn:  () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const searchResults = search.trim().length >= 1
    ? countries.filter((c) =>
        c.name_en.toLowerCase().includes(search.toLowerCase()) ||
        (c.name_fr ?? "").toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (menuRef.current  && !menuRef.current.contains(e.target as Node))  setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToCountry = useCallback((id: string) => {
    setSearch(""); setSearchFocused(false);
    router.push(`/countries/${id}`);
  }, [router]);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (searchResults.length > 0) goToCountry(searchResults[0].id);
      else if (search.trim()) { router.push("/countries"); setSearch(""); setSearchFocused(false); }
    }
    if (e.key === "Escape") { setSearch(""); setSearchFocused(false); searchRef.current?.blur(); }
  };

  const showDropdown = searchFocused && search.trim().length >= 1;

  return (
    <header
      className="h-14 px-6 flex items-center justify-between flex-shrink-0 z-30 relative border-b transition-colors duration-200"
      style={{ background: "var(--topbar-bg)", borderColor: "var(--topbar-border)" }}
    >
      {/* ── Barre de recherche ── */}
      <div className="relative w-80">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-150"
          style={{
            background: "var(--input-bg)",
            border: `1px solid ${searchFocused ? "var(--mansa-green)" : "var(--input-border)"}`,
            boxShadow: searchFocused ? "0 0 0 3px color-mix(in srgb, var(--mansa-green) 15%, transparent)" : "none",
          }}
        >
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleSearchKey}
            placeholder={t("topbar_search", locale)}
            className="bg-transparent text-sm focus:outline-none w-full"
            style={{ color: "var(--text-primary)" }}
          />
          {search ? (
            <button onClick={() => setSearch("")} style={{ color: "var(--text-muted)" }}>
              <X size={12} />
            </button>
          ) : (
            <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                 style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
              ⌘K
            </kbd>
          )}
        </div>

        {showDropdown && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl shadow-2xl overflow-hidden z-50 border animate-fade-in"
            style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)" }}
          >
            {searchResults.length > 0 ? (
              <>
                <div className="px-3 py-2 border-b text-xs" style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}>
                  Pays
                </div>
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => goToCountry(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <span className="text-lg">{c.flag_emoji ?? "🌍"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name_en}</p>
                      {c.name_fr && c.name_fr !== c.name_en && (
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.name_fr}</p>
                      )}
                    </div>
                    <span className="ml-auto text-xs font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {c.id}
                    </span>
                  </button>
                ))}
                <button
                  onMouseDown={() => { router.push("/countries"); setSearch(""); setSearchFocused(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 border-t text-xs transition-colors"
                  style={{ borderColor: "var(--bg-border)", color: "var(--mansa-green)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <TrendingUp size={11} />
                  Voir tous les pays correspondants
                </button>
              </>
            ) : (
              <div className="px-3 py-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                Aucun pays trouvé pour &quot;{search}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Côté droit ── */}
      <div className="flex items-center gap-3">
        {/* Data freshness */}
        <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>{t("topbar_data", locale)}</span>
        </div>

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
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center font-bold"
                    style={{ background: "var(--mansa-green)" }}>
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-80 rounded-2xl shadow-2xl overflow-hidden border animate-fade-in"
              style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b"
                   style={{ borderColor: "var(--bg-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: "var(--mansa-green)" }}>
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

              <div className="px-4 py-2.5 border-t flex justify-between items-center"
                   style={{ borderColor: "var(--bg-border)" }}>
                <Link href="/notifications" onClick={() => setNotifOpen(false)}
                      className="text-xs font-medium hover:underline"
                      style={{ color: "var(--mansa-green)" }}>
                  Voir toutes →
                </Link>
                <Link href="/settings" onClick={() => setNotifOpen(false)}
                      className="text-xs hover:underline"
                      style={{ color: "var(--text-muted)" }}>
                  Paramètres
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Menu utilisateur ── */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-xl transition-all duration-150"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}>
              {initials || <UserCircle2 size={14} />}
            </div>
            <div className="text-xs text-left hidden sm:block">
              <div className="font-medium" style={{ color: "var(--text-secondary)" }}>{displayName}</div>
              <div className="truncate max-w-[100px]" style={{ color: "var(--text-muted)" }}>{email || "—"}</div>
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
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
              >
                <UserCircle2 size={14} />
                Mon profil
              </Link>
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
