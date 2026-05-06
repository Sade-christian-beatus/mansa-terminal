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

  return (
    <header className="h-14 bg-[#0F1629] border-b border-[#1E2A42] px-6
                       flex items-center justify-between flex-shrink-0 z-30 relative">

      {/* ── Barre de recherche ── */}
      <div className="relative w-72">
        <div className={`flex items-center gap-2 bg-[#141B2E] border rounded-lg px-3 py-2
                         transition-colors ${searchFocused ? "border-[#00D4AA]/50" : "border-[#1E2A42]"}`}>
          <Search size={14} className="text-gray-500 flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleSearchKey}
            placeholder={t("topbar_search", locale)}
            className="bg-transparent text-sm text-gray-300 placeholder-gray-600
                       focus:outline-none w-full"
          />
          {search ? (
            <button onClick={() => setSearch("")} className="text-gray-600 hover:text-gray-400">
              <X size={12} />
            </button>
          ) : (
            <kbd className="text-xs text-gray-600 bg-[#1E2A42] px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          )}
        </div>

        {/* Résultats de recherche */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0F1629] border
                          border-[#1E2A42] rounded-xl shadow-2xl overflow-hidden z-50">
            {searchResults.length > 0 ? (
              <>
                <div className="px-3 py-2 border-b border-[#1E2A42]">
                  <p className="text-xs text-gray-600">Pays</p>
                </div>
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={() => goToCountry(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#141B2E]
                               transition-colors text-left"
                  >
                    <span className="text-lg">{c.flag_emoji ?? "🌍"}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 font-medium truncate">{c.name_en}</p>
                      {c.name_fr && c.name_fr !== c.name_en && (
                        <p className="text-xs text-gray-600 truncate">{c.name_fr}</p>
                      )}
                    </div>
                    <span className="ml-auto text-xs font-mono text-gray-600 flex-shrink-0">
                      {c.id}
                    </span>
                  </button>
                ))}
                <button
                  onMouseDown={() => { router.push("/countries"); setSearch(""); setSearchFocused(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 border-t border-[#1E2A42]
                             text-xs text-[#00D4AA] hover:bg-[#141B2E] transition-colors"
                >
                  <TrendingUp size={11} />
                  Voir tous les pays correspondants
                </button>
              </>
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                Aucun pays trouvé pour &quot;{search}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Côté droit ── */}
      <div className="flex items-center gap-4">
        {/* Fraîcheur données */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{t("topbar_data", locale)}</span>
        </div>

        {/* ── Cloche notifications ── */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); setMenuOpen(false); }}
            className="relative text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00D4AA] rounded-full
                             text-[10px] text-white flex items-center justify-center font-bold">
              {NOTIFS.length}
            </span>
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 z-50 w-80 bg-[#0F1629] border
                            border-[#1E2A42] rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2A42]">
                <p className="text-sm font-semibold text-white">Notifications</p>
                <button onClick={() => setNotifOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X size={14} />
                </button>
              </div>

              <div className="divide-y divide-[#1E2A42]">
                {NOTIFS.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#141B2E]
                                             transition-colors cursor-pointer">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-200 font-medium">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{n.desc}</p>
                      <p className="text-xs text-gray-700 mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 border-t border-[#1E2A42]">
                <Link
                  href="/settings"
                  onClick={() => setNotifOpen(false)}
                  className="text-xs text-[#00D4AA] hover:underline"
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
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4AA]
                            to-[#3B82F6] flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <div className="text-xs text-left">
              <div className="text-gray-300 font-medium">{displayName}</div>
              <div className="text-gray-600 truncate max-w-[120px]">{email || "—"}</div>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-50 w-48 bg-[#0F1629]
                            border border-[#1E2A42] rounded-xl shadow-xl py-1">
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm
                           text-red-400 hover:bg-red-400/10 transition-colors"
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
