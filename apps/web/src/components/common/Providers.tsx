"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const fetchUserDetails = useAuthStore((s) => s.fetchUserDetails);
  const pathname = usePathname();

  useEffect(() => {
    // Ne pas tenter de récupérer la session sur les pages d'auth
    // (évite la boucle : /auth/me → 401 → redirect /auth/login → rechargement infini)
    if (pathname?.startsWith("/auth")) return;
    hydrate();
    fetchUserDetails();
  }, [hydrate, fetchUserDetails, pathname]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 30,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
