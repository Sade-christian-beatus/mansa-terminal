"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ConflictEvent {
  country_id: string;
  name: string;
  flag: string;
  region: string;
  events_2024: number;
  fatalities_2024: number;
  trend: string;
  trend_label: string;
  risk_level: string;
  risk_color: string;
  active_groups: string[];
  type_breakdown: Record<string, number>;
  notes: string;
}

interface ConflictSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total_events_2024: number;
  total_fatalities_2024: number;
  countries_covered: number;
}

const RISK_LABELS: Record<string, string> = {
  critical: "Critique",
  high:     "Élevé",
  medium:   "Modéré",
  low:      "Faible",
};

// Données synthétiques basées sur ACLED Annual Report 2024 & projections 2025
const ACLED_SYNTHETIC: { events: ConflictEvent[]; summary: ConflictSummary } = {
  events: [
    { country_id:"SUD", name:"Soudan",           flag:"🇸🇩", region:"East Africa",    events_2024:21340, fatalities_2024:14200, trend:"increasing", trend_label:"+38%", risk_level:"critical", risk_color:"#EF4444", active_groups:["RSF (Forces de Soutien Rapide)","SAF (Forces armées soudanaises)","SPLM-N"], type_breakdown:{combats:58,violences_civils:22,explosions:15,protestations:5}, notes:"Guerre civile entre RSF et SAF depuis avril 2023. 8M+ déplacés, crise humanitaire de rang 1. Darfour sous état de siège." },
    { country_id:"NGA", name:"Nigeria",           flag:"🇳🇬", region:"West Africa",    events_2024:9140,  fatalities_2024:5820,  trend:"stable",    trend_label:"−2%",  risk_level:"critical", risk_color:"#EF4444", active_groups:["ISWAP","Boko Haram (JAS)","Bandits armés (Zamfara)","IPOB/ESN"], type_breakdown:{combats:41,violences_civils:29,explosions:18,protestations:12}, notes:"Terrorisme jihadiste dans le Nord-Est (ISWAP/BH) et banditisme armé dans le Nord-Ouest. Tensions intercommunautaires au Centre." },
    { country_id:"COD", name:"Congo (RDC)",       flag:"🇨🇩", region:"Central Africa", events_2024:18200, fatalities_2024:5200,  trend:"increasing", trend_label:"+21%", risk_level:"critical", risk_color:"#EF4444", active_groups:["M23/RDF","FDLR","ADF-MTM","Wazalendo","Maï-Maï"], type_breakdown:{combats:52,violences_civils:28,explosions:14,protestations:6}, notes:"Conflit armé intense dans l'Est (Nord-Kivu, Sud-Kivu, Ituri). M23 soutenu par le Rwanda contrôle Goma depuis janvier 2025." },
    { country_id:"ETH", name:"Éthiopie",          flag:"🇪🇹", region:"East Africa",    events_2024:4820,  fatalities_2024:3840,  trend:"decreasing", trend_label:"−18%", risk_level:"critical", risk_color:"#EF4444", active_groups:["OLA (Armée de libération oromo)","Fano (milice amhara)","TPLF (résiduel)"], type_breakdown:{combats:48,violences_civils:31,explosions:12,protestations:9}, notes:"Post-accord Pretoria (nov. 2022) : Tigray stabilisé mais conflits Amhara/Oromia persistent. OLA actif dans Oromia occidental." },
    { country_id:"SOM", name:"Somalie",           flag:"🇸🇴", region:"East Africa",    events_2024:8210,  fatalities_2024:3100,  trend:"stable",    trend_label:"+4%",  risk_level:"high",     risk_color:"#F97316", active_groups:["Al-Shabaab","ISIS-Somalie","Milices clanniques"], type_breakdown:{combats:45,violences_civils:24,explosions:27,protestations:4}, notes:"Al-Shabaab contrôle ~40% du territoire rural. ATMIS retiré ; transition aux forces somaliennes en cours. Attentats réguliers à Mogadiscio." },
    { country_id:"BFA", name:"Burkina Faso",      flag:"🇧🇫", region:"West Africa",    events_2024:4640,  fatalities_2024:3920,  trend:"increasing", trend_label:"+45%", risk_level:"high",     risk_color:"#F97316", active_groups:["JNIM (Ansarul Islam, GSIM)","ISGS/ISWAP","VDP (milice état)"], type_breakdown:{combats:54,violences_civils:32,explosions:9,protestations:5}, notes:"Pays le plus impacté du Sahel. JNIM contrôle >60% du territoire. Blocus humanitaire du Nord et Est. 2M+ PDI." },
    { country_id:"MLI", name:"Mali",              flag:"🇲🇱", region:"West Africa",    events_2024:3210,  fatalities_2024:2440,  trend:"increasing", trend_label:"+28%", risk_level:"high",     risk_color:"#F97316", active_groups:["JNIM","ISGS","CMA (ex-rebelles Touareg)","FAMa/Wagner"], type_breakdown:{combats:51,violences_civils:25,explosions:17,protestations:7}, notes:"Post-Barkhane : JNIM en expansion. Conflit FAMa/Wagner vs CMA dans le Nord après accord d'Alger suspendu. Attaques sur Bamako (2024)." },
    { country_id:"SSD", name:"Soudan du Sud",     flag:"🇸🇸", region:"East Africa",    events_2024:2800,  fatalities_2024:1640,  trend:"stable",    trend_label:"+8%",  risk_level:"high",     risk_color:"#F97316", active_groups:["SPLA-IO","NAS","Forces des Nuer blancs"], type_breakdown:{combats:49,violences_civils:33,explosions:8,protestations:10}, notes:"Fragile accord de paix de 2018. Violences intercommunautaires persistantes dans l'Equatoria, Jonglei. Elections repoussées à 2026." },
    { country_id:"CMR", name:"Cameroun",          flag:"🇨🇲", region:"Central Africa", events_2024:1820,  fatalities_2024:1120,  trend:"stable",    trend_label:"−5%",  risk_level:"high",     risk_color:"#F97316", active_groups:["AMBAZONIE (Ambazonia GF, SOCADEF)","Boko Haram (ISWAP Far-North)"], type_breakdown:{combats:44,violences_civils:36,explosions:12,protestations:8}, notes:"Double crise : séparatisme anglophone (2017-présent) dans le NOSO + menace BH dans l'Extrême-Nord. Dialogue bloqué." },
    { country_id:"NER", name:"Niger",             flag:"🇳🇪", region:"West Africa",    events_2024:2100,  fatalities_2024:1340,  trend:"increasing", trend_label:"+31%", risk_level:"high",     risk_color:"#F97316", active_groups:["ISGS (ISIS Sahel)","JNIM (périphérie)","Bandits armés"], type_breakdown:{combats:55,violences_civils:22,explosions:18,protestations:5}, notes:"Après coup d'État juillet 2023 : retrait MINUSMA/France. ISGS actif dans les régions de Tillabéri et Tahoua. AES sans soutien occidental." },
    { country_id:"MOZ", name:"Mozambique",        flag:"🇲🇿", region:"East Africa",    events_2024:1120,  fatalities_2024:920,   trend:"decreasing", trend_label:"−22%", risk_level:"high",     risk_color:"#F97316", active_groups:["Ansar al-Sunna (Al-Shabaab local)","Forces SAMIM/FADM"], type_breakdown:{combats:58,violences_civils:28,explosions:11,protestations:3}, notes:"Insurrection jihadiste au Cabo Delgado (depuis 2017). SAMIM (SADC) et forces rwandaises en appui. Zone pétrolière TotalEnergies sécurisée." },
    { country_id:"CAF", name:"Centrafrique",      flag:"🇨🇫", region:"Central Africa", events_2024:1240,  fatalities_2024:530,   trend:"decreasing", trend_label:"−15%", risk_level:"high",     risk_color:"#F97316", active_groups:["CPC (Coalition)","FPRC","UPC","Seleka résiduel","Wagner/AFCF"], type_breakdown:{combats:52,violences_civils:31,explosions:10,protestations:7}, notes:"MINUSCA présente. Paramilitaires russes Wagner/AFCF soutiennent le gouvernement Touadéra. Situation humanitaire précaire mais améliorée." },
    { country_id:"LBY", name:"Libye",             flag:"🇱🇾", region:"North Africa",   events_2024:1540,  fatalities_2024:210,   trend:"stable",    trend_label:"+3%",  risk_level:"medium",   risk_color:"#F59E0B", active_groups:["GNU (Tripolitaine)","LNA Haftar","Milices tribales"], type_breakdown:{combats:38,violences_civils:18,explosions:22,protestations:22}, notes:"Fragmentation politique persistante. Deux gouvernements rivaux. LNA contrôle l'Est et le Sud. Flux migratoires et trafics transsahariens." },
    { country_id:"KEN", name:"Kenya",             flag:"🇰🇪", region:"East Africa",    events_2024:820,   fatalities_2024:210,   trend:"stable",    trend_label:"−8%",  risk_level:"medium",   risk_color:"#F59E0B", active_groups:["Al-Shabaab (Côte)","Bandits armés (NE)"], type_breakdown:{combats:31,violences_civils:29,explosions:15,protestations:25}, notes:"Violences post-électorales en 2024. Attaques Al-Shabaab dans le Comté de Lamu. Manifestations anti-gouvernementales (juin 2024)." },
    { country_id:"TCD", name:"Tchad",             flag:"🇹🇩", region:"Central Africa", events_2024:890,   fatalities_2024:420,   trend:"stable",    trend_label:"+12%", risk_level:"medium",   risk_color:"#F59E0B", active_groups:["FACT","UFR","Jihadistes transfrontaliers"], type_breakdown:{combats:46,violences_civils:29,explosions:14,protestations:11}, notes:"Transition post-Déby fragile. N'Djamena visée par tentatives de coup. Frontières Mali/Niger sous pression jihadiste. Référendum 2023 contesté." },
    { country_id:"ZWE", name:"Zimbabwe",          flag:"🇿🇼", region:"Southern Africa", events_2024:420,   fatalities_2024:85,    trend:"stable",    trend_label:"−3%",  risk_level:"medium",   risk_color:"#F59E0B", active_groups:["Aucun groupe armé actif"], type_breakdown:{combats:5,violences_civils:41,explosions:2,protestations:52}, notes:"Violences politiques et répression des opposants (CCC). Crise économique chronique. Pas de conflit armé ouvert mais instabilité politique." },
    { country_id:"GHA", name:"Ghana",             flag:"🇬🇭", region:"West Africa",    events_2024:280,   fatalities_2024:42,    trend:"stable",    trend_label:"−12%", risk_level:"medium",   risk_color:"#F59E0B", active_groups:["Aucun groupe armé actif"], type_breakdown:{combats:8,violences_civils:35,explosions:3,protestations:54}, notes:"Conflits intercommunautaires au nord. Région de Bawku sous tension. Risque de contamination jihadiste depuis le Sahel. Elections 2024 pacifiques." },
    { country_id:"ZAF", name:"Afrique du Sud",    flag:"🇿🇦", region:"Southern Africa", events_2024:3200,  fatalities_2024:290,   trend:"stable",    trend_label:"+5%",  risk_level:"medium",   risk_color:"#F59E0B", active_groups:["Aucun groupe armé structuré"], type_breakdown:{combats:3,violences_civils:48,explosions:6,protestations:43}, notes:"Criminalité organisée et gangs (Western Cape). \"Load shedding\" et chômage alimentent l'instabilité sociale. Pas de conflit armé." },
    { country_id:"EGY", name:"Égypte",            flag:"🇪🇬", region:"North Africa",   events_2024:610,   fatalities_2024:120,   trend:"decreasing", trend_label:"−20%", risk_level:"low",      risk_color:"#10B981", active_groups:["ISIS-Sinaï (résiduel)"], type_breakdown:{combats:22,violences_civils:18,explosions:28,protestations:32}, notes:"Sinaï stabilisé après opération 2023. Pressions économiques (dette, FMI). Tension avec l'Éthiopie autour du GERD (barrage). Front Gaza à surveiller." },
    { country_id:"TUN", name:"Tunisie",           flag:"🇹🇳", region:"North Africa",   events_2024:180,   fatalities_2024:28,    trend:"stable",    trend_label:"+2%",  risk_level:"low",      risk_color:"#10B981", active_groups:["Cellules jihadistes résiduelles"], type_breakdown:{combats:8,violences_civils:22,explosions:5,protestations:65}, notes:"Consolidation autoritaire sous Saied. Mouvements sociaux sporadiques. Menace jihadiste résiduelle aux frontières libyenne et algérienne." },
  ],
  summary: { critical: 4, high: 8, medium: 5, low: 3, total_events_2024: 86380, total_fatalities_2024: 48640, countries_covered: 20 },
};

