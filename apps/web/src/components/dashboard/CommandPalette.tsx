"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Globe, ArrowRight, Zap, TrendingUp, BarChart2, Leaf } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Country {
  iso3: string;
  name_en: string;
  name_fr: string;
  region: string;
}

interface PaletteItem {
  id: string;
  label: string;
  sub?: string;
  href: string;
  icon: React.ReactNode;
}

const SHORTCUTS: PaletteItem[] = [
  { id: "ai",      label: "IA Analyste",   sub: "Posez une question macro",     href: "/ai",      icon: <Zap size={13} className="text-purple-400" /> },
  { id: "markets", label: "Marchés & FX",  sub: "Taux de change · Indices",     href: "/markets", icon: <TrendingUp size={13} className="text-amber-400" /> },
  { id: "countries",label:"Pays africains", sub: "54 économies · données macro", href: "/countries",icon:<Globe size={13} className="text-blue-400" /> },
  { id: "climate", label: "Climat & ESG",  sub: "Indicateurs environnementaux", href: "/climate", icon: <Leaf size={13} className="text-green-400" /> },
  { id: "indicators",label:"Indicateurs",  sub: "Catalogue des 141 indicateurs",href: "/indicators",icon:<BarChart2 size={13} className="text-[#00D4AA]" /> },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["countries-cmd"],
    queryFn: () => api.get("/macro/countries"),
    staleTime: Infinity,
    enabled: open,
  });

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSel(0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  // Open/close shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery("");
        setSel(0);
      }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [close]);

  // Focus input when opened
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const items: PaletteItem[] = query
    ? (countries ?? [])
        .filter((c) => {
          const q = query.toLowerCase();
          return (
            c.name_fr?.toLowerCase().includes(q) ||
            c.name_en?.toLowerCase().includes(q) ||
            c.iso3?.toLowerCase().includes(q)
          );
        })
        .slice(0, 7)
        .map((c) => ({
          id: c.iso3,
          label: c.name_fr || c.name_en,
          sub: `${c.region} · ${c.iso3}`,
          href: `/countries/${c.iso3}`,
          icon: <Globe size={13} className="text-blue-400" />,
        }))
    : SHORTCUTS;

  // Append AI fallback if search yields nothing
  if (query && !items.length) {
    items.push({
      id: "__ai",
      label: `Analyser : "${query}"`,
      sub: "Poser à l'IA Analyste",
      href: `/ai?q=${encodeURIComponent(query)}`,
      icon: <Zap size={13} className="text-purple-400" />,
    });
  }

  // Keyboard nav within palette
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && items[sel]) navigate(items[sel].href);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, sel, items, navigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      {/* Panel */}
      <div className="relative w-full max-w-lg animate-fade-in">
        <div className="bg-[#0D1426] border border-[#2A3A52] rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E2A42]">
            <Search size={14} className="text-gray-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSel(0); }}
              placeholder="Rechercher un pays, indicateur, page..."
              className="flex-1 bg-transparent text-white text-sm font-mono placeholder-gray-600 focus:outline-none"
            />
            <kbd className="shrink-0 text-[10px] text-gray-600 border border-[#1E2A42] rounded px-1.5 py-0.5 font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-72 py-1">
            {!query && (
              <p className="px-4 pt-1.5 pb-1 text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                Navigation rapide
              </p>
            )}
            {items.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setSel(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === sel ? "bg-[#1A2540]" : "hover:bg-[#1A2540]/60"
                }`}
              >
                <span className="w-5 shrink-0 flex items-center justify-center">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 text-sm font-medium truncate">{item.label}</p>
                  {item.sub && <p className="text-gray-600 text-[11px] font-mono truncate">{item.sub}</p>}
                </div>
                <ArrowRight size={12} className="text-gray-700 shrink-0" />
              </button>
            ))}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-[#1E2A42] bg-[#080D1A]/60">
            {[["↑↓", "naviguer"], ["↵", "ouvrir"], ["esc", "fermer"]].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1 text-[10px] text-gray-700 font-mono">
                <kbd className="border border-[#1E2A42] rounded px-1 text-gray-600">{key}</kbd>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
