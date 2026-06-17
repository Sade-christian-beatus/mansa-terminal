"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function LoginPage() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? "Email ou mot de passe incorrect."
            : authError.message
        );
        return;
      }

      // Sync non-bloquant
      try {
        const user = await authApi.sync();
        setUser({ userId: user.user_id, email: user.email, fullName: user.full_name });
      } catch {
        console.warn("[MANSA] authApi.sync() failed — continuing with Supabase session");
      }

      router.push("/accueil");
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo + Marque */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="relative w-16 h-16">
          <Image
            src="/logo.png"
            alt="MANSA Terminal"
            fill
            className="object-contain drop-shadow-[0_0_20px_rgba(0,212,170,0.3)]"
          />
        </div>
        <div className="text-center">
          <h1
            className="text-2xl font-bold tracking-wide"
            style={{ color: "var(--text-primary)" }}
            translate="no"
          >
            MANSA Terminal
          </h1>
          <p className="text-xs mt-1 font-mono" style={{ color: "var(--mansa-green)" }}>
            Africa&apos;s Macro-Fiscal Intelligence Platform
          </p>
        </div>
      </div>

      {/* Carte connexion */}
      <div
        className="mansa-card rounded-2xl p-8"
        style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,170,0.05)" }}
      >
        <div className="mb-6">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Connexion
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Accédez à vos analyses macro-fiscales
          </p>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3 mb-5 text-sm"
            style={{
              color: "#F87171",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email professionnel
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

          {/* Mot de passe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Mot de passe
              </label>
              <Link
                href="/auth/reset-password"
                className="text-xs hover:underline"
                style={{ color: "var(--mansa-green)" }}
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mansa-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mansa-btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" style={{ borderColor: "var(--bg-border)" }} />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 text-xs" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
              Pas encore de compte ?
            </span>
          </div>
        </div>

        <Link
          href="/auth/register"
          className="mansa-btn-ghost w-full justify-center"
        >
          Créer un compte gratuit
        </Link>
      </div>

      {/* Badge sécurité */}
      <div className="flex items-center justify-center gap-2 mt-6">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--mansa-green)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Connexion sécurisée · Données chiffrées
        </span>
      </div>
    </div>
  );
}
