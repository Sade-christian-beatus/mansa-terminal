"use client";

import { useState } from "react";
import { UserCircle2, Mail, Building2, Shield, Key, Globe, Save, Check, Camera } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";

export default function ProfilePage() {
  const { email, fullName } = useAuthStore();
  const locale = useLangStore((s) => s.locale);
  const { locale: lang, setLocale } = useLangStore();
  const { theme, toggle } = useThemeStore();

  const [saved, setSaved]     = useState(false);
  const [name,  setName]      = useState(fullName || "");
  const [org,   setOrg]       = useState("");
  const [title, setJobTitle]  = useState("");
  const [phone, setPhone]     = useState("");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const initials = (name || email || "U").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Mon profil</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Gérez vos informations personnelles et préférences
        </p>
      </div>

      {/* Avatar + identité */}
      <div className="mansa-card rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}>
              {initials}
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center border-2 transition-colors"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--text-muted)",
              }}
              title="Changer l'avatar"
            >
              <Camera size={12} />
            </button>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {name || "Utilisateur MANSA"}
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ background: "var(--mansa-green)" }}>
                Plan Starter
              </span>
              <span className="text-xs flex items-center gap-1"
                    style={{ color: "var(--positive)" }}>
                <Shield size={10} />
                Compte vérifié
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="mansa-card rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <UserCircle2 size={16} style={{ color: "var(--mansa-green)" }} />
          Informations personnelles
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
              Nom complet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Jean Dupont"
              className="mansa-input"
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
              Titre / Poste
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ex : Économiste senior"
              className="mansa-input"
            />
          </div>
        </div>

        <div>
          <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
            Email
          </label>
          <div className="mansa-input flex items-center gap-2 cursor-not-allowed opacity-60">
            <Mail size={13} style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-secondary)" }}>{email}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
              Organisation
            </label>
            <div className="relative">
              <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                         style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Ex : Banque Africaine de Développement"
                className="mansa-input pl-8"
              />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
              Téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 000 00 00"
              className="mansa-input"
            />
          </div>
        </div>
      </div>

      {/* Préférences */}
      <div className="mansa-card rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Globe size={16} style={{ color: "var(--mansa-green)" }} />
          Préférences
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Langue */}
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
              Langue d&apos;interface
            </label>
            <div className="flex gap-2">
              {(["fr", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={
                    lang === l
                      ? { background: "var(--mansa-green)", color: "#fff", borderColor: "var(--mansa-green)" }
                      : { background: "var(--input-bg)", color: "var(--text-secondary)", borderColor: "var(--input-border)" }
                  }
                >
                  {l === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
                </button>
              ))}
            </div>
          </div>

          {/* Thème */}
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: "var(--text-secondary)" }}>
              Thème d&apos;interface
            </label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((th) => (
                <button
                  key={th}
                  onClick={() => theme !== th && toggle()}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
                  style={
                    theme === th
                      ? { background: "var(--mansa-green)", color: "#fff", borderColor: "var(--mansa-green)" }
                      : { background: "var(--input-bg)", color: "var(--text-secondary)", borderColor: "var(--input-border)" }
                  }
                >
                  {th === "dark" ? "🌙 Sombre" : "☀️ Clair"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div className="mansa-card rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Key size={16} style={{ color: "var(--mansa-green)" }} />
          Sécurité
        </h2>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Mot de passe</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Dernière modification : jamais</p>
          </div>
          <button className="mansa-btn-ghost text-xs px-3 py-1.5">
            Modifier
          </button>
        </div>
        <div className="flex items-center justify-between py-2 border-t" style={{ borderColor: "var(--bg-border)" }}>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Authentification à deux facteurs
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Non activé</p>
          </div>
          <button className="mansa-btn-ghost text-xs px-3 py-1.5">
            Activer
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3 pb-8">
        <button className="mansa-btn-ghost">Annuler</button>
        <button onClick={handleSave} className="mansa-btn-primary min-w-[120px] justify-center">
          {saved ? <><Check size={14} /> Enregistré</> : <><Save size={14} /> Enregistrer</>}
        </button>
      </div>
    </div>
  );
}
