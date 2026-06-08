"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail]   = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setEmail(session.user.email ?? null);
        setStatus("success");
        setTimeout(() => router.push("/auth/login"), 4000);
      }
    });

    const timeout = setTimeout(() => {
      setStatus((prev) => (prev === "loading" ? "error" : prev));
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative w-14 h-14">
          <Image src="/logo.png" alt="MANSA Terminal" fill className="object-contain drop-shadow-[0_0_20px_rgba(0,212,170,0.3)]" />
        </div>
        <span className="text-lg font-bold tracking-wide" style={{ color: "var(--text-primary)" }} translate="no">
          MANSA Terminal
        </span>
      </div>

      <div
        className="mansa-card rounded-2xl p-10 text-center space-y-5"
        style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,170,0.05)" }}
      >
        {status === "loading" && (
          <>
            <Loader2 size={48} className="mx-auto animate-spin" style={{ color: "var(--mansa-green)" }} />
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Vérification en cours…
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Validation de votre adresse email.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)" }}
            >
              <CheckCircle2 size={32} style={{ color: "var(--mansa-green)" }} />
            </div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Email vérifié !
            </h1>
            {email && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{email}</span>{" "}
                est maintenant activé.
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Redirection dans 4 secondes…
            </p>
            <Link href="/auth/login" className="mansa-btn-primary inline-flex justify-center">
              Se connecter maintenant
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <XCircle size={32} className="text-red-400" />
            </div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Vérification échouée
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Lien invalide ou expiré. Reconnectez-vous pour en recevoir un nouveau.
            </p>
            <Link href="/auth/login" className="mansa-btn-ghost inline-flex justify-center">
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
