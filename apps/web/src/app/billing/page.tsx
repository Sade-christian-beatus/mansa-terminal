"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Check, Zap, Shield, Building2, ExternalLink } from "lucide-react";

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

      {/* Note développement */}
      <p className="text-xs text-gray-600 text-center">
        Paiements sécurisés via Stripe. Annulation possible à tout moment.
      </p>
    </div>
  );
}
