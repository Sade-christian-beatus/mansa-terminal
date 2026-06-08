"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative w-14 h-14">
          <Image src="/logo.png" alt="MANSA Terminal" fill className="object-contain drop-shadow-[0_0_20px_rgba(0,212,170,0.3)]" />
        </div>
        <span className="text-lg font-bold tracking-wide" style={{ color: "var(--text-primary)" }} translate="no">
          MANSA Terminal
        </span>
      </div>

      <div className="mansa-card rounded-2xl p-8" style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,170,0.05)" }}>
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
