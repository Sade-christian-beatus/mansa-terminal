import type { Locale } from "./lang-store";

const translations = {
  // ── Sidebar ──────────────────────────────────────────────────────────
  nav_dashboard:      { fr: "Tableau de bord",  en: "Dashboard"        },
  nav_ai:             { fr: "MANSA IA",          en: "MANSA AI"         },
  nav_countries:      { fr: "Analyse pays",      en: "Country Analysis" },
  nav_indicators:     { fr: "Indicateurs",       en: "Indicators"       },
  nav_markets:        { fr: "Marchés",           en: "Markets"          },
  nav_climate:        { fr: "Climat & ESG",      en: "Climate & ESG"    },
  nav_signals:        { fr: "Signaux HF",        en: "HF Signals"       },
  nav_billing:        { fr: "Facturation",       en: "Billing"          },
  nav_settings:       { fr: "Paramètres",        en: "Settings"         },
  nav_help:           { fr: "Aide",              en: "Help"             },
  nav_notifications:  { fr: "Notifications",     en: "Notifications"    },
  nav_profile:        { fr: "Mon profil",        en: "My Profile"       },
  nav_news:           { fr: "Actualités",        en: "News"             },
  nav_dictionary:     { fr: "Dictionnaire",      en: "Dictionary"       },
  nav_accueil:        { fr: "Accueil",            en: "Home"             },
  nav_meai:           { fr: "MEAI Index",         en: "MEAI Index"       },
  nav_analyse:        { fr: "Analyse",            en: "Analysis"         },
  nav_regions:        { fr: "Analyse régionale",  en: "Regional Analysis"},
  nav_predictions:    { fr: "Prédictions",        en: "Predictions"      },
  nav_correlation:    { fr: "Corrélations",       en: "Correlations"     },
  nav_alerts:         { fr: "Alertes",            en: "Alerts"           },
  nav_conflicts:      { fr: "Conflits",           en: "Conflicts"        },
  navgrp_principal:   { fr: "Principal",          en: "Main"             },
  navgrp_markets:     { fr: "Marchés & Données",  en: "Markets & Data"   },
  navgrp_risks:       { fr: "Risques & Climat",   en: "Risks & Climate"  },
  theme_dark:         { fr: "Mode sombre",       en: "Dark mode"        },
  theme_light:        { fr: "Mode clair",        en: "Light mode"       },
  meai_label:      { fr: "MEAI Index",      en: "MEAI Index" },
  meai_desc:       { fr: "Baromètre macroéconomique africain composite", en: "Africa macro composite barometer" },

  // ── TopBar ────────────────────────────────────────────────────────────
  topbar_search:   { fr: "Rechercher un pays, un indicateur...", en: "Search country, indicator..." },
  topbar_data:     { fr: "Données live · IMF · World Bank",    en: "Live data · IMF · World Bank" },
  topbar_logout:   { fr: "Se déconnecter",                       en: "Sign out" },

  // ── Dashboard ─────────────────────────────────────────────────────────
  dash_title:      { fr: "Tableau de bord macro-africain",            en: "Africa Macro Dashboard" },
  dash_subtitle:   { fr: "54 économies · Données temps réel · FMI / Banque Mondiale", en: "54 economies · Real-time data · IMF / World Bank" },
  ind_gdp:         { fr: "Croissance PIB réel",  en: "GDP Real Growth" },
  ind_inf:         { fr: "Inflation IPC",         en: "Inflation CPI" },
  ind_fis:         { fr: "Solde budgétaire",      en: "Fiscal Balance" },
  ind_dbt:         { fr: "Dette publique",        en: "Public Debt" },
  ind_ca:          { fr: "Compte courant",        en: "Current Account" },

  // ── Countries ─────────────────────────────────────────────────────────
  countries_title:    { fr: "Couverture des pays",         en: "Country Coverage" },
  countries_subtitle: { fr: "{n} économies africaines · FMI / Banque Mondiale · Niveaux 1–3", en: "{n} African economies · IMF / World Bank · Tiers 1–3" },
  countries_search:   { fr: "Rechercher un pays...",       en: "Search a country..." },
  countries_all:      { fr: "Tous",                        en: "All" },
  countries_none:     { fr: "Aucun pays trouvé pour",      en: "No country found for" },
  region_west:        { fr: "Afrique de l'Ouest",          en: "West Africa" },
  region_east:        { fr: "Afrique de l'Est",            en: "East Africa" },
  region_north:       { fr: "Afrique du Nord",             en: "North Africa" },
  region_central:     { fr: "Afrique Centrale",            en: "Central Africa" },
  region_south:       { fr: "Afrique Australe",            en: "Southern Africa" },
  tier_full:          { fr: "Complet",                     en: "Full" },
  tier_moderate:      { fr: "Modéré",                      en: "Moderate" },
  tier_basic:         { fr: "Basique",                     en: "Basic" },

  // ── Country detail ────────────────────────────────────────────────────
  cd_back:         { fr: "Retour aux pays",          en: "Back to countries" },
  cd_sources:      { fr: "Sources : FMI World Economic Outlook · Banque Mondiale WDI · MANSA Terminal", en: "Sources: IMF World Economic Outlook · World Bank WDI · MANSA Terminal" },
  cd_series:       { fr: "Séries temporelles 2015–2024", en: "Time series 2015–2024" },
  cd_kpi_gdp:      { fr: "Croissance PIB",           en: "GDP Growth" },
  cd_kpi_inf:      { fr: "Inflation",                en: "Inflation" },
  cd_kpi_fis:      { fr: "Solde budgétaire",         en: "Fiscal Balance" },
  cd_kpi_dbt:      { fr: "Dette publique",           en: "Public Debt" },
  cd_vs_prev:      { fr: "vs an préc.",              en: "vs prev. year" },
  tier_cov_full:   { fr: "Couverture complète",      en: "Full Coverage" },
  tier_cov_mod:    { fr: "Couverture modérée",       en: "Moderate Coverage" },
  tier_cov_basic:  { fr: "Couverture basique",       en: "Basic Coverage" },
  ind_meta_gdp:    { fr: "Croissance PIB réel",      en: "GDP Real Growth" },
  ind_meta_inf:    { fr: "Inflation IPC",            en: "Inflation CPI" },
  ind_meta_fis:    { fr: "Solde budgétaire",         en: "Fiscal Balance" },
  ind_meta_dbt:    { fr: "Dette publique",           en: "Public Debt" },
  ind_meta_ca:     { fr: "Compte courant",           en: "Current Account" },
  ind_meta_gdppc:  { fr: "PIB par habitant",         en: "GDP per Capita" },
  ind_meta_une:    { fr: "Taux de chômage",          en: "Unemployment Rate" },

  // ── AI Analyst ────────────────────────────────────────────────────────
  ai_title:        { fr: "MANSA Analyst",          en: "MANSA Analyst" },
  ai_subtitle:     { fr: "IA spécialisée sur les 54 économies africaines · FMI · Banque Mondiale · BCEAO", en: "AI specialized on 54 African economies · IMF · World Bank · BCEAO" },
  ai_history:      { fr: "Historique",             en: "History" },
  ai_placeholder:  { fr: "Ex: Analyse la soutenabilité de la dette du Sénégal...", en: "E.g.: Analyze debt sustainability in Senegal..." },
  ai_hint:         { fr: "Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · Données : FMI, Banque Mondiale, BCEAO, BEAC", en: "Enter to send · Shift+Enter for new line · Data: IMF, World Bank, BCEAO, BEAC" },
  ai_empty_title:  { fr: "Interrogez MANSA Analyst",  en: "Ask MANSA Analyst" },
  ai_empty_desc:   { fr: "Analyses macro-fiscales, risques souverains, profils pays, données FMI et Banque Mondiale — en français ou en anglais.", en: "Macro-fiscal analysis, sovereign risks, country profiles, IMF and World Bank data — in French or English." },
  ai_no_history:   { fr: "Aucune requête pour l'instant.", en: "No queries yet." },
  ai_error_conn:   { fr: "❌ Erreur de connexion.", en: "❌ Connection error." },
  ai_error_gen:    { fr: "❌ Erreur lors de l'analyse. Veuillez réessayer.", en: "❌ Analysis error. Please try again." },

  // ── Settings ──────────────────────────────────────────────────────────
  set_title:         { fr: "Paramètres",                         en: "Settings" },
  set_subtitle:      { fr: "Gérez votre compte et vos préférences", en: "Manage your account and preferences" },
  set_profile:       { fr: "Profil",                             en: "Profile" },
  set_notifications: { fr: "Notifications",                      en: "Notifications" },
  set_security:      { fr: "Sécurité",                           en: "Security" },
  set_preferences:   { fr: "Préférences",                        en: "Preferences" },
  set_lang:          { fr: "Langue",                             en: "Language" },
  set_currency:      { fr: "Devise d'affichage",                 en: "Display currency" },
  set_save:          { fr: "Enregistrer",                        en: "Save" },
  set_saved:         { fr: "Enregistré",                         en: "Saved" },
  set_logout:        { fr: "Déconnexion",                        en: "Sign out" },
  set_email:         { fr: "Email",                              en: "Email" },
  set_fullname:      { fr: "Nom complet",                        en: "Full name" },
  set_org:           { fr: "Organisation",                       en: "Organisation" },
  set_verified:      { fr: "Statut vérification",                en: "Verification status" },
  set_verified_y:    { fr: "Vérifié ✓",                          en: "Verified ✓" },
  set_verified_n:    { fr: "Non vérifié",                        en: "Not verified" },
  set_pwd:           { fr: "Mot de passe",                       en: "Password" },
  set_pwd_last:      { fr: "Dernière modification : jamais",     en: "Last changed: never" },
  set_pwd_change:    { fr: "Modifier",                           en: "Change" },
  set_2fa:           { fr: "Authentification deux facteurs",     en: "Two-factor authentication" },
  set_2fa_desc:      { fr: "Renforcez la sécurité de votre compte", en: "Strengthen your account security" },
  notif_refresh:     { fr: "Rafraîchissement des données",       en: "Data refresh" },
  notif_refresh_d:   { fr: "Notifié quand les données macro sont mises à jour", en: "Notified when macro data is updated" },
  notif_ai:          { fr: "Analyses AI",                        en: "AI analyses" },
  notif_ai_d:        { fr: "Notifié quand une analyse est prête", en: "Notified when an analysis is ready" },
  notif_digest:      { fr: "Digest hebdomadaire",                en: "Weekly digest" },
  notif_digest_d:    { fr: "Résumé macro chaque lundi matin",    en: "Macro summary every Monday morning" },

  // ── Billing ──────────────────────────────────────────────────────────
  bill_title:     { fr: "Abonnement",           en: "Subscription" },
  bill_subtitle:  { fr: "Accédez aux données macro-fiscales de 54 économies africaines", en: "Access macro-fiscal data for 54 African economies" },
  bill_current:   { fr: "Plan actuel",          en: "Current plan" },
  bill_renew:     { fr: "Renouvellement le",    en: "Renews on" },
  bill_active:    { fr: "Plan actif",           en: "Active plan" },
  bill_recommend: { fr: "Recommandé",           en: "Recommended" },
  bill_seat:      { fr: "siège",                en: "seat" },
  bill_seats:     { fr: "sièges",               en: "seats" },
  bill_year:      { fr: "/an",                  en: "/yr" },
  bill_subscribe: { fr: "Souscrire",            en: "Subscribe" },
  bill_current_p: { fr: "Plan actuel",          en: "Current plan" },
  bill_stripe:    { fr: "Paiements sécurisés via Stripe. Annulation possible à tout moment.", en: "Secure payments via Stripe. Cancel anytime." },

  // ── Help ─────────────────────────────────────────────────────────────
  help_title:    { fr: "Aide & Documentation",  en: "Help & Documentation" },
  help_subtitle: { fr: "Tout ce qu'il faut savoir pour tirer le meilleur de MANSA Terminal", en: "Everything you need to get the most out of MANSA Terminal" },
  help_guides:   { fr: "Guides rapides",        en: "Quick guides" },
  help_faq:      { fr: "Questions fréquentes",  en: "Frequently asked questions" },
  help_api_doc:  { fr: "Documentation API",     en: "API Documentation" },
  help_support:  { fr: "Support",               en: "Support" },
} as const;

export type TKey = keyof typeof translations;

export function t(key: TKey, locale: Locale, vars?: Record<string, string | number>): string {
  const str: string = translations[key]?.[locale] ?? translations[key]?.fr ?? key;
  if (!vars) return str;
  return Object.entries(vars).reduce<string>(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    str
  );
}

// Re-export map for region/tier lookups
export const REGION_FR: Record<string, string> = {
  "West Africa":    translations.region_west.fr,
  "East Africa":    translations.region_east.fr,
  "North Africa":   translations.region_north.fr,
  "Central Africa": translations.region_central.fr,
  "Southern Africa":translations.region_south.fr,
};
export const REGION_EN: Record<string, string> = {
  "West Africa":    translations.region_west.en,
  "East Africa":    translations.region_east.en,
  "North Africa":   translations.region_north.en,
  "Central Africa": translations.region_central.en,
  "Southern Africa":translations.region_south.en,
};
