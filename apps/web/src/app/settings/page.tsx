"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore, type Locale } from "@/lib/lang-store";
import { useThemeStore } from "@/lib/theme-store";
import { t } from "@/lib/translations";
import {
  User, Bell, Shield, Globe, ChevronRight, Check, LogOut,
  Sun, Moon, Download, Database, Key, Smartphone,
} from "lucide-react";

/* ── Sous-composants ────────────────────────────────────────── */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mansa-card rounded-xl p-6 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0"
         style={{ borderColor: "var(--bg-border)" }}>
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{value ?? "—"}</span>
    </div>
  );
}

function Toggle({ label, description, enabled, onChange }: {
  label: string; description: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className="relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5"
        style={{ background: enabled ? "var(--mansa-green)" : "var(--bg-border)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: enabled ? "translateX(20px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const logout = useAuthStore((s) => s.logout);
  const { locale, setLocale } = useLangStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [notifs, setNotifs] = useState({
    dataRefresh:  true,
    aiAnalysis:   false,
    weeklyDigest: true,
    hfSignals:    true,
    disasterAlert:true,
    portAlert:    false,
  });
  const [exportPrefs, setExportPrefs] = useState({
    defaultFormat: "csv",
    includeSources: true,
    defaultYearFrom: 2015,
    defaultYearTo: 2024,
  });

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    staleTime: 1000 * 60 * 5,
  });

  const SECTIONS = [
    { id: "profile",       label: t("set_profile",       locale), icon: User     },
    { id: "notifications", label: t("set_notifications", locale), icon: Bell     },
    { id: "security",      label: t("set_security",      locale), icon: Shield   },
    { id: "preferences",   label: t("set_preferences",   locale), icon: Globe    },
    { id: "export",        label: "Export & données",              icon: Download },
    { id: "sources",       label: "Sources de données",            icon: Database },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t("set_title", locale)}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{t("set_subtitle", locale)}</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-52 shrink-0 space-y-1">
          {SECTIONS.map((s) => {
            const Icon  = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                style={
                  active
                    ? { background: "color-mix(in srgb, var(--mansa-green) 10%, transparent)", color: "var(--mansa-green)" }
                    : { color: "var(--text-muted)" }
                }
              >
                <Icon size={15} />
                {s.label}
                {active && <ChevronRight size={13} className="ml-auto" />}
              </button>
            );
          })}

          <div className="pt-4 border-t" style={{ borderColor: "var(--bg-border)" }}>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} />
              {t("set_logout", locale)}
            </button>
          </div>
        </nav>

        {/* Contenu principal */}
        <div className="flex-1 space-y-4">

          {/* ── Profil ── */}
          {activeSection === "profile" && (
            <SectionCard title={t("set_profile", locale)}>
              {isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map((i) => <div key={i} className="h-8 rounded animate-pulse" style={{ background: "var(--sidebar-bg)" }} />)}
                </div>
              ) : (
                <>
                  <Field label={t("set_email",    locale)} value={user?.email} />
                  <Field label={t("set_fullname", locale)} value={user?.full_name} />
                  <Field label={t("set_org",      locale)} value={user?.organization} />
                  <Field
                    label={t("set_verified", locale)}
                    value={user?.is_verified ? t("set_verified_y", locale) : t("set_verified_n", locale)}
                  />
                  <div className="pt-2">
                    <a href="/profile" className="text-sm font-medium" style={{ color: "var(--mansa-green)" }}>
                      Modifier le profil complet →
                    </a>
                  </div>
                </>
              )}
            </SectionCard>
          )}

          {/* ── Notifications ── */}
          {activeSection === "notifications" && (
            <SectionCard title={t("set_notifications", locale)}>
              <Toggle label={t("notif_refresh",  locale)} description={t("notif_refresh_d", locale)} enabled={notifs.dataRefresh}   onChange={(v) => setNotifs((n) => ({ ...n, dataRefresh: v }))}   />
              <Toggle label={t("notif_ai",       locale)} description={t("notif_ai_d",      locale)} enabled={notifs.aiAnalysis}    onChange={(v) => setNotifs((n) => ({ ...n, aiAnalysis: v }))}    />
              <Toggle label={t("notif_digest",   locale)} description={t("notif_digest_d",  locale)} enabled={notifs.weeklyDigest}  onChange={(v) => setNotifs((n) => ({ ...n, weeklyDigest: v }))}  />
              <div className="pt-2 border-t" style={{ borderColor: "var(--bg-border)" }}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Alertes Signaux HF</p>
                <Toggle label="Alertes signaux HF critiques"  description="Notifié immédiatement pour les signaux de sévérité critique" enabled={notifs.hfSignals}    onChange={(v) => setNotifs((n) => ({ ...n, hfSignals: v }))}     />
                <Toggle label="Alertes catastrophes EM-DAT"   description="Nouveaux événements catastrophes naturelles en Afrique"      enabled={notifs.disasterAlert} onChange={(v) => setNotifs((n) => ({ ...n, disasterAlert: v }))} />
                <Toggle label="Alertes congestion portuaire"  description="Variation trafic IMF PortWatch >10%"                         enabled={notifs.portAlert}    onChange={(v) => setNotifs((n) => ({ ...n, portAlert: v }))}     />
              </div>
            </SectionCard>
          )}

          {/* ── Sécurité ── */}
          {activeSection === "security" && (
            <SectionCard title={t("set_security", locale)}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--bg-border)" }}>
                  <div className="flex items-center gap-3">
                    <Key size={15} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("set_pwd", locale)}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("set_pwd_last", locale)}</p>
                    </div>
                  </div>
                  <button className="text-xs hover:underline" style={{ color: "var(--mansa-green)" }}>
                    {t("set_pwd_change", locale)}
                  </button>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Smartphone size={15} style={{ color: "var(--text-muted)" }} />
                    <div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("set_2fa", locale)}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("set_2fa_desc", locale)}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                    Phase 2
                  </span>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Préférences ── */}
          {activeSection === "preferences" && (
            <SectionCard title={t("set_preferences", locale)}>
              <div className="space-y-5">
                {/* Langue */}
                <div>
                  <label className="text-sm block mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("set_lang", locale)}</label>
                  <div className="flex gap-2">
                    {(["fr", "en"] as Locale[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLocale(l)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all font-medium"
                        style={
                          locale === l
                            ? { background: "color-mix(in srgb, var(--mansa-green) 10%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                            : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
                        }
                      >
                        {locale === l && <Check size={13} />}
                        {l === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thème */}
                <div>
                  <label className="text-sm block mb-1.5" style={{ color: "var(--text-secondary)" }}>Thème d&apos;interface</label>
                  <div className="flex gap-2">
                    {(["dark", "light"] as const).map((th) => {
                      const Icon = th === "dark" ? Moon : Sun;
                      return (
                        <button
                          key={th}
                          onClick={() => theme !== th && toggleTheme()}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all font-medium"
                          style={
                            theme === th
                              ? { background: "color-mix(in srgb, var(--mansa-green) 10%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                              : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
                          }
                        >
                          {theme === th && <Check size={13} />}
                          <Icon size={13} />
                          {th === "dark" ? "Mode sombre" : "Mode clair"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Devise */}
                <div>
                  <label className="text-sm block mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("set_currency", locale)}</label>
                  <select
                    className="text-sm rounded-lg px-3 py-2 w-full focus:outline-none border"
                    style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                  >
                    <option value="usd">USD — Dollar américain</option>
                    <option value="eur">EUR — Euro</option>
                    <option value="xof">XOF — Franc CFA BCEAO</option>
                    <option value="ngn">NGN — Naira nigérian</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Export & Données ── */}
          {activeSection === "export" && (
            <SectionCard title="Préférences d'export">
              <div className="space-y-5">
                <div>
                  <label className="text-sm block mb-1.5" style={{ color: "var(--text-secondary)" }}>Format d&apos;export par défaut</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["csv", "xlsx", "json", "pdf"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportPrefs((p) => ({ ...p, defaultFormat: fmt }))}
                        className="px-3 py-1.5 rounded-lg text-sm border transition-all font-medium"
                        style={
                          exportPrefs.defaultFormat === fmt
                            ? { background: "color-mix(in srgb, var(--mansa-green) 10%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                            : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }
                        }
                      >
                        .{fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <Toggle
                  label="Inclure les métadonnées sources"
                  description="Ajouter une colonne 'source' dans chaque export CSV/XLSX"
                  enabled={exportPrefs.includeSources}
                  onChange={(v) => setExportPrefs((p) => ({ ...p, includeSources: v }))}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm block mb-1.5" style={{ color: "var(--text-secondary)" }}>Année de début par défaut</label>
                    <select
                      className="text-sm rounded-lg px-3 py-2 w-full focus:outline-none border"
                      style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                      value={exportPrefs.defaultYearFrom}
                      onChange={(e) => setExportPrefs((p) => ({ ...p, defaultYearFrom: Number(e.target.value) }))}
                    >
                      {[2000, 2005, 2010, 2015, 2018, 2020].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm block mb-1.5" style={{ color: "var(--text-secondary)" }}>Année de fin par défaut</label>
                    <select
                      className="text-sm rounded-lg px-3 py-2 w-full focus:outline-none border"
                      style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                      value={exportPrefs.defaultYearTo}
                      onChange={(e) => setExportPrefs((p) => ({ ...p, defaultYearTo: Number(e.target.value) }))}
                    >
                      {[2022, 2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── Sources de données ── */}
          {activeSection === "sources" && (
            <SectionCard title="Sources de données actives">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Toutes les sources sont utilisées automatiquement par MANSA AI Analyst et les pages d&apos;analyse.
                Les sources en &ldquo;Phase 2&rdquo; seront activées prochainement.
              </p>
              <div className="space-y-2 mt-2">
                {[
                  { name: "IMF World Economic Outlook",   phase: 1, freq: "Annuelle",   indicator_count: 15 },
                  { name: "World Bank WDI",               phase: 1, freq: "Annuelle",   indicator_count: 70 },
                  { name: "WHO GHO",                      phase: 1, freq: "Annuelle",   indicator_count: 5  },
                  { name: "EIA International",            phase: 1, freq: "Mensuelle",  indicator_count: 6  },
                  { name: "EM-DAT CRED",                  phase: 1, freq: "Événement",  indicator_count: 5  },
                  { name: "UN Comtrade",                  phase: 1, freq: "Annuelle",   indicator_count: 3  },
                  { name: "NASA VIIRS",                   phase: 1, freq: "Trimestrielle", indicator_count: 1 },
                  { name: "IMF PortWatch",                phase: 1, freq: "Mensuelle",  indicator_count: 2  },
                  { name: "IPC / CH",                     phase: 1, freq: "Semestrielle", indicator_count: 2 },
                  { name: "World Bank PIP",               phase: 1, freq: "Annuelle",   indicator_count: 2  },
                  { name: "OECD DAC",                     phase: 1, freq: "Annuelle",   indicator_count: 1  },
                  { name: "Google Trends",                phase: 1, freq: "Mensuelle",  indicator_count: 4  },
                  { name: "MANSA Research",               phase: 1, freq: "Ad hoc",     indicator_count: null },
                  { name: "ILO ILOSTAT",                  phase: 2, freq: "Annuelle",   indicator_count: 8  },
                  { name: "FAO FAOSTAT",                  phase: 2, freq: "Annuelle",   indicator_count: 6  },
                  { name: "WRI Aqueduct",                 phase: 2, freq: "Annuelle",   indicator_count: 2  },
                ].map((src) => (
                  <div key={src.name} className="flex items-center justify-between py-2 border-b last:border-0"
                       style={{ borderColor: "var(--bg-border)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: src.phase === 1 ? "var(--mansa-green)" : "var(--text-muted)" }} />
                      <div>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{src.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{src.freq}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {src.indicator_count && (
                        <span style={{ color: "var(--text-muted)" }}>{src.indicator_count} indicateurs</span>
                      )}
                      <span className="px-2 py-0.5 rounded text-xs"
                            style={
                              src.phase === 1
                                ? { background: "rgba(16,185,129,0.1)", color: "#10B981" }
                                : { background: "var(--bg-border)", color: "var(--text-muted)" }
                            }>
                        Phase {src.phase}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Bouton Save */}
          {["notifications", "preferences", "export"].includes(activeSection) && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 text-gray-900 font-semibold text-sm rounded-lg transition-colors"
                style={{ background: "var(--mansa-green)" }}
              >
                {saved ? <><Check size={14} /> {t("set_saved", locale)}</> : t("set_save", locale)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
