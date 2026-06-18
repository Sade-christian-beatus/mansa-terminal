"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, MinusCircle, Globe2, Users, TrendingUp,
} from "lucide-react";
import { macroApi } from "@/lib/api";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { RegionMap } from "@/components/regions/RegionMap";

// ── 8 Communautés Économiques Régionales officielles de l'UA + AES ───────────

interface RecConfig {
  id: string;
  label: string;
  fullName: string;
  color: string;
  founded: string;
  hq: string;
  members: number;
  currency?: string;
  bank?: string;
  description: string;
  countries: string[];
  apiZone?: "UEMOA" | "CEMAC" | "SSA";
  macroData: Record<string, { growth: number; inflation: number; debt: number; fiscal: number; ca: number; name: string; flag: string }>;
}

const RECS: RecConfig[] = [
  {
    id: "CEDEAO",
    label: "CEDEAO",
    fullName: "Communauté Économique des États de l'Afrique de l'Ouest",
    color: "#00D4AA",
    founded: "1975",
    hq: "Abuja, Nigeria",
    members: 15,
    description: "15 pays d'Afrique de l'Ouest · Zone de libre-échange · Union douanière en cours",
    countries: ["BEN","BFA","CPV","CIV","GMB","GHA","GIN","GNB","LBR","MLI","MRT","NER","NGA","SLE","SEN","TGO"],
    macroData: {
      BEN:{ flag:"🇧🇯", name:"Bénin",          growth:6.4,  inflation:2.7,  debt:54,  fiscal:-4.7, ca:-4.2 },
      BFA:{ flag:"🇧🇫", name:"Burkina Faso",   growth:2.5,  inflation:3.0,  debt:54,  fiscal:-4.5, ca:-4.1 },
      CPV:{ flag:"🇨🇻", name:"Cap-Vert",       growth:4.5,  inflation:7.5,  debt:140, fiscal:-2.8, ca:-5.0 },
      CIV:{ flag:"🇨🇮", name:"Côte d'Ivoire",  growth:6.5,  inflation:3.8,  debt:57,  fiscal:-4.0, ca:-3.7 },
      GMB:{ flag:"🇬🇲", name:"Gambie",         growth:5.8,  inflation:15.0, debt:80,  fiscal:-3.9, ca:-5.0 },
      GHA:{ flag:"🇬🇭", name:"Ghana",          growth:3.1,  inflation:22.3, debt:83,  fiscal:-4.6, ca:-2.0 },
      GIN:{ flag:"🇬🇳", name:"Guinée",         growth:6.5,  inflation:9.6,  debt:35,  fiscal:-3.3, ca:-12.0},
      GNB:{ flag:"🇬🇼", name:"Guinée-Bissau",  growth:4.2,  inflation:5.0,  debt:78,  fiscal:-3.5, ca:-5.0 },
      LBR:{ flag:"🇱🇷", name:"Liberia",        growth:4.5,  inflation:8.0,  debt:60,  fiscal:-5.0, ca:-23.0},
      MLI:{ flag:"🇲🇱", name:"Mali",           growth:4.0,  inflation:2.5,  debt:50,  fiscal:-3.5, ca:-5.5 },
      MRT:{ flag:"🇲🇷", name:"Mauritanie",     growth:3.9,  inflation:6.3,  debt:60,  fiscal:-1.0, ca:-7.0 },
      NER:{ flag:"🇳🇪", name:"Niger",          growth:12.3, inflation:3.9,  debt:52,  fiscal:-6.8, ca:-16.0},
      NGA:{ flag:"🇳🇬", name:"Nigeria",        growth:3.1,  inflation:32.5, debt:46,  fiscal:-4.6, ca:0.8  },
      SLE:{ flag:"🇸🇱", name:"Sierra Leone",   growth:3.5,  inflation:37.0, debt:82,  fiscal:-8.3, ca:-14.0},
      SEN:{ flag:"🇸🇳", name:"Sénégal",        growth:8.3,  inflation:2.8,  debt:73,  fiscal:-4.9, ca:-12.1},
      TGO:{ flag:"🇹🇬", name:"Togo",           growth:6.0,  inflation:4.0,  debt:69,  fiscal:-3.8, ca:-2.9 },
    },
  },
  {
    id: "UEMOA",
    label: "UEMOA",
    fullName: "Union Économique et Monétaire Ouest-Africaine",
    color: "#3B82F6",
    founded: "1994",
    hq: "Ouagadougou, Burkina Faso",
    members: 8,
    currency: "XOF (Franc CFA)",
    bank: "BCEAO",
    description: "8 pays · Monnaie unique XOF · Critères de convergence macro stricts",
    countries: ["SEN","CIV","MLI","BFA","NER","TGO","BEN","GNB"],
    apiZone: "UEMOA",
    macroData: {
      SEN:{ flag:"🇸🇳", name:"Sénégal",       growth:8.3,  inflation:2.8, debt:73, fiscal:-4.9, ca:-12.1 },
      CIV:{ flag:"🇨🇮", name:"Côte d'Ivoire", growth:6.5,  inflation:3.8, debt:57, fiscal:-4.0, ca:-3.7  },
      MLI:{ flag:"🇲🇱", name:"Mali",          growth:4.0,  inflation:2.5, debt:50, fiscal:-3.5, ca:-5.5  },
      BFA:{ flag:"🇧🇫", name:"Burkina Faso",  growth:2.5,  inflation:3.0, debt:54, fiscal:-4.5, ca:-4.1  },
      NER:{ flag:"🇳🇪", name:"Niger",         growth:12.3, inflation:3.9, debt:52, fiscal:-6.8, ca:-16.0 },
      TGO:{ flag:"🇹🇬", name:"Togo",          growth:6.0,  inflation:4.0, debt:69, fiscal:-3.8, ca:-2.9  },
      BEN:{ flag:"🇧🇯", name:"Bénin",         growth:6.4,  inflation:2.7, debt:54, fiscal:-4.7, ca:-4.2  },
      GNB:{ flag:"🇬🇼", name:"Guinée-Bissau", growth:4.2,  inflation:5.0, debt:78, fiscal:-3.5, ca:-5.0  },
    },
  },
  {
    id: "CEMAC",
    label: "CEMAC",
    fullName: "Communauté Économique et Monétaire de l'Afrique Centrale",
    color: "#8B5CF6",
    founded: "1999",
    hq: "Bangui, Centrafrique",
    members: 6,
    currency: "XAF (Franc CFA)",
    bank: "BEAC",
    description: "6 pays · Monnaie unique XAF · Union douanière · Critères de convergence",
    countries: ["CMR","TCD","CAF","COG","GAB","GNQ"],
    apiZone: "CEMAC",
    macroData: {
      CMR:{ flag:"🇨🇲", name:"Cameroun",              growth:4.1,  inflation:7.4, debt:48, fiscal:-2.5, ca:-4.2 },
      TCD:{ flag:"🇹🇩", name:"Tchad",                 growth:3.0,  inflation:4.5, debt:45, fiscal:-1.0, ca:-1.5 },
      CAF:{ flag:"🇨🇫", name:"Centrafrique",           growth:1.5,  inflation:5.3, debt:60, fiscal:-5.0, ca:-12.0},
      COG:{ flag:"🇨🇬", name:"Congo (Brazzaville)",    growth:4.1,  inflation:4.0, debt:89, fiscal:-0.3, ca:1.0  },
      GAB:{ flag:"🇬🇦", name:"Gabon",                 growth:2.5,  inflation:4.8, debt:75, fiscal:-1.8, ca:2.5  },
      GNQ:{ flag:"🇬🇶", name:"Guinée équatoriale",    growth:-2.0, inflation:5.0, debt:47, fiscal:-6.5, ca:-4.0 },
    },
  },
  {
    id: "SADC",
    label: "SADC",
    fullName: "Communauté de Développement de l'Afrique Australe",
    color: "#F59E0B",
    founded: "1992",
    hq: "Gaborone, Botswana",
    members: 16,
    description: "16 pays · Zone de libre-échange · Intégration économique et sécuritaire",
    countries: ["AGO","BWA","COM","COD","LSO","MDG","MWI","MUS","MOZ","NAM","SYC","ZAF","SWZ","TZA","ZMB","ZWE"],
    macroData: {
      AGO:{ flag:"🇦🇴", name:"Angola",          growth:2.4, inflation:28.2, debt:73,  fiscal:-1.0, ca:4.5  },
      BWA:{ flag:"🇧🇼", name:"Botswana",        growth:3.5, inflation:5.5,  debt:19,  fiscal:-1.5, ca:-1.6 },
      COM:{ flag:"🇰🇲", name:"Comores",         growth:3.1, inflation:5.0,  debt:37,  fiscal:-2.5, ca:-3.0 },
      COD:{ flag:"🇨🇩", name:"Congo (RDC)",     growth:6.3, inflation:23.6, debt:15,  fiscal:-1.0, ca:-3.7 },
      LSO:{ flag:"🇱🇸", name:"Lesotho",        growth:1.8, inflation:7.0,  debt:65,  fiscal:-5.5, ca:3.0  },
      MDG:{ flag:"🇲🇬", name:"Madagascar",      growth:4.8, inflation:8.0,  debt:57,  fiscal:-4.8, ca:-6.0 },
      MWI:{ flag:"🇲🇼", name:"Malawi",          growth:1.8, inflation:25.0, debt:92,  fiscal:-7.0, ca:-9.0 },
      MUS:{ flag:"🇲🇺", name:"Maurice",         growth:5.6, inflation:7.0,  debt:85,  fiscal:-4.0, ca:-5.9 },
      MOZ:{ flag:"🇲🇿", name:"Mozambique",      growth:5.5, inflation:6.2,  debt:100, fiscal:-5.0, ca:-26.0},
      NAM:{ flag:"🇳🇦", name:"Namibie",         growth:3.6, inflation:5.8,  debt:68,  fiscal:-5.2, ca:-10.0},
      SYC:{ flag:"🇸🇨", name:"Seychelles",      growth:5.0, inflation:4.5,  debt:65,  fiscal:-1.5, ca:-10.0},
      ZAF:{ flag:"🇿🇦", name:"Afrique du Sud",  growth:1.1, inflation:4.6,  debt:75,  fiscal:-5.0, ca:-1.6 },
      SWZ:{ flag:"🇸🇿", name:"Eswatini",        growth:2.0, inflation:5.9,  debt:52,  fiscal:-2.8, ca:0.5  },
      TZA:{ flag:"🇹🇿", name:"Tanzanie",        growth:5.4, inflation:3.1,  debt:42,  fiscal:-3.0, ca:-3.5 },
      ZMB:{ flag:"🇿🇲", name:"Zambie",          growth:4.8, inflation:13.0, debt:137, fiscal:-7.6, ca:1.5  },
      ZWE:{ flag:"🇿🇼", name:"Zimbabwe",        growth:3.0, inflation:165.0,debt:95,  fiscal:-3.0, ca:-6.0 },
    },
  },
  {
    id: "EAC",
    label: "EAC",
    fullName: "Communauté de l'Afrique de l'Est",
    color: "#10B981",
    founded: "2000",
    hq: "Arusha, Tanzanie",
    members: 8,
    description: "8 pays · Union douanière · Marché commun en cours · Monnaie unique visée 2030",
    countries: ["BDI","COD","KEN","RWA","SSD","TZA","UGA","ZMB"],
    macroData: {
      BDI:{ flag:"🇧🇮", name:"Burundi",      growth:2.2, inflation:22.0, debt:70,  fiscal:-5.0, ca:-13.0},
      COD:{ flag:"🇨🇩", name:"Congo (RDC)",  growth:6.3, inflation:23.6, debt:15,  fiscal:-1.0, ca:-3.7 },
      KEN:{ flag:"🇰🇪", name:"Kenya",        growth:5.0, inflation:6.5,  debt:70,  fiscal:-5.5, ca:-4.0 },
      RWA:{ flag:"🇷🇼", name:"Rwanda",       growth:7.0, inflation:5.8,  debt:68,  fiscal:-6.0, ca:-11.4},
      SSD:{ flag:"🇸🇸", name:"Soudan du Sud",growth:0.5, inflation:55.0, debt:60,  fiscal:-5.0, ca:-8.0 },
      TZA:{ flag:"🇹🇿", name:"Tanzanie",     growth:5.4, inflation:3.1,  debt:42,  fiscal:-3.0, ca:-3.5 },
      UGA:{ flag:"🇺🇬", name:"Ouganda",      growth:6.1, inflation:3.8,  debt:50,  fiscal:-4.4, ca:-9.2 },
      ZMB:{ flag:"🇿🇲", name:"Zambie",       growth:4.8, inflation:13.0, debt:137, fiscal:-7.6, ca:1.5  },
    },
  },
  {
    id: "COMESA",
    label: "COMESA",
    fullName: "Marché Commun de l'Afrique Orientale et Australe",
    color: "#EC4899",
    founded: "1994",
    hq: "Lusaka, Zambie",
    members: 21,
    description: "21 pays · Zone de libre-échange · Commerce intra-régional · 630M habitants",
    countries: ["BDI","COM","COD","DJI","EGY","ERI","ETH","KEN","LBY","MDG","MWI","MUS","MAR","MOZ","RWA","SYC","SOM","SUD","SWZ","UGA","ZMB","ZWE"],
    macroData: {
      BDI:{ flag:"🇧🇮", name:"Burundi",    growth:2.2, inflation:22.0, debt:70,  fiscal:-5.0, ca:-13.0},
      COM:{ flag:"🇰🇲", name:"Comores",    growth:3.1, inflation:5.0,  debt:37,  fiscal:-2.5, ca:-3.0 },
      COD:{ flag:"🇨🇩", name:"Congo RDC",  growth:6.3, inflation:23.6, debt:15,  fiscal:-1.0, ca:-3.7 },
      DJI:{ flag:"🇩🇯", name:"Djibouti",  growth:7.1, inflation:3.0,  debt:73,  fiscal:-1.5, ca:-6.0 },
      EGY:{ flag:"🇪🇬", name:"Égypte",    growth:2.7, inflation:28.3, debt:90,  fiscal:-7.2, ca:-5.4 },
      ERI:{ flag:"🇪🇷", name:"Érythrée",  growth:2.5, inflation:5.0,  debt:180, fiscal:-12.0,ca:-4.0 },
      ETH:{ flag:"🇪🇹", name:"Éthiopie",  growth:6.8, inflation:24.1, debt:38,  fiscal:-2.6, ca:-3.1 },
      KEN:{ flag:"🇰🇪", name:"Kenya",      growth:5.0, inflation:6.5,  debt:70,  fiscal:-5.5, ca:-4.0 },
      LBY:{ flag:"🇱🇾", name:"Libye",     growth:4.0, inflation:2.8,  debt:84,  fiscal:4.0,  ca:13.3 },
      MDG:{ flag:"🇲🇬", name:"Madagascar", growth:4.8, inflation:8.0,  debt:57,  fiscal:-4.8, ca:-6.0 },
      MWI:{ flag:"🇲🇼", name:"Malawi",    growth:1.8, inflation:25.0, debt:92,  fiscal:-7.0, ca:-9.0 },
      MUS:{ flag:"🇲🇺", name:"Maurice",   growth:5.6, inflation:7.0,  debt:85,  fiscal:-4.0, ca:-5.9 },
      MAR:{ flag:"🇲🇦", name:"Maroc",     growth:3.2, inflation:2.4,  debt:69,  fiscal:-4.1, ca:-1.2 },
      MOZ:{ flag:"🇲🇿", name:"Mozambique",growth:5.5, inflation:6.2,  debt:100, fiscal:-5.0, ca:-26.0},
      RWA:{ flag:"🇷🇼", name:"Rwanda",    growth:7.0, inflation:5.8,  debt:68,  fiscal:-6.0, ca:-11.4},
      SYC:{ flag:"🇸🇨", name:"Seychelles",growth:5.0, inflation:4.5,  debt:65,  fiscal:-1.5, ca:-10.0},
      SOM:{ flag:"🇸🇴", name:"Somalie",   growth:3.5, inflation:3.5,  debt:80,  fiscal:-1.0, ca:-10.0},
      SUD:{ flag:"🇸🇩", name:"Soudan",    growth:0.5, inflation:65.0, debt:183, fiscal:-3.0, ca:-5.0 },
      SWZ:{ flag:"🇸🇿", name:"Eswatini",  growth:2.0, inflation:5.9,  debt:52,  fiscal:-2.8, ca:0.5  },
      UGA:{ flag:"🇺🇬", name:"Ouganda",   growth:6.1, inflation:3.8,  debt:50,  fiscal:-4.4, ca:-9.2 },
      ZMB:{ flag:"🇿🇲", name:"Zambie",    growth:4.8, inflation:13.0, debt:137, fiscal:-7.6, ca:1.5  },
      ZWE:{ flag:"🇿🇼", name:"Zimbabwe",  growth:3.0, inflation:165.0,debt:95,  fiscal:-3.0, ca:-6.0 },
    },
  },
  {
    id: "IGAD",
    label: "IGAD",
    fullName: "Autorité Intergouvernementale pour le Développement",
    color: "#F97316",
    founded: "1996",
    hq: "Djibouti, Djibouti",
    members: 8,
    description: "8 pays · Corne de l'Afrique · Paix, sécurité & développement",
    countries: ["DJI","ERI","ETH","KEN","SOM","SSD","SUD","UGA"],
    macroData: {
      DJI:{ flag:"🇩🇯", name:"Djibouti",    growth:7.1, inflation:3.0,  debt:73,  fiscal:-1.5, ca:-6.0 },
      ERI:{ flag:"🇪🇷", name:"Érythrée",    growth:2.5, inflation:5.0,  debt:180, fiscal:-12.0,ca:-4.0 },
      ETH:{ flag:"🇪🇹", name:"Éthiopie",    growth:6.8, inflation:24.1, debt:38,  fiscal:-2.6, ca:-3.1 },
      KEN:{ flag:"🇰🇪", name:"Kenya",        growth:5.0, inflation:6.5,  debt:70,  fiscal:-5.5, ca:-4.0 },
      SOM:{ flag:"🇸🇴", name:"Somalie",      growth:3.5, inflation:3.5,  debt:80,  fiscal:-1.0, ca:-10.0},
      SSD:{ flag:"🇸🇸", name:"Soudan du Sud",growth:0.5, inflation:55.0, debt:60,  fiscal:-5.0, ca:-8.0 },
      SUD:{ flag:"🇸🇩", name:"Soudan",       growth:0.5, inflation:65.0, debt:183, fiscal:-3.0, ca:-5.0 },
      UGA:{ flag:"🇺🇬", name:"Ouganda",      growth:6.1, inflation:3.8,  debt:50,  fiscal:-4.4, ca:-9.2 },
    },
  },
  {
    id: "UMA",
    label: "UMA",
    fullName: "Union du Maghreb Arabe",
    color: "#06B6D4",
    founded: "1989",
    hq: "Rabat, Maroc",
    members: 5,
    description: "5 pays · Afrique du Nord · Intégration bloquée depuis 1994 (tension Algérie-Maroc)",
    countries: ["DZA","LBY","MAR","MRT","TUN"],
    macroData: {
      DZA:{ flag:"🇩🇿", name:"Algérie",    growth:3.6, inflation:9.2, debt:60, fiscal:-5.8, ca:2.4  },
      LBY:{ flag:"🇱🇾", name:"Libye",      growth:4.0, inflation:2.8, debt:84, fiscal:4.0,  ca:13.3 },
      MAR:{ flag:"🇲🇦", name:"Maroc",      growth:3.2, inflation:2.4, debt:69, fiscal:-4.1, ca:-1.2 },
      MRT:{ flag:"🇲🇷", name:"Mauritanie", growth:3.9, inflation:6.3, debt:60, fiscal:-1.0, ca:-7.0 },
      TUN:{ flag:"🇹🇳", name:"Tunisie",    growth:1.8, inflation:9.3, debt:80, fiscal:-7.7, ca:-6.2 },
    },
  },
  {
    id: "AES",
    label: "AES",
    fullName: "Alliance des États du Sahel",
    color: "#EF4444",
    founded: "2023",
    hq: "Bamako, Mali (siège provisoire)",
    members: 3,
    description: "3 pays · Sahel · Créée juillet 2023 après retrait CEDEAO · Confédération en cours",
    countries: ["BFA","MLI","NER"],
    macroData: {
      BFA:{ flag:"🇧🇫", name:"Burkina Faso", growth:2.5,  inflation:3.0, debt:54, fiscal:-4.5, ca:-4.1  },
      MLI:{ flag:"🇲🇱", name:"Mali",         growth:4.0,  inflation:2.5, debt:50, fiscal:-3.5, ca:-5.5  },
      NER:{ flag:"🇳🇪", name:"Niger",        growth:12.3, inflation:3.9, debt:52, fiscal:-6.8, ca:-16.0 },
    },
  },
];

