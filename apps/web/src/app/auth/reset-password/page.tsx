"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

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
              Email envoyé
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
              Vérifiez votre boîte de réception.
            </p>
            <Link
              href="/auth/login"
              className="text-sm hover:underline"
              style={{ color: "var(--mansa-green)" }}
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              Mot de passe oublié
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Entrez votre email pour recevoir un lien de réinitialisation.
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

              <button
                type="submit"
                disabled={loading}
                className="w-full mansa-btn-primary justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Envoi en cours..." : "Envoyer le lien"}
              </button>
            </form>

            <Link
              href="/auth/login"
              className="flex items-center gap-1.5 text-sm mt-6 hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              <ArrowLeft size={14} />
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
