"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
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
    full_name: "", email: "", organization: "", password: "", country_of_residence: "",
  });
  const [showPwd, setShowPwd]     = useState(false);
  const [error,   setError]       = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const preferredCurrency = form.country_of_residence
        ? CURRENCY_BY_COUNTRY[form.country_of_residence] ?? "USD"
        : "USD";

      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            organization: form.organization || undefined,
            country_of_residence: form.country_of_residence || undefined,
            preferred_currency: preferredCurrency,
            preferred_language: "fr",
          },
        },
      });

      if (authError) { setError(authError.message); return; }

      if (data.session) {
        try {
          const user = await authApi.sync({
            full_name: form.full_name,
            organization: form.organization || undefined,
            country_of_residence: form.country_of_residence || undefined,
            preferred_currency: preferredCurrency,
            preferred_language: "fr",
          });
          setUser({ userId: user.user_id, email: user.email, fullName: user.full_name });
        } catch {
          console.warn("[MANSA] authApi.sync() failed — continuing with Supabase session");
        }
        router.push("/accueil");
      } else {
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
        <div
          className="mansa-card rounded-2xl p-10 text-center"
          style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,170,0.05)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)" }}
          >
            <CheckCircle2 size={32} style={{ color: "var(--mansa-green)" }} />
          </div>
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Vérifiez votre email
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Un lien de confirmation a été envoyé à{" "}
            <span className="font-medium" style={{ color: "var(--mansa-green)" }}>
              {form.email}
            </span>
            .{" "}Cliquez dessus pour activer votre compte.
          </p>
          <Link
            href="/auth/login"
            className="mansa-btn-ghost inline-flex mt-8"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md px-4">
      {/* Logo + Marque */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative w-14 h-14">
          <Image
            src="/logo.png"
            alt="MANSA Terminal"
            fill
            className="object-contain drop-shadow-[0_0_20px_rgba(0,212,170,0.3)]"
          />
        </div>
        <div className="text-center">
          <h1
            className="text-xl font-bold tracking-wide"
            style={{ color: "var(--text-primary)" }}
            translate="no"
          >
            MANSA Terminal
          </h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--mansa-green)" }}>
            Africa&apos;s Macro-Fiscal Intelligence Platform
          </p>
        </div>
      </div>

      {/* Carte inscription */}
      <div
        className="mansa-card rounded-2xl p-8"
        style={{ boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,170,0.05)" }}
      >
        <div className="mb-6">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Créer un compte
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Accès gratuit · 54 économies africaines
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
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Nom complet
            </label>
            <input
              type="text" name="full_name" value={form.full_name}
              onChange={handleChange} required placeholder="Jean Dupont"
              className="mansa-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Email professionnel
            </label>
            <input
              type="email" name="email" value={form.email}
              onChange={handleChange} required placeholder="vous@organisation.com"
              className="mansa-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Organisation{" "}
              <span style={{ color: "var(--text-muted)" }}>(optionnel)</span>
            </label>
            <input
              type="text" name="organization" value={form.organization}
              onChange={handleChange} placeholder="Banque / Fonds / Cabinet..."
              className="mansa-input"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Pays de résidence{" "}
              <span style={{ color: "var(--text-muted)" }}>(optionnel)</span>
            </label>
            <select
              name="country_of_residence"
              value={form.country_of_residence}
              onChange={handleChange}
              className="mansa-input"
            >
              <option value="">Sélectionner un pays…</option>
              {COUNTRIES_LIST.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                name="password" value={form.password}
                onChange={handleChange} required minLength={8}
                placeholder="Minimum 8 caractères"
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
            type="submit" disabled={loading}
            className="mansa-btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Création du compte…" : "Créer mon compte"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" style={{ borderColor: "var(--bg-border)" }} />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 text-xs" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>
              Déjà un compte ?
            </span>
          </div>
        </div>

        <Link
          href="/auth/login"
          className="mansa-btn-ghost w-full justify-center"
        >
          Se connecter
        </Link>
      </div>
    </div>
  );
}
