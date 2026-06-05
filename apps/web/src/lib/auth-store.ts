/**
 * MANSA Terminal — Auth Store (Zustand)
 * Utilise la session Supabase comme source de vérité.
 * Plus de JWT maison ni de cookies httpOnly personnalisés.
 */
import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";

interface AuthState {
  userId: string | null;
  email: string | null;
  fullName: string | null;
  isAuthenticated: boolean;
  setUser: (user: { userId: string; email: string; fullName?: string | null }) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  fullName: null,
  isAuthenticated: false,

  setUser: ({ userId, email, fullName }) =>
    set({ userId, email, fullName: fullName ?? null, isAuthenticated: true }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ userId: null, email: null, fullName: null, isAuthenticated: false });
    window.location.href = "/auth/login";
  },

  /**
   * Initialise le store depuis la session Supabase active.
   * Appelé au montage de l'AppShell — remplace l'ancienne vérification de cookie.
   */
  hydrate: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { user } = session;
      const meta = user.user_metadata ?? {};
      set({
        userId: user.id,
        email: user.email ?? null,
        fullName: meta.full_name ?? null,
        isAuthenticated: true,
      });
    }

    // Écouter les changements de session (login / logout / refresh)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const { user } = session;
        const meta = user.user_metadata ?? {};
        set({
          userId: user.id,
          email: user.email ?? null,
          fullName: meta.full_name ?? null,
          isAuthenticated: true,
        });
      } else {
        set({ userId: null, email: null, fullName: null, isAuthenticated: false });
      }
    });
  },
}));
