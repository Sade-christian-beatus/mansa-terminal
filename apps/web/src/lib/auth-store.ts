import { create } from "zustand";
import { authApi } from "@/lib/api";

interface AuthState {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  isAuthenticated: boolean;
  setUser: (user: { userId: string; email: string; fullName?: string | null }) => void;
  logout: () => Promise<void>;
  hydrate: () => void;
  fetchUserDetails: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  fullName: null,
  isAuthenticated: false,

  setUser: ({ userId, email, fullName }) =>
    set({ userId, email, fullName: fullName ?? null, isAuthenticated: true }),

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Si le serveur est injoignable, on déconnecte quand même côté client
    }
    set({ userId: null, email: null, fullName: null, isAuthenticated: false });
    window.location.href = "/auth/login";
  },

  // Vérifie le cookie "mansa_auth" (non-httpOnly) pour initialisation synchrone
  hydrate: () => {
    if (typeof window === "undefined") return;
    const hasCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("mansa_auth="));
    if (hasCookie) {
      set({ isAuthenticated: true });
    }
  },

  // Récupère les détails utilisateur via /api/auth/me (async, après hydration)
  fetchUserDetails: async () => {
    try {
      const user = await authApi.me();
      set({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name ?? null,
        isAuthenticated: true,
      });
    } catch {
      // Non connecté ou token expiré — réinitialiser
      set({ userId: null, email: null, fullName: null, isAuthenticated: false });
    }
  },
}));
