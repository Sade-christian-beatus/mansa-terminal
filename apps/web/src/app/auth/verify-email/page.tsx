"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail]   = useState<string | null>(null);

  useEffect(() => {
    // Supabase place le token dans le hash de l'URL (#access_token=...&type=signup)
    // Le SDK le consomme automatiquement et émet l'événement SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setEmail(session.user.email ?? null);
        setStatus("success");
        // Sync l'utilisateur dans notre base puis redirige
        setTimeout(() => router.push("/auth/login"), 4000);
      }
    });

    // Timeout de sécurité : si aucun événement après 8s → lien invalide ou expiré
    const timeout = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "error" : prev));
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080E1C] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00D4AA] to-[#3B82F6] flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">MANSA Terminal</span>
        </div>

        <div className="bg-[#0F1629] border border-[#1E2A42] rounded-2xl p-8 text-center space-y-5">
          {status === "loading" && (
            <>
              <Loader2 size={48} className="text-[#00D4AA] mx-auto animate-spin" />
              <h1 className="text-xl font-semibold text-white">Vérification en cours…</h1>
              <p className="text-sm text-gray-400">Validation de votre adresse email.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle size={48} className="text-[#00D4AA] mx-auto" />
              <h1 className="text-xl font-semibold text-white">Email vérifié !</h1>
              {email && (
                <p className="text-sm text-gray-400">
                  <span className="text-gray-200 font-medium">{email}</span> est maintenant activé.
                </p>
              )}
              <p className="text-xs text-gray-500">Redirection vers la connexion dans 4 secondes…</p>
              <Link
                href="/auth/login"
                className="inline-block mt-2 px-5 py-2.5 bg-[#00D4AA] hover:bg-[#00A882] text-gray-900 font-semibold text-sm rounded-lg transition-colors"
              >
                Se connecter maintenant
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle size={48} className="text-red-400 mx-auto" />
              <h1 className="text-xl font-semibold text-white">Vérification échouée</h1>
              <p className="text-sm text-gray-400">
                Lien invalide ou expiré. Reconnectez-vous pour en recevoir un nouveau.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/auth/login"
                  className="inline-block px-5 py-2.5 bg-[#00D4AA] hover:bg-[#00A882] text-gray-900 font-semibold text-sm rounded-lg transition-colors"
                >
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
