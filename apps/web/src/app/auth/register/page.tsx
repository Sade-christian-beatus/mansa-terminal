"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

const COUNTRIES_LIST = [
  { code: "DZA", name: "Algérie" }, { code: "AGO", name: "Angola" }, { code: "BEN", name: "Bénin" },
  { code: "BWA", name: "Botswana" }, { code: "BFA", name: "Burkina Faso" }, { code: "BDI", name: "Burundi" },
  { code: "CMR", name: "Cameroun" }, { code: "CPV", name: "Cap-Vert" }, { code: "CAF", name: "Centrafrique" },
  { code: "COM", name: "Comores" }, { code: "COG", name: "Congo (Brazzaville)" }, { code: "COD", name: "Congo (RDC)" },
  { code: "CIV", name: "Côte d'Ivoire" }, { code: "DJI", name: "Djibouti" }, { code: "EGY", name: "Égypte" },
  { code: "ERI", name: "Érythrée" }, { code: "SWZ", name: "Eswatini" }, { code: "ETH", name: "Éthiopie" },
  { code: "GAB", name: "Gabon" }, { code: "GMB", name: "Gambie" }, { code: "GHA", name: "Ghana" },
  { code: "GIN", name: "Guinée" }, { code: "GNQ", name: "Guinée équatoriale" }, { code: "GNB", name: "Guinée-Bissau" },
  { code: "KEN", name: "Kenya" }, { code: "LSO", name: "Lesotho" }, { code: "LBR", name: "Liberia" },
  { code: "LBY", name: "Libye" }, { code: "MDG", name: "Madagascar" }, { code: "MWI", name: "Malawi" },
  { code: "MLI", name: "Mali" }, { code: "MAR", name: "Maroc" }, { code: "MRT", name: "Mauritanie" },
  { code: "MUS", name: "Maurice" }, { code: "MOZ", name: "Mozambique" }, { code: "NAM", name: "Namibie" },
  { code: "NER", name: "Niger" }, { code: "NGA", name: "Nigeria" }, { code: "RWA", name: "Rwanda" },
  { code: "STP", name: "São Tomé-et-Príncipe" }, { code: "SEN", name: "Sénégal" }, { code: "SLE", name: "Sierra Leone" },
  { code: "SOM", name: "Somalie" }, { code: "SUD", name: "Soudan" }, { code: "ZAF", name: "Afrique du Sud" },
  { code: "SYC", name: "Seychelles" }, { code: "TZA", name: "Tanzanie" }, { code: "TCD", name: "Tchad" },
  { code: "TGO", name: "Togo" }, { code: "TUN", name: "Tunisie" }, { code: "UGA", name: "Ouganda" },
  { code: "ZMB", name: "Zambie" }, { code: "ZWE", name: "Zimbabwe" },
  // Diaspora
  { code: "FRA", name: "France" }, { code: "GBR", name: "Royaume-Uni" }, { code: "BEL", name: "Belgique" },
  { code: "CHE", name: "Suisse" }, { code: "USA", name: "États-Unis" }, { code: "CAN", name: "Canada" },
  { code: "DEU", name: "Allemagne" }, { code: "NLD", name: "Pays-Bas" }, { code: "PRT", name: "Portugal" },
  { code: "ESP", name: "Espagne" }, { code: "CHN", name: "Chine" }, { code: "ARE", name: "Émirats arabes unis" },
].sort((a, b) => a.name.localeCompare(b.name, "fr"));

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  NGA:"NGN", ZAF:"ZAR", EGY:"EGP", ETH:"ETB", KEN:"KES", TZA:"TZS", MAR:"MAD",
  GHA:"GHS", DZA:"DZD", TUN:"TND", LBY:"LYD", AGO:"AOA", CMR:"XAF", COD:"CDF",
  CIV:"XOF", SEN:"XOF", MLI:"XOF", BFA:"XOF", BEN:"XOF", TGO:"XOF", NER:"XOF",
  GNB:"XOF", MOZ:"MZN", ZMB:"ZMW", RWA:"RWF", UGA:"UGX", BWA:"BWP", NAM:"NAD",
  ZWE:"ZWL", MUS:"MUR", SYC:"SCR", FRA:"EUR", BEL:"EUR", CHE:"CHF", GBR:"GBP",
  USA:"USD", CAN:"CAD", ARE:"AED", CHN:"CNY", DEU:"EUR", NLD:"EUR", PRT:"EUR", ESP:"EUR",
};

export default function RegisterPage() {
  const router  = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({
    full_name: "", email: "", organization: "", password: "",
  });
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Inscription via Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            organization: form.organization || undefined,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // 2. Si session disponible (email confirm désactivé), synchroniser
      if (data.session) {
        const user = await authApi.sync({
          full_name: form.full_name,
          organization: form.organization || undefined,
        });
        setUser({ userId: user.user_id, email: user.email, fullName: user.full_name });
        router.push("/");
      } else {
        // Email de confirmation envoyé par Supabase
        setSuccess(true);
      }
    } catch {
      setError("Impossible de créer le compte. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md px-4">
        <div className="mansa-card rounded-2xl p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: "var(--mansa-green)" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Vérifiez votre email
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Un lien de confirmation a été envoyé à{" "}
            <span style={{ color: "var(--mansa-green)" }}>{form.email}</span>.
            Cliquez dessus pour activer votre compte.
          </p>
          <Link href="/auth/login" className="inline-block mt-6 mansa-btn-ghost text-sm">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

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
          Créer un compte
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Accès gratuit aux données macro de 54 économies africaines
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
              Nom complet
            </label>
            <input
              type="text" name="full_name" value={form.full_name}
              onChange={handleChange} required placeholder="Jean Dupont"
              className="mansa-input"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email professionnel
            </label>
            <input
              type="email" name="email" value={form.email}
              onChange={handleChange} required placeholder="vous@organisation.com"
              className="mansa-input"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Organisation <span style={{ color: "var(--text-muted)" }}>(optionnel)</span>
            </label>
            <input
              type="text" name="organization" value={form.organization}
              onChange={handleChange} placeholder="Banque / Fonds / Cabinet..."
              className="mansa-input"
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Mot de passe
            </label>
            <input
              type="password" name="password" value={form.password}
              onChange={handleChange} required minLength={8}
              placeholder="Minimum 8 caractères"
              className="mansa-input"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full mansa-btn-primary justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Création du compte…" : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
          Déjà un compte ?{" "}
          <Link href="/auth/login" style={{ color: "var(--mansa-green)" }} className="hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
