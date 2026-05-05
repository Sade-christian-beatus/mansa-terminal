"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const fetchUserDetails = useAuthStore((s) => s.fetchUserDetails);

  useEffect(() => {
    // Initialisation synchrone depuis cookie "mansa_auth"
    hydrate();
    // Puis récupère les détails utilisateur depuis /api/auth/me
    fetchUserDetails();
  }, [hydrate, fetchUserDetails]);

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
