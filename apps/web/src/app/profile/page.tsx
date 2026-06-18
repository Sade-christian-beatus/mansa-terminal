"use client";

import { useState } from "react";
import { UserCircle2, Mail, Building2, Shield, Key, Globe, Save, Check, Camera, Plus, Trash2, Copy, Terminal, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";
import { apiKeysApi, type APIKeyItem, type APIKeyCreated } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

      {/* API Keys */}
      <APIKeysSection />

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

// ── Section Clés API ────────────────────────────────────────────────────────
function APIKeysSection() {
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName]     = useState("");
  const [createdKey,  setCreatedKey]    = useState<APIKeyCreated | null>(null);
  const [showCreate,  setShowCreate]    = useState(false);
  const [copiedKey,   setCopiedKey]     = useState(false);
  const [visibleKeys, setVisibleKeys]   = useState<Set<string>>(new Set());

  const { data: keys, isLoading } = useQuery<APIKeyItem[]>({
    queryKey: ["api-keys"],
    queryFn:  () => apiKeysApi.list(),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => apiKeysApi.create({ name: newKeyName }),
    onSuccess: (key) => {
      setCreatedKey(key);
      setNewKeyName("");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="mansa-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Terminal size={16} style={{ color: "var(--mansa-green)" }} />
          Clés d&apos;API
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", color: "var(--mansa-green)" }}>
            v1
          </span>
        </h2>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="mansa-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5"
        >
          <Plus size={12} /> Créer une clé
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Accès programmatique aux données MANSA depuis Python, R, ou tout client HTTP.
        Documentation : <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--sidebar-bg)", color: "var(--mansa-green)" }}>/docs</code>
      </p>

      {/* Formulaire de création */}
      {showCreate && (
        <div className="rounded-xl p-4 space-y-3 border" style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Nouvelle clé</p>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder='Ex : "Script R — analyse dette"'
            className="mansa-input text-sm w-full"
            onKeyDown={(e) => e.key === "Enter" && newKeyName.trim() && createMutation.mutate()}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="mansa-btn-ghost text-xs px-3 py-1.5">Annuler</button>
            <button
              onClick={() => newKeyName.trim() && createMutation.mutate()}
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="mansa-btn-primary text-xs px-3 py-1.5"
            >
              {createMutation.isPending ? "Création…" : "Créer"}
            </button>
          </div>
          {createMutation.isError && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle size={12} />
              {(createMutation.error as Error)?.message || "Erreur lors de la création"}
            </div>
          )}
        </div>
      )}

      {/* Clé nouvellement créée — afficher une seule fois */}
      {createdKey && (
        <div className="rounded-xl p-4 border space-y-2"
             style={{ background: "rgba(34,197,94,0.05)", borderColor: "rgba(34,197,94,0.3)" }}>
          <p className="text-xs font-semibold text-green-400">
            ✓ Clé créée — copiez-la maintenant, elle ne sera plus affichée.
          </p>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs break-all"
               style={{ background: "var(--sidebar-bg)", color: "var(--mansa-green)" }}>
            <span className="flex-1">{createdKey.full_key}</span>
            <button onClick={() => copyKey(createdKey.full_key)} className="flex-shrink-0">
              {copiedKey ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </div>
          <button onClick={() => setCreatedKey(null)} className="text-xs" style={{ color: "var(--text-muted)" }}>
            J&apos;ai copié la clé →
          </button>
        </div>
      )}

      {/* Liste des clés */}
      {isLoading && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chargement…</p>}
      {!isLoading && (!keys || keys.length === 0) && (
        <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
          Aucune clé d&apos;API. Créez-en une pour accéder aux données programmatiquement.
        </p>
      )}
      {keys && keys.length > 0 && (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-xl px-4 py-3 border"
                 style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <Key size={14} style={{ color: "var(--mansa-green)", flexShrink: 0 }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{key.name}</p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {key.key_prefix}••••••••
                    {key.last_used_at && (
                      <span className="ml-2">
                        Utilisée {new Date(key.last_used_at).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => revokeMutation.mutate(key.id)}
                disabled={revokeMutation.isPending}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ml-3 flex-shrink-0"
                style={{ color: "var(--negative)", background: "rgba(239,68,68,0.08)" }}
                title="Révoquer cette clé"
              >
                <Trash2 size={11} /> Révoquer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Snippet Python rapide */}
      <div className="rounded-xl p-3 text-[11px] font-mono overflow-x-auto"
           style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)" }}>
        <span style={{ color: "#94a3b8" }}># Python — exemple d&apos;utilisation</span>{"\n"}
        <span style={{ color: "#60a5fa" }}>import</span>{" requests\n"}
        <span style={{ color: "#4ade80" }}>r</span>{" = requests.get(\n"}
        {"  "}
        <span style={{ color: "#fbbf24" }}>&quot;https://api.mansa.ai/v1/indicators&quot;</span>{",\n"}
        {"  headers={"}
        <span style={{ color: "#fbbf24" }}>&quot;Authorization&quot;</span>{": "}
        <span style={{ color: "#fbbf24" }}>&quot;Bearer mansa_xxx&quot;</span>{"},\n"}
        {"  params={"}
        <span style={{ color: "#fbbf24" }}>&quot;countries&quot;</span>{": "}
        <span style={{ color: "#fbbf24" }}>&quot;NGA,KEN,SEN&quot;</span>{", "}
        <span style={{ color: "#fbbf24" }}>&quot;from_year&quot;</span>{": 2015}\n)\n"}
        <span style={{ color: "#4ade80" }}>df</span>{" = pd.DataFrame(r.json()["}
        <span style={{ color: "#fbbf24" }}>&quot;data&quot;</span>
        {"])"}
      </div>
    </div>
  );
}
