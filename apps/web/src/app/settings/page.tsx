"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLangStore, type Locale } from "@/lib/lang-store";
import { t } from "@/lib/translations";
import {
  User, Bell, Shield, Globe, ChevronRight, Check, LogOut,
} from "lucide-react";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0F1629] border border-[#1E2A42] rounded-xl p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1E2A42] last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-200">{value ?? "—"}</span>
    </div>
  );
}

function Toggle({ label, description, enabled, onChange }: {
  label: string; description: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5
                    ${enabled ? "bg-[#00D4AA]" : "bg-[#1E2A42]"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                          ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const logout = useAuthStore((s) => s.logout);
  const { locale, setLocale } = useLangStore();
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [notifs, setNotifs] = useState({ dataRefresh: true, aiAnalysis: false, weeklyDigest: true });

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    staleTime: 1000 * 60 * 5,
  });

  const SECTIONS = [
    { id: "profile",       label: t("set_profile",       locale), icon: User },
    { id: "notifications", label: t("set_notifications", locale), icon: Bell },
    { id: "security",      label: t("set_security",      locale), icon: Shield },
    { id: "preferences",   label: t("set_preferences",   locale), icon: Globe },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("set_title", locale)}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("set_subtitle", locale)}</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <nav className="w-52 shrink-0 space-y-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                             transition-colors text-left
                             ${active
                               ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                               : "text-gray-400 hover:bg-[#141B2E] hover:text-gray-200"}`}
              >
                <Icon size={15} />
                {s.label}
                {active && <ChevronRight size={13} className="ml-auto" />}
              </button>
            );
          })}

          <div className="pt-4 border-t border-[#1E2A42]">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                         text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} />
              {t("set_logout", locale)}
            </button>
          </div>
        </nav>

        {/* Contenu */}
        <div className="flex-1 space-y-4">
          {activeSection === "profile" && (
            <SectionCard title={t("set_profile", locale)}>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-[#141B2E] rounded animate-pulse" />
                  ))}
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
                </>
              )}
            </SectionCard>
          )}

          {activeSection === "notifications" && (
            <SectionCard title={t("set_notifications", locale)}>
              <Toggle
                label={t("notif_refresh",   locale)}
                description={t("notif_refresh_d", locale)}
                enabled={notifs.dataRefresh}
                onChange={(v) => setNotifs((n) => ({ ...n, dataRefresh: v }))}
              />
              <Toggle
                label={t("notif_ai",   locale)}
                description={t("notif_ai_d", locale)}
                enabled={notifs.aiAnalysis}
                onChange={(v) => setNotifs((n) => ({ ...n, aiAnalysis: v }))}
              />
              <Toggle
                label={t("notif_digest",   locale)}
                description={t("notif_digest_d", locale)}
                enabled={notifs.weeklyDigest}
                onChange={(v) => setNotifs((n) => ({ ...n, weeklyDigest: v }))}
              />
            </SectionCard>
          )}

          {activeSection === "security" && (
            <SectionCard title={t("set_security", locale)}>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[#1E2A42]">
                  <div>
                    <p className="text-sm text-gray-200">{t("set_pwd", locale)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t("set_pwd_last", locale)}</p>
                  </div>
                  <button className="text-xs text-[#00D4AA] hover:underline">
                    {t("set_pwd_change", locale)}
                  </button>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-gray-200">{t("set_2fa", locale)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t("set_2fa_desc", locale)}</p>
                  </div>
                  <span className="text-xs bg-[#1E2A42] text-gray-500 px-2 py-1 rounded">
                    Phase 2
                  </span>
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === "preferences" && (
            <SectionCard title={t("set_preferences", locale)}>
              <div className="space-y-5">
                {/* Sélecteur de langue — change l'interface immédiatement */}
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5">
                    {t("set_lang", locale)}
                  </label>
                  <div className="flex gap-2">
                    {(["fr", "en"] as Locale[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLocale(l)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                                    border transition-all font-medium
                                    ${locale === l
                                      ? "bg-[#00D4AA]/10 border-[#00D4AA]/50 text-[#00D4AA]"
                                      : "bg-[#141B2E] border-[#1E2A42] text-gray-400 hover:text-gray-200"}`}
                      >
                        {locale === l && <Check size={13} />}
                        {l === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {locale === "fr"
                      ? "L'interface change immédiatement."
                      : "The interface changes immediately."}
                  </p>
                </div>

                {/* Devise */}
                <div>
                  <label className="text-sm text-gray-400 block mb-1.5">
                    {t("set_currency", locale)}
                  </label>
                  <select className="bg-[#141B2E] border border-[#1E2A42] text-gray-200 text-sm
                                     rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[#00D4AA]">
                    <option value="usd">USD — {locale === "fr" ? "Dollar américain" : "US Dollar"}</option>
                    <option value="eur">EUR — Euro</option>
                    <option value="xof">XOF — Franc CFA BCEAO</option>
                    <option value="ngn">NGN — {locale === "fr" ? "Naira nigérian" : "Nigerian Naira"}</option>
                  </select>
                </div>
              </div>
            </SectionCard>
          )}

          {["notifications", "preferences"].includes(activeSection) && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 bg-[#00D4AA] hover:bg-[#00A882]
                           text-gray-900 font-semibold text-sm rounded-lg transition-colors"
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
