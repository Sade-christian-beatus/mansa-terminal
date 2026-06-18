"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [ready, setReady]             = useState(false);

  // Supabase envoie l'access_token dans le hash de l'URL après le clic sur le lien
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="w-full max-w-md px-4">
        <div className="mansa-card rounded-2xl p-8 text-center">
          <Loader2 size={32} className="animate-spin mx-auto mb-4" style={{ color: "var(--mansa-green)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Vérification du lien en cours…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-4">
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
        {success ? (
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: "var(--mansa-green)" }} />
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Mot de passe mis à jour
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Redirection vers la connexion dans quelques secondes…
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Nouveau mot de passe
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Choisissez un mot de passe sécurisé (8 caractères minimum).
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
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="mansa-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
              </button>
            </form>

            <Link
              href="/auth/login"
              className="block text-center text-sm mt-6 hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Annuler
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
