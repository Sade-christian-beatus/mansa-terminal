"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { useAuthStore } from "@/lib/auth-store";
import { useThemeStore } from "@/lib/theme-store";

const ONBOARDING_KEY = "mansa_onboarding_done";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const hydrate    = useAuthStore((s) => s.hydrate);
  const theme      = useThemeStore((s) => s.theme);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const isAuthPage       = pathname?.startsWith("/auth");
  const isOnboardingPage = pathname?.startsWith("/onboarding");

  // Initialise le store auth depuis la session Supabase au montage
  useEffect(() => { hydrate(); }, [hydrate]);

  // Afficher l'onboarding in-app au premier visit (plus de redirect externe)
  useEffect(() => {
    if (isAuthPage || isOnboardingPage) return;
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      setShowOnboarding(true);
    }
  }, [isAuthPage, isOnboardingPage]);

  // Applique le thème au <html> au montage + à chaque changement
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Fermer la sidebar sur changement de route (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), []);

  if (isAuthPage || isOnboardingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: "var(--bg-primary)" }}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Onboarding in-app — overlay 3 étapes au premier accès */}
      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}

      {/* ── Overlay mobile ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar — cachée sur mobile, slide-in si sidebarOpen ── */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0 md:flex
        ${sidebarOpen ? "translate-x-0 flex" : "-translate-x-full hidden md:flex"}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Contenu principal ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: "var(--bg-primary)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