export default function ConflictsPage() {
  const [riskFilter, setRiskFilter]   = useState<string | null>(null);
  const [sortBy, setSortBy]           = useState<"fatalities_2024" | "events_2024">("fatalities_2024");
  const [expanded, setExpanded]       = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["conflicts", riskFilter, sortBy],
    queryFn:  () => api.get(`/acled/events?sort_by=${sortBy}${riskFilter ? `&risk_level=${riskFilter}` : ""}&limit=54`).then(r => r.data).catch(() => null),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // Utiliser les données API si disponibles, sinon les données synthétiques ACLED 2024
  const rawEvents: ConflictEvent[] = data?.events?.length > 0 ? data.events : ACLED_SYNTHETIC.events;
  const summary:   ConflictSummary = data?.summary ?? ACLED_SYNTHETIC.summary;

  const events = rawEvents
    .filter(e => !riskFilter || e.risk_level === riskFilter)
    .sort((a, b) => sortBy === "fatalities_2024" ? b.fatalities_2024 - a.fatalities_2024 : b.events_2024 - a.events_2024);

  const chartData = events.slice(0, 12).map(e => ({
    name:    e.flag + " " + e.name.split(" ")[0],
    value:   sortBy === "fatalities_2024" ? e.fatalities_2024 : e.events_2024,
    color:   e.risk_color,
  }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
            <ShieldAlert size={22} style={{ color: "#EF4444" }} />
            Conflits & Risques sécuritaires
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Source : ACLED (Armed Conflict Location & Event Data) · Données 2024 · {summary.countries_covered} pays
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-lg border"
                style={{ background: "color-mix(in srgb, #EF4444 8%, var(--card-bg))", borderColor: "color-mix(in srgb, #EF4444 25%, transparent)", color: "#EF4444" }}>
            ⚠ Données synthétiques — API ACLED live en Phase 2
          </span>
        </div>
      </div>

      {/* ── Cartes résumé ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pays niveau Critique",   value: summary.critical,               color: "#EF4444", key: "critical" },
          { label: "Pays niveau Élevé",      value: summary.high,                   color: "#F97316", key: "high" },
          { label: "Événements (2024)",      value: summary.total_events_2024?.toLocaleString("fr-FR"), color: "var(--mansa-green)", key: null },
          { label: "Décès estimés (2024)",   value: summary.total_fatalities_2024?.toLocaleString("fr-FR"), color: "#F59E0B", key: null },
        ].map(card => (
          <button
            key={card.label}
            onClick={() => card.key ? setRiskFilter(riskFilter === card.key ? null : card.key) : undefined}
            className={`mansa-card rounded-2xl p-4 text-left transition-all ${card.key ? "cursor-pointer hover:opacity-80" : ""}`}
            style={riskFilter === card.key ? { borderColor: card.color, borderWidth: 2 } : {}}
          >
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.key && (
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                {riskFilter === card.key ? "Cliquer pour tout afficher" : "Cliquer pour filtrer"}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* ── Graphique ── */}
      <div className="mansa-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Top 12 pays — {sortBy === "fatalities_2024" ? "Décès estimés" : "Événements"} 2024
          </h3>
          <div className="flex gap-2">
            {(["fatalities_2024", "events_2024"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="text-xs px-3 py-1 rounded-lg border transition-all"
                style={sortBy === s
                  ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
                  : { background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-muted)" }
                }
              >
                {s === "fatalities_2024" ? "Décès" : "Événements"}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                   tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={60} />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString("fr-FR"), sortBy === "fatalities_2024" ? "Décès" : "Événements"]}
              contentStyle={{ background: "var(--dropdown-bg)", border: "1px solid var(--bg-border)", borderRadius: 8, fontSize: 11 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Risque :</span>
        {[null, "critical", "high", "medium", "low"].map(level => (
          <button
            key={level ?? "all"}
            onClick={() => setRiskFilter(level)}
            className="px-3 py-1 text-xs rounded-full border transition-all font-medium"
            style={riskFilter === level
              ? {
                  background: level ? `color-mix(in srgb, ${["critical","high","medium","low"].includes(level!) ? {"critical":"#EF4444","high":"#F97316","medium":"#F59E0B","low":"#10B981"}[level!] : "var(--mansa-green)"} 20%, transparent)` : "var(--mansa-green)",
                  borderColor: level ? {"critical":"#EF4444","high":"#F97316","medium":"#F59E0B","low":"#10B981"}[level!] : "var(--mansa-green)",
                  color: level ? {"critical":"#EF4444","high":"#F97316","medium":"#F59E0B","low":"#10B981"}[level!] : "#000",
                }
              : { background: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--text-muted)" }
            }
          >
            {level ? RISK_LABELS[level] : "Tous"}
          </button>
        ))}
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{events.length} pays affichés</span>
      </div>

      {/* ── Liste pays ── */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)
          : events.map(event => {
              const isOpen = expanded === event.country_id;
              const TrendIcon = event.trend === "increasing" ? TrendingUp : event.trend === "decreasing" ? TrendingDown : Minus;
              const trendColor = event.trend === "increasing" ? "#EF4444" : event.trend === "decreasing" ? "#10B981" : "#F59E0B";

              return (
                <div key={event.country_id} className="mansa-card rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    onClick={() => setExpanded(isOpen ? null : event.country_id)}
                  >
                    {/* Niveau de risque */}
                    <div className="w-2.5 h-10 rounded-full flex-shrink-0"
                         style={{ background: event.risk_color }} />

                    <span className="text-2xl">{event.flag}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {event.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                              style={{ background: `color-mix(in srgb, ${event.risk_color} 15%, transparent)`, color: event.risk_color }}>
                          {RISK_LABELS[event.risk_level]}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{event.region}</span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                        {event.notes}
                      </p>
                    </div>

                    <div className="hidden md:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Événements</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {event.events_2024.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Décès estimés</p>
                        <p className="text-sm font-bold" style={{ color: "#EF4444" }}>
                          {event.fatalities_2024.toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs" style={{ color: trendColor }}>
                        <TrendIcon size={13} />
                        {event.trend_label}
                      </div>
                    </div>

                    {isOpen ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
                  </button>

                  {/* ── Détails expandables ── */}
                  {isOpen && (
                    <div className="px-6 pb-4 border-t space-y-4" style={{ borderColor: "var(--card-border)" }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        {/* Type d'événements */}
                        <div>
                          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                            Types d'incidents (%)
                          </p>
                          <div className="space-y-1.5">
                            {Object.entries(event.type_breakdown).map(([type, pct]) => (
                              <div key={type} className="flex items-center gap-2">
                                <div className="w-28 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                                  {type.replace(/_/g, " ")}
                                </div>
                                <div className="flex-1 h-2 rounded-full" style={{ background: "var(--bg-border)" }}>
                                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: event.risk_color }} />
                                </div>
                                <span className="text-xs w-8 text-right" style={{ color: "var(--text-primary)" }}>{pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Groupes armés actifs */}
                        <div>
                          <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                            <Users size={10} className="inline mr-1" />Groupes armés actifs
                          </p>
                          {event.active_groups.length > 0
                            ? event.active_groups.map((g, i) => (
                                <div key={i} className="flex items-start gap-2 mb-1.5">
                                  <span className="text-xs mt-0.5" style={{ color: event.risk_color }}>▸</span>
                                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{g}</span>
                                </div>
                              ))
                            : <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucun groupe armé actif identifié.</p>
                          }
                        </div>
                      </div>

                      {/* Note d'analyse */}
                      <div className="rounded-lg px-3 py-2.5 text-xs"
                           style={{ background: "var(--bg-border)", color: "var(--text-secondary)" }}>
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Analyse :</span>{" "}
                        {event.notes}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>

      <p className="text-xs text-center pb-2" style={{ color: "var(--text-muted)" }}>
        Données basées sur ACLED Annual Report 2024 · Pour les données live, configurer ACLED_API_KEY dans .env
      </p>
    </div>
  );
}