const INDICATOR_LABELS: Record<string, { label: string; unit: string }> = {
  growth:    { label: "Croissance",  unit: "%" },
  inflation: { label: "Inflation",   unit: "%" },
  debt:      { label: "Dette pub.",  unit: "% PIB" },
  fiscal:    { label: "Solde budg.", unit: "% PIB" },
  ca:        { label: "Cpt. courant",unit: "% PIB" },
};

function StatusIcon({ status }: { status: "ok" | "breach" | "no_data" }) {
  if (status === "ok")     return <CheckCircle2 size={15} color="#00D4AA" />;
  if (status === "breach") return <XCircle size={15} color="#ef4444" />;
  return <MinusCircle size={15} color="#6b7280" />;
}

export default function RegionsPage() {
  const [activeRec, setActiveRec] = useState("CEDEAO");
  const [year, setYear]           = useState(2024);

  const rec = RECS.find(r => r.id === activeRec)!;

  // Appel API uniquement pour UEMOA/CEMAC (critères de convergence officiels)
  const { data: apiData } = useQuery({
    queryKey: ["region", rec.apiZone, year],
    queryFn: () => rec.apiZone ? macroApi.getRegion(rec.apiZone, year) : Promise.resolve(null),
    staleTime: 10 * 60 * 1000,
    retry: false,
    enabled: !!rec.apiZone,
  });

  const apiCountries = apiData?.countries ?? [];
  const criteria     = apiData?.convergence_criteria ?? {};
  const criteriaKeys = Object.keys(criteria);
  const isLive       = apiCountries.length > 0;

  // Données à afficher : API si disponible, sinon données statiques intégrées
  const displayCountries = isLive
    ? apiCountries
    : rec.countries.map(id => ({
        country_id: id,
        ...rec.macroData[id],
        indicators: {
          NGDP_RPCH: rec.macroData[id]?.growth,
          PCPIPCH:   rec.macroData[id]?.inflation,
          GGXWDG_NGDP: rec.macroData[id]?.debt,
          GGXCNL_NGDP: rec.macroData[id]?.fiscal,
          BCA_NGDPD:   rec.macroData[id]?.ca,
        },
      })).filter(c => c.name);

  // Agrégats régionaux
  const avgGrowth    = displayCountries.reduce((s: number, c: any) => s + (c.growth ?? c.indicators?.NGDP_RPCH ?? 0), 0) / (displayCountries.length || 1);
  const avgInflation = displayCountries.reduce((s: number, c: any) => s + (c.inflation ?? c.indicators?.PCPIPCH ?? 0), 0) / (displayCountries.length || 1);
  const avgDebt      = displayCountries.reduce((s: number, c: any) => s + (c.debt ?? c.indicators?.GGXWDG_NGDP ?? 0), 0) / (displayCountries.length || 1);

  // Métadonnées pour la carte régionale (nom, drapeau, croissance) + classement
  const mapMeta: Record<string, { name?: string; flag?: string; value?: number }> = {};
  for (const c of displayCountries as any[]) {
    const g = c.growth ?? c.indicators?.NGDP_RPCH;
    mapMeta[c.country_id] = { name: c.name, flag: c.flag, value: typeof g === "number" ? g : undefined };
  }
  const mapCountryIds = (displayCountries as any[]).map((c) => c.country_id);
  const topGrowth = [...(displayCountries as any[])]
    .map((c) => ({ id: c.country_id, name: c.name, flag: c.flag, growth: c.growth ?? c.indicators?.NGDP_RPCH }))
    .filter((c) => typeof c.growth === "number")
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Analyse Régionale
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            8 Communautés Économiques Régionales de l'UA · Alliance des États du Sahel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataSourceBadge isLive={isLive} />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg text-xs"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
          >
            {[2024, 2023, 2022, 2021].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Onglets CER */}
      <div className="flex gap-1.5 flex-wrap">
        {RECS.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRec(r.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
            style={{
              background: activeRec === r.id ? `color-mix(in srgb, ${r.color} 15%, transparent)` : "var(--card-bg)",
              color:      activeRec === r.id ? r.color : "var(--text-muted)",
              borderColor: activeRec === r.id ? r.color : "var(--bg-border)",
            }}
          >
            {r.label}
            {r.id === "AES" && (
              <span className="ml-1 text-[9px] px-1 py-0.5 rounded" style={{ background: "#EF444420", color: "#EF4444" }}>
                NEW
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Info CER */}
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: `color-mix(in srgb, ${rec.color} 6%, var(--card-bg))`,
          borderColor: `color-mix(in srgb, ${rec.color} 20%, var(--bg-border))`,
        }}
      >
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: rec.color }}>{rec.fullName}</h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{rec.description}</p>
            <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>📅 Fondée : <strong style={{ color: "var(--text-secondary)" }}>{rec.founded}</strong></span>
              <span>🏛 Siège : <strong style={{ color: "var(--text-secondary)" }}>{rec.hq}</strong></span>
              <span><Users size={10} className="inline mr-1" /><strong style={{ color: "var(--text-secondary)" }}>{rec.members} États membres</strong></span>
            </div>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Croissance moy.</p>
              <p className="text-xl font-bold" style={{ color: avgGrowth >= 4 ? "#10B981" : avgGrowth >= 2 ? "#F59E0B" : "#EF4444" }}>
                +{avgGrowth.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Inflation moy.</p>
              <p className="text-xl font-bold" style={{ color: avgInflation < 6 ? "#10B981" : avgInflation < 15 ? "#F59E0B" : "#EF4444" }}>
                {avgInflation.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Dette moy.</p>
              <p className="text-xl font-bold" style={{ color: avgDebt < 60 ? "#10B981" : avgDebt < 80 ? "#F59E0B" : "#EF4444" }}>
                {avgDebt.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {rec.currency && (
          <div className="mt-3 pt-3 border-t flex gap-4 text-xs" style={{ borderColor: `color-mix(in srgb, ${rec.color} 20%, var(--bg-border))` }}>
            <span style={{ color: "var(--text-muted)" }}>💱 Monnaie : <strong style={{ color: rec.color }}>{rec.currency}</strong></span>
            {rec.bank && <span style={{ color: "var(--text-muted)" }}>🏦 Banque centrale : <strong style={{ color: "var(--text-secondary)" }}>{rec.bank}</strong></span>}
          </div>
        )}

        {/* Critères de convergence (UEMOA/CEMAC uniquement via API) */}
        {criteriaKeys.length > 0 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: `color-mix(in srgb, ${rec.color} 20%, var(--bg-border))` }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
              CRITÈRES DE CONVERGENCE {rec.id}
            </p>
            <div className="flex flex-wrap gap-2">
              {criteriaKeys.map((k) => (
                <span key={k} className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--bg-border)" }}>
                  {criteria[k].label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Note AES */}
        {rec.id === "AES" && (
          <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: "#EF444430", color: "#EF4444" }}>
            ⚠ BFA, MLI, NER ont officiellement quitté la CEDEAO (janvier 2025). L'AES est en cours de structuration institutionnelle. Données source : FMI WEO 2024.
          </div>
        )}
      </div>

      {/* Carte de la zone + classement croissance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RegionMap
          key={rec.id}
          countryIds={mapCountryIds}
          meta={mapMeta}
          color={rec.color}
          valueLabel="Croissance"
          valueUnit="%"
        />
        <div className="mansa-card rounded-2xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} style={{ color: rec.color }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Croissance la plus forte — {rec.label}
            </h3>
          </div>
          {topGrowth.length === 0 ? (
            <p className="text-xs m-auto" style={{ color: "var(--text-muted)" }}>Aucune donnée de croissance.</p>
          ) : (
            <div className="space-y-2 flex-1">
              {topGrowth.map((c, i) => {
                const w = Math.max(4, Math.min(100, (c.growth / (topGrowth[0].growth || 1)) * 100));
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-xs font-mono w-4 text-right" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                    <span className="text-base w-6">{c.flag ?? "🌍"}</span>
                    <span className="text-xs w-28 truncate" style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-border)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, background: rec.color }} />
                    </div>
                    <span className="text-xs font-mono font-semibold w-14 text-right"
                          style={{ color: c.growth >= 5 ? "#10B981" : c.growth >= 2 ? "var(--text-primary)" : "#EF4444" }}>
                      {c.growth > 0 ? "+" : ""}{c.growth.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
            Survolez la carte pour les détails · cliquez un pays pour son profil complet.
          </p>
        </div>
      </div>

      {/* Tableau des pays */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--bg-border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--bg-border)" }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: "var(--text-muted)" }}>Pays</th>
                {criteriaKeys.length > 0 && (
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "var(--text-muted)" }}>Convergence</th>
                )}
                {Object.entries(INDICATOR_LABELS).map(([k, v]) => (
                  <th key={k} className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {v.label}
                    <span className="block text-[10px] font-normal">{v.unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayCountries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                    <Globe2 size={32} className="mx-auto mb-2 opacity-30" />
                    Aucune donnée disponible pour cette zone
                  </td>
                </tr>
              ) : displayCountries.map((country: any, idx: number) => {
                const vals = {
                  growth:    country.growth    ?? country.indicators?.NGDP_RPCH,
                  inflation: country.inflation ?? country.indicators?.PCPIPCH,
                  debt:      country.debt      ?? country.indicators?.GGXWDG_NGDP,
                  fiscal:    country.fiscal    ?? country.indicators?.GGXCNL_NGDP,
                  ca:        country.ca        ?? country.indicators?.BCA_NGDPD,
                };
                return (
                  <tr key={country.country_id}
                      style={{ borderBottom: idx < displayCountries.length - 1 ? "1px solid var(--bg-border)" : "none" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{country.flag ?? "🌍"}</span>
                        <div>
                          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{country.name}</div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{country.country_id}</div>
                        </div>
                      </div>
                    </td>

                    {criteriaKeys.length > 0 && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {criteriaKeys.map((k) => (
                            <StatusIcon key={k} status={country.convergence?.[k] ?? "no_data"} />
                          ))}
                        </div>
                      </td>
                    )}

                    {(["growth","inflation","debt","fiscal","ca"] as const).map((key) => {
                      const v = vals[key];
                      const isNeg = v !== undefined && v < 0;
                      const color = v === undefined ? "var(--text-muted)"
                        : key === "growth"    ? (v >= 5 ? "#10B981" : v >= 2 ? "var(--text-primary)" : "#EF4444")
                        : key === "inflation" ? (v < 6 ? "#10B981" : v < 15 ? "#F59E0B" : "#EF4444")
                        : key === "debt"      ? (v < 60 ? "#10B981" : v < 80 ? "#F59E0B" : "#EF4444")
                        : isNeg              ? "#EF4444" : "var(--text-primary)";
                      return (
                        <td key={key} className="px-4 py-3 text-right font-semibold tabular-nums"
                            style={{ color }}>
                          {v !== undefined ? v.toFixed(1) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Source : MANSA Database · FMI WEO {year} · Banque Mondiale WDI · Données 2024e/2025e.
        Les valeurs négatives sont en rouge. {!isLive && "Données estimées — connectez Dagster pour les données live."}
      </p>
    </div>
  );
}
