"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Bell, User, LogOut, X, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore } from "@/lib/lang-store";
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
  { id: 1, title: "Mise à jour FMI WEO", desc: "Nouvelles données trimestrielles disponibles", time: "Il y a 2h", dot: "bg-[#00D4AA]" },
  { id: 2, title: "Rapport Banque Mondiale", desc: "Africa's Pulse 2024 — Analyse intégrée", time: "Il y a 1j", dot: "bg-[#3B82F6]" },
  { id: 3, title: "Alerte souveraine", desc: "Ghana : notation Moody's révisée", time: "Il y a 2j", dot: "bg-amber-400" },
];

export function TopBar() {
  const { email, fullName, logout } = useAuthStore();
  const locale = useLangStore((s) => s.locale);
  const router = useRouter();

  const [menuOpen, setMenuOpen]   = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch]       = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);

  const displayName = fullName || email?.split("@")[0] || "Utilisateur";

  // Pays pour la recherche rapide (même QueryKey que la page Countries → cache partagé)
  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ["countries"],
    queryFn: () => macroApi.getCountries(),
    staleTime: 1000 * 60 * 60,
  });

  const searchResults = search.trim().length >= 1
    ? countries
        .filter((c) =>
          c.name_en.toLowerCase().includes(search.toLowerCase()) ||
          (c.name_fr ?? "").toLowerCase().includes(search.toLowerCase()) ||
          c.id.toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 6)
    : [];

  // Cmd+K / Ctrl+K → focus la barre de recherche
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

  // Fermer les menus au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const goToCountry = useCallback((id: string) => {
    setSearch("");
    setSearchFocused(false);
    router.push(`/countries/${id}`);
  }, [router]);

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (searchResults.length > 0) {
        goToCountry(searchResults[0].id);
      } else if (search.trim()) {
        router.push("/countries");
        setSearch("");
        setSearchFocused(false);
      }
    }
    if (e.key === "Escape") {
      setSearch("");
      setSearchFocused(false);
      searchRef.current?.blur();
    }
  };

  const showDropdown = searchFocused && search.trim().length >= 1;

  // Initiales pour l'avatar
  const initials = (fullName || displayName)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="h-14 flex items-center justify-between flex-shrink-0 z-30 relative px-6"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--bg-border)",
      }}
    >

      {/* ── Barre de recherche ── */}
      <div className="relative w-72">
        <div
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-200"
          style={{
            background: "var(--bg-input)",
            border: `1px solid ${searchFocused ? "rgba(0,212,170,.45)" : "var(--bg-border)"}`,
            boxShadow: searchFocused ? "0 0 0 3px rgba(0,212,170,.08)" : "none",
          }}
        >
          <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleSearchKey}
            placeholder={t("topbar_search", locale)}
            className="bg-transparent text-sm focus:outline-none w-full"
            style={{ color: "var(--text-secondary)" }}
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={12} />
            </button>
          ) : (
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0"
              style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              ⌘K
            </kbd>
          )}
        </div>

        {/* Résultats de recherche */}
        {showDropdown && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 animate-fade-in-fast"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--bg-border)",
              boxShadow: "var(--shadow-popup)",
            }}
          >
            {searchResults.length > 0 ? (
              <>
                <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-disabled)" }}>
                    Pays
                  </p>
                </div>
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => goToCountry(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-raised)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <span className="text-base">{c.flag_emoji ?? "🌍"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{c.name_en}</p>
                      {c.name_fr && c.name_fr !== c.name_en && (
                        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{c.name_fr}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {c.id}
                    </span>
                  </button>
                ))}
                <button
                  onMouseDown={() => { router.push("/countries"); setSearch(""); setSearchFocused(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors"
                  style={{
                    borderTop: "1px solid var(--bg-border)",
                    color: "var(--mansa-green)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mansa-green-glow)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <TrendingUp size={11} />
                  Voir tous les pays correspondants
                </button>
              </>
            ) : (
              <div className="px-3 py-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                Aucun pays trouvé pour &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Côté droit ── */}
      <div className="flex items-center gap-5">

        {/* Indicateur données live */}
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          <span className="text-[11px] font-mono hidden sm:block" style={{ color: "var(--text-muted)" }}>
            {t("topbar_data", locale)}
          </span>
        </div>

        {/* Séparateur */}
        <div className="h-5 w-px" style={{ background: "var(--bg-border)" }} />

        {/* ── Cloche notifications ── */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
            className="relative transition-colors p-1 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLElement).style.background = "";
            }}
          >
            <Bell size={17} />
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] text-black flex items-center justify-center font-black"
              style={{ background: "var(--mansa-green)" }}
            >
              {NOTIFS.length}
            </span>
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-80 rounded-xl overflow-hidden animate-fade-in-fast"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--bg-border)",
                boxShadow: "var(--shadow-popup)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--bg-border)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Notifications
                </p>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="transition-colors rounded"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                {NOTIFS.map((n, i) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                    style={{ borderTop: i > 0 ? "1px solid var(--bg-border)" : "none" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-raised)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{n.desc}</p>
                      <p className="text-[11px] mt-1 font-mono" style={{ color: "var(--text-muted)" }}>{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3" style={{ borderTop: "1px solid var(--bg-border)" }}>
                <Link
                  href="/settings"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--mansa-green)" }}
                >
                  Gérer les notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Menu utilisateur ── */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setNotifOpen(false); }}
            className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            {/* Avatar avec initiales */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #00D4AA 0%, #3B82F6 100%)",
                boxShadow: "0 2px 8px rgba(0,212,170,.25)",
              }}
            >
              {initials || <User size={13} />}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {displayName}
              </div>
              <div className="text-[10px] font-mono truncate max-w-[110px]" style={{ color: "var(--text-muted)" }}>
                {email || "—"}
              </div>
            </div>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-12 z-50 w-52 rounded-xl overflow-hidden py-1 animate-fade-in-fast"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--bg-border)",
                boxShadow: "var(--shadow-popup)",
              }}
            >
              {/* Info utilisateur */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--bg-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{displayName}</p>
                <p className="text-[11px] font-mono truncate" style={{ color: "var(--text-muted)" }}>{email}</p>
              </div>

              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                style={{ color: "#F87171" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <LogOut size={13} />
                {t("topbar_logout", locale)}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
