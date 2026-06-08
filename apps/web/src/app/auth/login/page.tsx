"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Connexion via Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Email ou mot de passe incorrect."
            : authError.message
        );
        return;
      }

      // 2. Synchroniser l'utilisateur dans notre DB (non-bloquant)
      // Si le backend est temporairement inaccessible, on navigue quand même —
      // la session Supabase est valide et hydrate() la restaurera au montage.
      try {
        const user = await authApi.sync();
        setUser({ userId: user.user_id, email: user.email, fullName: user.full_name });
      } catch {
        // Sync échouée : on continue — le store sera hydraté par onAuthStateChange
        console.warn("[MANSA] authApi.sync() failed — continuing with Supabase session");
      }

      router.push("/");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 justify-center">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #00D4AA, #3B82F6)" }}
        >
          <span className="text-white font-bold text-sm">M</span>
        </div>
        <div>
          <div className="font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
            MANSA Terminal
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Africa Intelligence Platform
          </div>
        </div>
      </div>

      <div className="mansa-card rounded-2xl p-8">
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Connexion
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Accédez à vos analyses macro-fiscales
        </p>

        {error && (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3 mb-4 text-sm"
            style={{ color: "#F87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@organisation.com"
              className="mansa-input"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>
                Mot de passe
              </label>
              <Link href="/auth/reset-password" className="text-xs hover:underline" style={{ color: "var(--mansa-green)" }}>
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="mansa-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mansa-btn-primary justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          Pas encore de compte ?{" "}
          <Link href="/auth/register" style={{ color: "var(--mansa-green)" }} className="hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
