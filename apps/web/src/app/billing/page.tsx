"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Check, Zap, Shield, Building2, ExternalLink, X, Minus } from "lucide-react";

const PLAN_ICONS = {
  starter: Zap,
  professional: Shield,
  enterprise: Building2,
};

const PLAN_COLORS = {
  starter: "from-blue-500/10 to-blue-600/5 border-blue-500/30",
  professional: "from-[#00D4AA]/10 to-[#00D4AA]/5 border-[#00D4AA]/40",
  enterprise: "from-amber-500/10 to-amber-600/5 border-amber-500/30",
};

const PLAN_BADGE_COLORS = {
  starter: "bg-blue-500/20 text-blue-300",
  professional: "bg-[#00D4AA]/20 text-[#00D4AA]",
  enterprise: "bg-amber-500/20 text-amber-300",
};

interface Plan {
  name: string;
  price_usd: number;
  seats: number;
  features: string[];
}

// L'API retourne les plans directement à la racine : { starter: {...}, professional: {...}, ... }
type PlansResponse = Record<string, Plan>;

interface BillingStatus {
  has_subscription: boolean;
  plan: string | null;
  status: string | null;
  current_period_end?: string | null;
}

export default function BillingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: plansData, isLoading: plansLoading } = useQuery<PlansResponse>({
    queryKey: ["billing-plans"],
    queryFn: () => api.get<PlansResponse>("/billing/plans"),
    staleTime: 1000 * 60 * 60,
  });

  const { data: statusData } = useQuery<BillingStatus>({
    queryKey: ["billing-status"],
    queryFn: () => api.get<BillingStatus>("/billing/status"),
    retry: false,
  });

  const handleSubscribe = async (planKey: string) => {
    setLoadingPlan(planKey);
    try {
      const res = await api.post<{ checkout_url: string }>("/billing/checkout", {
        plan: planKey,
      });
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      }
    } catch (err) {
      console.error("Checkout error", err);
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = plansData ?? {};
  const currentPlan = statusData?.plan;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Abonnement</h1>
        <p className="text-gray-400 text-sm mt-1">
          Accédez aux données macro-fiscales de 54 économies africaines
        </p>
      </div>

      {/* Statut abonnement actuel */}
      {statusData?.status && (
        <div className="bg-[#141B2E] border border-[#1E2A42] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Plan actuel</p>
            <p className="text-white font-semibold capitalize mt-0.5">
              {currentPlan ?? "—"}{" "}
              <span className="text-xs font-normal text-[#00D4AA] ml-2">
                {statusData.status}
              </span>
            </p>
          </div>
          {statusData.current_period_end && (
            <p className="text-xs text-gray-500">
              Renouvellement le{" "}
              {new Date(statusData.current_period_end).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
      )}

      {/* Plans */}
      {plansLoading ? (
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-96 bg-[#141B2E] rounded-xl animate-pulse border border-[#1E2A42]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(plans).map(([key, plan]) => {
            const Icon = PLAN_ICONS[key as keyof typeof PLAN_ICONS] ?? Zap;
            const isActive = currentPlan === key;
            const isLoading = loadingPlan === key;

            return (
              <div
                key={key}
                className={`relative rounded-xl border bg-gradient-to-b p-6 flex flex-col
                            ${PLAN_COLORS[key as keyof typeof PLAN_COLORS] ??
                              "from-gray-800/10 to-gray-900/5 border-gray-700/30"}
                            ${isActive ? "ring-2 ring-[#00D4AA]/40" : ""}`}
              >
                {isActive && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs
                                   bg-[#00D4AA] text-gray-900 font-semibold px-3 py-1 rounded-full">
                    Plan actif
                  </span>
                )}
                {key === "professional" && !isActive && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs
                                   bg-[#00D4AA]/20 text-[#00D4AA] font-semibold px-3 py-1
                                   rounded-full border border-[#00D4AA]/30">
                    Recommandé
                  </span>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center
                                   ${PLAN_BADGE_COLORS[key as keyof typeof PLAN_BADGE_COLORS] ??
                                     "bg-gray-700 text-gray-300"}`}>
                    <Icon size={16} />
                  </div>
                  <h3 className="text-white font-bold">{plan.name}</h3>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">
                    ${(plan.price_usd / 1000).toFixed(0)}k
                  </span>
                  <span className="text-gray-500 text-sm ml-1">/an</span>
                  <p className="text-xs text-gray-500 mt-1">{plan.seats} siège{plan.seats > 1 ? "s" : ""}</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check size={14} className="text-[#00D4AA] mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(key)}
                  disabled={isActive || isLoading}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all
                               flex items-center justify-center gap-2
                               ${isActive
                                 ? "bg-[#1E2A42] text-gray-500 cursor-not-allowed"
                                 : "bg-[#00D4AA] hover:bg-[#00A882] text-gray-900 cursor-pointer"}`}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900
                                     rounded-full animate-spin" />
                  ) : (
                    <>
                      {isActive ? "Plan actuel" : "Souscrire"}
                      {!isActive && <ExternalLink size={13} />}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Matrice comparative des fonctionnalités */}
      <div className="mansa-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b" style={{ borderColor: "var(--bg-border)" }}>
          <h2 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            Règles et limites par type de compte
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Comparaison complète des accès et quotas par plan
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--input-bg)" }}>
                <th className="text-left px-5 py-3 font-semibold" style={{ color: "var(--text-muted)", width: "35%" }}>
                  Fonctionnalité
                </th>
                {[
                  { key: "trial",        label: "Essai",         sub: "14 jours",    color: "#A78BFA" },
                  { key: "starter",      label: "Starter",       sub: "$50k/an",     color: "#3B82F6" },
                  { key: "professional", label: "Professional",  sub: "$100k/an",    color: "#00D4AA" },
                  { key: "enterprise",   label: "Enterprise",    sub: "Sur mesure",  color: "#F59E0B" },
                ].map((p) => (
                  <th key={p.key} className="text-center px-4 py-3" style={{ color: p.color, fontWeight: 700 }}>
                    {p.label}
                    <div className="text-[10px] font-normal mt-0.5" style={{ color: "var(--text-muted)" }}>{p.sub}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row, i) => (
                <tr
                  key={row.label}
                  style={{
                    background: i % 2 === 0 ? "transparent" : "var(--input-bg)",
                    borderTop: "1px solid var(--bg-border)",
                  }}
                >
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--text-secondary)" }}>
                    {row.label}
                  </td>
                  {(["trial", "starter", "professional", "enterprise"] as const).map((plan) => (
                    <td key={plan} className="px-4 py-3 text-center">
                      <FeatureCell value={row[plan]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Note développement */}
      <p className="text-xs text-gray-600 text-center">
        Paiements sécurisés via Stripe. Annulation possible à tout moment.
      </p>
    </div>
  );
}

type CellValue = true | false | null | string;

function FeatureCell({ value }: { value: CellValue }) {
  if (value === true)  return <Check size={14} className="mx-auto" style={{ color: "#00D4AA" }} />;
  if (value === false) return <X    size={14} className="mx-auto" style={{ color: "#EF4444" }} />;
  if (value === null)  return <Minus size={14} className="mx-auto" style={{ color: "#6B7280" }} />;
  return <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{value}</span>;
}

const FEATURE_MATRIX: Array<{
  label: string;
  trial: CellValue;
  starter: CellValue;
  professional: CellValue;
  enterprise: CellValue;
}> = [
  { label: "Durée / Renouvellement",      trial: "14 jours",   starter: "Annuel",     professional: "Annuel",    enterprise: "Annuel"      },
  { label: "Nombre de sièges",             trial: "1",          starter: "1",          professional: "5",         enterprise: "25"           },
  { label: "Pays africains (données)",     trial: "54",         starter: "54",         professional: "54",        enterprise: "54"           },
  { label: "Indicateurs macro de base",    trial: true,         starter: true,         professional: true,        enterprise: true           },
  { label: "Indicateurs avancés",          trial: true,         starter: false,        professional: true,        enterprise: true           },
  { label: "MANSA AI — requêtes/jour",     trial: "50/j",       starter: "20/j",       professional: "100/j",     enterprise: "500/j"        },
  { label: "MANSA AI — requêtes/mois",     trial: "50",         starter: "100",        professional: "illimité",  enterprise: "illimité"     },
  { label: "Accès API publique (v1)",      trial: false,        starter: false,        professional: true,        enterprise: true           },
  { label: "Export CSV",                   trial: true,         starter: true,         professional: true,        enterprise: true           },
  { label: "Export Excel / PDF",           trial: false,        starter: false,        professional: true,        enterprise: true           },
  { label: "Analyse régionale (CER)",      trial: true,         starter: true,         professional: true,        enterprise: true           },
  { label: "Marchés & taux de change",     trial: true,         starter: true,         professional: true,        enterprise: true           },
  { label: "Conflits & risques pays",      trial: true,         starter: true,         professional: true,        enterprise: true           },
  { label: "Signaux haute fréquence",      trial: false,        starter: false,        professional: true,        enterprise: true           },
  { label: "MEAI — Economic Activity Idx", trial: false,        starter: false,        professional: false,       enterprise: true           },
  { label: "Données haute fréquence",      trial: false,        starter: false,        professional: false,       enterprise: true           },
  { label: "Support prioritaire",          trial: false,        starter: false,        professional: true,        enterprise: true           },
  { label: "Support dédié",               trial: false,        starter: false,        professional: false,       enterprise: true           },
  { label: "SLA garanti",                  trial: false,        starter: false,        professional: false,       enterprise: true           },
];
