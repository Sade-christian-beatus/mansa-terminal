"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuthStore } from "@/lib/auth-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const hydrate   = useAuthStore((s) => s.hydrate);
  const isAuthPage = pathname?.startsWith("/auth");

  // Initialise le store auth depuis la session Supabase au montage
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (isAuthPage) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6" style={{ background: "var(--bg-primary)" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
