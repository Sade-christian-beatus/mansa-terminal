"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    organization: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await authApi.register(form);
      setUser({ userId: data.user_id, email: data.email, fullName: data.full_name });
      // Pose mansa_auth côté frontend (même domaine = SameSite=Lax OK)
      const maxAge = 7 * 24 * 3600;
      document.cookie = `mansa_auth=1; path=/; max-age=${maxAge}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
      router.push("/");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(detail || "Impossible de créer le compte. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4AA] to-[#3B82F6]
                        flex items-center justify-center">
          <span className="text-white font-bold text-sm">M</span>
        </div>
        <div>
          <div className="text-white font-bold tracking-wide">MANSA Terminal</div>
          <div className="text-gray-500 text-xs">Africa Intelligence Platform</div>
        </div>
      </div>

      <div className="bg-[#0F1629] border border-[#1E2A42] rounded-2xl p-8">
        <h1 className="text-xl font-bold text-white mb-1">Créer un compte</h1>
        <p className="text-gray-400 text-sm mb-6">
          Accès gratuit aux données macro de 54 économies africaines
        </p>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-400/10
                          border border-red-400/20 rounded-lg px-4 py-3 mb-4 text-sm">
            <AlertCircle size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nom complet</label>
            <input
              type="text"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="Jean Dupont"
              className="w-full bg-[#141B2E] border border-[#1E2A42] text-gray-200
                         rounded-lg px-4 py-2.5 text-sm focus:outline-none
                         focus:border-[#00D4AA] placeholder-gray-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email professionnel</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="vous@organisation.com"
              className="w-full bg-[#141B2E] border border-[#1E2A42] text-gray-200
                         rounded-lg px-4 py-2.5 text-sm focus:outline-none
                         focus:border-[#00D4AA] placeholder-gray-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Organisation{" "}
              <span className="text-gray-600">(optionnel)</span>
            </label>
            <input
              type="text"
              name="organization"
              value={form.organization}
              onChange={handleChange}
              placeholder="Banque / Fonds / Cabinet..."
              className="w-full bg-[#141B2E] border border-[#1E2A42] text-gray-200
                         rounded-lg px-4 py-2.5 text-sm focus:outline-none
                         focus:border-[#00D4AA] placeholder-gray-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Mot de passe</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              placeholder="Minimum 8 caractères"
              className="w-full bg-[#141B2E] border border-[#1E2A42] text-gray-200
                         rounded-lg px-4 py-2.5 text-sm focus:outline-none
                         focus:border-[#00D4AA] placeholder-gray-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00D4AA] hover:bg-[#00A882] disabled:bg-gray-700
                       disabled:cursor-not-allowed text-white font-semibold rounded-lg
                       py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Création du compte..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Déjà un compte ?{" "}
          <Link href="/auth/login" className="text-[#00D4AA] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
