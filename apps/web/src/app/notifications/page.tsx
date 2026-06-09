"use client";

import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, Filter } from "lucide-react";

interface Notification {
  id: number;
  title: string;
  desc: string;
  time: string;
  category: "data" | "research" | "alert" | "system";
  source: string;
  unread: boolean;
}

const ALL_NOTIFS: Notification[] = [
  { id: 1,  title: "FMI WEO — Mise à jour trimestrielle",           desc: "Nouvelles projections macro disponibles pour 54 pays africains. PIB, inflation, dette — données Q1 2025.", time: "Il y a 2h",  category: "data",     source: "IMF WEO",          unread: true  },
  { id: 2,  title: "World Bank WDI — 70 indicateurs rafraîchis",    desc: "Gouvernance (WGI), Findex, santé, éducation, LPI — tous les pays africains mis à jour.",                   time: "Il y a 4h",  category: "data",     source: "World Bank",       unread: true  },
  { id: 3,  title: "WHO GHO — Données santé Afrique",               desc: "VIH, paludisme, tuberculose, mortalité infantile — nouvelles séries 2023.",                                time: "Il y a 6h",  category: "data",     source: "WHO",              unread: true  },
  { id: 4,  title: "MANSA Research — Nouveau rapport",              desc: "AfCFTA Phase 2 : État d'avancement et implications pour les flux commerciaux intra-africains.", time: "Il y a 1j",  category: "research", source: "MANSA Terminal",   unread: false },
  { id: 5,  title: "Alerte souveraine — Éthiopie",                  desc: "Restructuration de dette en cours avec le Fonds Monétaire International. Impact sur les spreads obligataires.", time: "Il y a 1j",  category: "alert",    source: "IMF / MANSA",      unread: false },
  { id: 6,  title: "EIA — Données énergie Afrique subsaharienne",   desc: "Production pétrolière Nigeria, Angola, Gabon mise à jour. Gaz naturel Mozambique : nouvelles projections.", time: "Il y a 2j",  category: "data",     source: "EIA",              unread: false },
  { id: 7,  title: "EM-DAT — Événements climatiques Afrique",       desc: "Inondations Kenya (mars 2026) : 59 décès, 27 affectés. Sécheresse Somalie : 6.5M de personnes.",           time: "Il y a 2j",  category: "alert",    source: "EM-DAT / CRED",    unread: false },
  { id: 8,  title: "MANSA Research — Analyse sectorielle",          desc: "Secteur minier africain 2025 : cobalt, lithium, nickel — demande mondiale et impacts locaux.",               time: "Il y a 3j",  category: "research", source: "MANSA Terminal",   unread: false },
  { id: 9,  title: "NASA VIIRS — Indice activité économique",       desc: "Indice lumière nocturne mis à jour pour 54 pays africains. Tendances Q4 2024.",                             time: "Il y a 4j",  category: "data",     source: "NASA",             unread: false },
  { id: 10, title: "UN Comtrade — Flux commerciaux 2024",           desc: "Exports/imports annuels disponibles pour 50 pays africains. Balance commerciale consolidée.",               time: "Il y a 5j",  category: "data",     source: "UN Comtrade",      unread: false },
  { id: 11, title: "Alerte politique — Mali",                       desc: "Nouveau code minier adopté. Implications pour les investisseurs étrangers dans l'or et les ressources.",    time: "Il y a 6j",  category: "alert",    source: "MANSA Terminal",   unread: false },
  { id: 12, title: "IPC/CH — Insécurité alimentaire",               desc: "Rapport IPC Phase 3+ : 42M de personnes en insécurité alimentaire aiguë dans la Corne de l'Afrique.",      time: "Il y a 1sem", category: "alert",   source: "IPC / FAO",        unread: false },
];

const CATEGORY_LABELS: Record<string, string> = {
  data:     "Données",
  research: "Research",
  alert:    "Alerte",
  system:   "Système",
};
const CATEGORY_COLORS: Record<string, string> = {
  data:     "bg-blue-400",
  research: "bg-teal-400",
  alert:    "bg-amber-400",
  system:   "bg-gray-400",
};

export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState<Notification[]>(ALL_NOTIFS);
  const [filter, setFilter]       = useState<string>("all");

  const markAll   = () => setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })));
  const markRead  = (id: number) => setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, unread: false } : n));
  const deleteOne = (id: number) => setNotifs((prev) => prev.filter((n) => n.id !== id));

  const filtered = filter === "all" ? notifs : filter === "unread"
    ? notifs.filter((n) => n.unread)
    : notifs.filter((n) => n.category === filter);

  const unreadCount = notifs.filter((n) => n.unread).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)" }}>
              <Bell size={20} style={{ color: "var(--mansa-green)" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Notifications
              </h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}
              </p>
            </div>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAll} className="flex items-center gap-2 text-sm mansa-btn-ghost">
            <CheckCheck size={14} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} style={{ color: "var(--text-muted)" }} />
        {["all", "unread", "data", "research", "alert"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150"
            style={
              filter === f
                ? { background: "var(--mansa-green)", color: "#fff" }
                : { background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--input-border)" }
            }
          >
            {f === "all" ? "Toutes" : f === "unread" ? `Non lues (${unreadCount})` : CATEGORY_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p>Aucune notification dans cette catégorie</p>
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className="mansa-card rounded-xl px-4 py-4 flex items-start gap-4 transition-all duration-150"
              style={{ opacity: n.unread ? 1 : 0.75 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = n.unread ? "1" : "0.75")}
            >
              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${CATEGORY_COLORS[n.category]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {n.unread && (
                      <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                            style={{ background: "var(--mansa-green)" }} />
                    )}
                    {n.title}
                  </p>
                  <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {n.time}
                  </span>
                </div>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {n.desc}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                    {n.source}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "var(--bg-border)", color: "var(--text-muted)" }}>
                    {CATEGORY_LABELS[n.category]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {n.unread && (
                  <button
                    onClick={() => markRead(n.id)}
                    title="Marquer comme lu"
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mansa-green)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <Check size={13} />
                  </button>
                )}
                <button
                  onClick={() => deleteOne(n.id)}
                  title="Supprimer"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
