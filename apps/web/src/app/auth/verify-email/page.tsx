"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

type Status = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("Lien de vérification invalide ou expiré.");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setErrorMsg("Aucun token de vérification trouvé dans le lien.");
      setStatus("error");
      return;
    }

    api
      .get<{ message: string; email: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setEmail(res.email);
        setStatus("success");
        setTimeout(() => router.push("/auth/login"), 4000);
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail;
        if (detail) setErrorMsg(detail);
        setStatus("error");
      });
  }, [searchParams, router]);

  return (
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
            className="inline-block mt-2 px-5 py-2.5 bg-[#00D4AA] hover:bg-[#00A882]
                       text-gray-900 font-semibold text-sm rounded-lg transition-colors"
          >
            Se connecter maintenant
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle size={48} className="text-red-400 mx-auto" />
          <h1 className="text-xl font-semibold text-white">Vérification échouée</h1>
          <p className="text-sm text-gray-400">{errorMsg}</p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              href="/auth/login"
              className="inline-block px-5 py-2.5 bg-[#00D4AA] hover:bg-[#00A882]
                         text-gray-900 font-semibold text-sm rounded-lg transition-colors"
            >
              Retour à la connexion
            </Link>
            <p className="text-xs text-gray-600">
              Le lien a peut-être expiré. Reconnectez-vous pour en recevoir un nouveau.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#080E1C] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00D4AA] to-[#3B82F6]
                          flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-white font-bold text-lg tracking-wide">MANSA Terminal</span>
        </div>

        <Suspense
          fallback={
            <div className="bg-[#0F1629] border border-[#1E2A42] rounded-2xl p-8 text-center">
              <Loader2 size={48} className="text-[#00D4AA] mx-auto animate-spin" />
              <p className="text-sm text-gray-400 mt-4">Chargement…</p>
            </div>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
