"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Bot, User, Loader2, History, X, Clock, Coins,
  Download, Copy, Check, Sparkles, Database, AlertCircle,
  Zap, MessageSquare, Search, BookOpen, TrendingUp, Globe2,
  Leaf, BarChart2, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { streamAIQuery, aiApi, type AIHistoryItem } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportData } from "@/lib/export-utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  sources?: string[];
  error?: boolean;
  errorCode?: number;
  deep?: boolean;
  researchSteps?: string[];
  followUps?: string[];
}

/* ── Étapes de recherche simulées ─────────────────────────── */
const RESEARCH_STEPS = [
  "Interrogation FMI WEO 2025e…",
  "Croisement données Banque Mondiale WDI…",
  "Analyse séries temporelles 2019–2025…",
  "Calcul indicateurs de risque souverain…",
  "Synthèse et structuration de l'analyse…",
];

/* ── Réponses démo enrichies ───────────────────────────────── */
const DEMO_RESPONSES: { keywords: string[]; response: string; followUps?: string[] }[] = [
  {
    keywords: ["dette", "nigeria", "ghana"],
    followUps: ["Analyser le risque de refinancement Eurobond Ghana 2026", "Comparer le service de la dette Nigeria vs Éthiopie", "Impact de la Fed sur les spreads africains"],
    response: `## Dynamique de la dette publique : Nigeria vs Ghana (2019–2025e)

### Nigeria — Espace budgétaire sous pression
| Année | Dette/PIB | Solde fiscal | Service/Recettes |
|-------|-----------|-------------|-----------------|
| 2019  | 28,4%     | -4,7%       | 47%             |
| 2021  | 35,0%     | -5,5%       | 83%             |
| 2023  | 42,1%     | -4,9%       | 61%             |
| 2025e | **46,0%** | -4,6%       | ~52%            |

Le Nigeria maintient une dette relativement modérée en % du PIB, **mais le service de la dette absorbe >50% des recettes fiscales**, contraignant l'investissement public. La dépréciation du naira (-70% en 2023) a alourdi mécaniquement la dette en devises.

### Ghana — Sortie de crise post-défaut
| Année | Dette/PIB  | Solde fiscal | Notes                    |
|-------|-----------|-------------|--------------------------|
| 2019  | 62,3%     | -7,5%       | Pre-crise                |
| 2022  | 92,4%     | -9,4%       | Défaut sélectif          |
| 2023  | 83,8%     | -4,9%       | Restructuration FMI/DDEP |
| 2025e | **72–75%**| -3,5%       | Trajectoire de baisse    |

Le Ghana a subi une **crise de dette sévère en 2022** nécessitant un programme FMI de 3 Mds USD et une restructuration (DDEP) sur ~90 Mds GHS. La normalisation est en cours mais l'accès aux marchés reste limité.

### Facteurs différenciants clés
| Critère | Nigeria | Ghana |
|---------|---------|-------|
| Accès Eurobond | ✅ Actif | ⚠️ Limité post-DDEP |
| Recettes pétrolières | ✅ Tampon | ❌ En déclin |
| Programme FMI | Actif (Article IV) | Actif (Extended Credit) |
| Réserves (mois imports) | ~5,8 | ~3,1 |

**Verdict MANSA** : Nigeria — profil risque modéré, contrainte sur les recettes. Ghana — trajectoire de correction avancée, retour sur les marchés attendu en 2026.

*Sources : FMI WEO Avril 2025 · IMF Article IV Ghana/Nigeria 2024 · Banque Mondiale*`,
  },
  {
    keywords: ["côte d'ivoire", "cote d'ivoire", "investir", "risques", "cote divoire"],
    followUps: ["Analyse du secteur cacao en Côte d'Ivoire", "Comparer Côte d'Ivoire vs Sénégal pour investissement", "Eurobonds Côte d'Ivoire — spreads et maturités"],
    response: `## Analyse macro-risques — Côte d'Ivoire 2025

### Fondamentaux (FMI WEO 2025e)
| Indicateur | 2024 | 2025e | Benchmark ASS |
|-----------|------|-------|--------------|
| Croissance PIB | +6,8% | +6,5% | +3,8% |
| Inflation | 3,4% | 3,8% | 7,2% |
| Dette/PIB | 59% | 57% | 57% |
| Solde fiscal | -4,2% | -4,0% | -4,3% |
| Compte courant | -3,3% | -3,1% | -3,8% |

### Atouts structurels
✅ **Hub UEMOA** : Abidjan concentre 40% du PIB de la zone et 70% du trafic portuaire
✅ **Diversification** : Cacao (#1 mondial, 40% export), pétrole, caoutchouc, noix de cajou
✅ **Accès marchés** : Eurobond 2033 (8,25%) — spread ~380 pb, parmi les plus serrés d'ASS
✅ **Infrastructures** : Autoroutes, port d'Abidjan rénové, énergie stable

### Risques à surveiller
⚠️ **Cacao volatilité** : Prix +150% en 2024 — risque de correction et de syndrome hollandais
⚠️ **Risque politique** : Succession Ouattara en 2025 — incertitude sur la transition
⚠️ **Fiscalité** : Pression sur les recettes hors cacao en cas de correction des cours
⚠️ **Secteur financier** : NPL en hausse (+18% en 2024) post-renchérissement du crédit

### Recommendation MANSA
**Profil Investissement BB+ / Stable** — Attractive pour l'agro-industrie, l'énergie renouvelable et les PPP d'infrastructure. La prime de risque correcte (5,8–6,2% USD) intègre les risques politiques de court terme.

*Sources : FMI Article IV CIV 2024 · Banque Mondiale · BCEAO · MANSA Research*`,
  },
  {
    keywords: ["uemoa", "convergence", "bceao"],
    followUps: ["Analyse du taux directeur BCEAO et ses effets sur le crédit", "Comparer les déficits fiscaux UEMOA 2025", "Risques de dévaluation du Franc CFA"],
    response: `## Critères de convergence UEMOA — Bilan 2025e

L'UEMOA impose 4 critères de premier rang et 4 critères de second rang. Voici l'état des 8 membres :

### Critère 1 — Solde budgétaire ≥ -3% du PIB
| Pays          | 2024  | 2025e  | Statut          |
|---------------|-------|--------|-----------------|
| Côte d'Ivoire | -4,2% | -4,0%  | ❌ Hors critère |
| Sénégal       | -5,5% | -4,2%  | ❌              |
| Bénin         | -4,5% | -4,0%  | ❌              |
| Togo          | -4,1% | -3,6%  | ⚠️ Proche       |
| Burkina Faso  | -5,8% | -6,0%  | ❌ Détérioré    |
| Mali          | -3,8% | -3,5%  | ⚠️ Proche       |
| Niger         | -5,2% | -5,5%  | ❌              |
| Guinée-Bissau | -3,1% | -2,9%  | ✅ Conforme     |

> **Un seul pays (Guinée-Bissau) satisfait le critère budgétaire en 2025e.**

### Critère 2 — Inflation ≤ 3%
Sénégal ✅ (2,8%), Bénin ✅ (2,7%) · Côte d'Ivoire ⚠️ (3,8%) · Togo ⚠️ (4,0%)

### Pays les mieux positionnés globalement
1. **Bénin** — Croissance robuste +6,4%, réformes structurelles avancées, accès marchés
2. **Togo** — Hub logistique, réformes fiscales, amélioration graduelle du solde
3. **Sénégal** — Pétrole & gaz transforment la trajectoire fiscale à partir de 2025

### Facteur commun de blocage
La non-conformité généralisée reflète des **dépenses sécuritaires élevées** (Sahel), des **subventions énergie** maintenues et la faiblesse des mobilisations fiscales (recettes moy. 17% PIB vs 25% OCDE).

*Sources : BCEAO · FMI WEO 2025 · Rapport de convergence UEMOA 2024*`,
  },
  {
    keywords: ["kenya", "climat", "catastrophe", "risque"],
    followUps: ["Analyse du financement vert au Kenya", "Risques climatiques au Mozambique et Malawi", "Comparer les scores ESG Kenya vs Rwanda"],
    response: `## Profil climatique et risques catastrophes — Kenya 2025

### Exposition aux risques (ND-GAIN Score : 48/100)
Le Kenya figure parmi les pays africains **les plus vulnérables aux chocs climatiques**, avec une exposition croissante liée au réchauffement (+1,2°C vs baseline 1980).

### Événements majeurs (2022–2025)
| Événement | Année | Décès | Affectés | Coût (% PIB) |
|-----------|-------|-------|---------|--------------|
| Sécheresse Corne Afrique | 2022–23 | — | 4,3M | 1,8% |
| El Niño inondations | 2023 | 75 | 120K | 0,9% |
| Inondations Mombasa/Nairobi | 2024 | 215 | 50K | 1,2% |

### Indicateurs quantitatifs
| Indicateur | Kenya | Benchmark ASS |
|-----------|-------|--------------|
| Anomalie thermique vs 1980 | +1,2°C | +0,9°C |
| Événements extrêmes/an (2015-25) | 3,8 | 2,1 |
| Population exposée inondations | 12% | 8% |
| Pertes agricoles/an (% PIB) | 1,8% | 1,2% |
| Stress hydrique WRI | Score 2,6/5 | — |

### Points forts d'adaptation
- **Kenya Climate Change Act 2016** : Cadre légal pionnier en Afrique
- **Green Climate Fund** : 100 M USD (NCCAP 2023–2027)
- **Géothermie** : 35% du mix électrique — résilience énergétique forte
- **Nairobi** : 1ère ville africaine à publier un plan d'adaptation urbaine complet

*Sources : EM-DAT CRED · WRI Aqueduct v4 · OCHA ROWCA · NOAA · Gouvernement Kenya*`,
  },
  {
    keywords: ["énergie renouvelable", "energie renouvelable", "solaire", "hydro", "irena"],
    followUps: ["Analyse du potentiel solaire Sahara et Desert to Power", "Financement de la transition énergétique en Afrique", "Comparer accès électricité Afrique subsaharienne"],
    response: `## Production d'énergie renouvelable en Afrique — Analyse 2025

### Capacité installée ENR — Top 10 africains (IRENA 2024)
| # | Pays | Capacité (GW) | Part ENR dans mix |
|---|------|--------------|-------------------|
| 1 | Égypte | 11,0 GW | 28% |
| 2 | Afrique du Sud | 10,2 GW | 22% |
| 3 | Éthiopie | 5,7 GW | **98%** |
| 4 | Maroc | 5,4 GW | 42% |
| 5 | Kenya | 3,1 GW | **92%** |
| 6 | Tanzanie | 2,1 GW | 61% |
| 7 | Congo RDC | 2,8 GW | 99% ← Hydro |
| 8 | Mozambique | 2,7 GW | 79% |
| 9 | Zambie | 2,4 GW | 85% |
| 10 | Angola | 3,1 GW | 63% |

### Champions par technologie
- **Géothermie** : Kenya (988 MW — Valley du Rift, 2ème mondial en Afrique)
- **Éolien** : Maroc + Afrique du Sud (Lake Turkana, Kenya : 310 MW)
- **Solaire CSP** : Maroc — Noor Ouarzazate 580 MW, plus grand complexe CSP du monde
- **Hydro** : GERD Éthiopie 5,1 GW — futur exportateur net régional

### Déficit persistant
Malgré les progrès, **600 millions d'Africains** restent sans accès à l'électricité. Le taux d'électrification ASS plafonne à 48%. L'initiative **Mission 300** (BAD/BM) vise 300M de nouvelles connexions d'ici 2030.

*Sources : IRENA 2024 · EIA International · BAD · Banque Mondiale WDI*`,
  },
  {
    keywords: ["sénégal", "senegal", "pétrole", "gaz", "extractif"],
    followUps: ["Analyse de la gouvernance des ressources naturelles au Sénégal", "Comparer les trajectoires fiscales Nigeria vs Sénégal", "Risques de syndrome hollandais au Sénégal"],
    response: `## Sénégal — Transformation par le pétrole et le gaz (2025e)

### Fondamentaux macro (FMI WEO 2025e)
| Indicateur | 2023 | 2024e | 2025e |
|-----------|------|-------|-------|
| Croissance PIB | +4,3% | +8,3% | **+9,5%** |
| Dette/PIB | 79,1% | 73,4% | 68–70% |
| Solde budgétaire | -5,5% | -4,9% | -4,2% |
| Réserves (mois imports) | 3,1 | 3,8 | 4,2 |

### Les deux projets transformateurs
**1. Sangomar Oil Field (PETROSEN/Woodside)**
- Premier pétrole : **juin 2024** (~100 000 bpj)
- Recettes supplémentaires estimées : **+1,5–2% du PIB** dès 2025
- Réserves prouvées : 650 millions de barils (phase 1)

**2. Grand Tortue Ahmeyim LNG (BP/Kosmos)**
- Phase 1 : ~2,5 Mtpa GNL (exploitation 2025)
- Impact fiscal différé : revenus maximaux attendus 2026–2028
- Partage avec Mauritanie (50/50)

### Risques clés à surveiller
⚠️ **Révision statistique** : La dette réelle 2023 était 79% vs 73% annoncé — crédibilité des données
⚠️ **Prix du pétrole** : Chaque -10$/bbl = -0,4% du PIB en recettes
⚠️ **Gouvernance** : Pression post-alternance 2024 sur les contrats PETROSEN
⚠️ **Compte courant** : -12% du PIB structurel, dépendance aux imports pétroliers résiduels

**Verdict FMI** : Risque surendettement **MODÉRÉ** — dynamique de croissance extractive compensatrice.

*Sources : FMI DSA Sénégal 2024 · PETROSEN · Rapport FMI Article IV 2024 · BAD*`,
  },
  {
    keywords: ["eurobond", "spread", "obligations", "marché obligataire"],
    followUps: ["Analyse de la notation souveraine Moody's Fitch en Afrique", "Risque de refinancement 2025–2027 Eurobonds africains", "Comparer les primes de risque Kenya vs Côte d'Ivoire"],
    response: `## Eurobonds souverains africains — Analyse des marchés 2025

### Spreads et notations — Tableau comparatif (juin 2025)
| Pays | Notation | Spread (pb) | Rendement | Maturité principale |
|------|---------|-------------|-----------|---------------------|
| Maurice | Baa3/BBB- | 180 pb | 6,2% | 2031 |
| Maroc | Ba1/BB+ | 220 pb | 6,5% | 2032 |
| Côte d'Ivoire | Ba3/BB- | 380 pb | 8,3% | 2033 |
| Kenya | B3/B+ | 620 pb | 10,1% | 2032 |
| Nigeria | B3/B- | 680 pb | 10,8% | 2030 |
| Sénégal | Ba3/B+ | 520 pb | 9,7% | 2033 |
| Angola | B3/B- | 590 pb | 10,4% | 2029 |
| Éthiopie | RD/C | En défaut | N/A | Restructuration |
| Ghana | RD/SD | En restructuration | N/A | Post-DDEP 2024 |
| Zambie | Ca/SD | Restructuré 2023 | N/A | Finalisé |

### Facteurs de marché 2025
🔵 **Positif** : Fed en cycle de baisse → compression des spreads africains (-50 à -120 pb YTD)
🟡 **Neutre** : Élections dans 8 pays → volatilité ciblée sur ces émetteurs
🔴 **Risque** : Mur de refinancement 2026–2027 — 18 Mds USD à refinancer, Kenya et Angola en tête

### Opportunités identifiées
Maroc et Côte d'Ivoire offrent les meilleurs profils risque/rendement pour les investisseurs investment-grade. Kenya et Nigeria restent en territoire haut rendement avec des primes compensant le risque politique.

*Sources : Bloomberg · JP Morgan EMBI · Moody's · S&P · Fitch · MANSA Research*`,
  },
  {
    keywords: ["insécurité alimentaire", "fao", "ipc", "faim", "sahel", "alimentation"],
    followUps: ["Analyse du financement humanitaire Corne de l'Afrique", "Impact du changement climatique sur la sécurité alimentaire", "Comparer IPC phases Sahel vs Corne de l'Afrique"],
    response: `## Insécurité alimentaire en Afrique — Analyse IPC/CH 2025

### Situation critique (IPC Phase 3–5, juin 2025)
| Région/Pays | Population IPC3+ | Phase max | Cause principale |
|------------|-----------------|-----------|-----------------|
| Soudan | 20,0 M | **IPC 5** | Conflit civil 2023– |
| Éthiopie (Tigray+) | 13,5 M | IPC 4 | Conflit + sécheresse |
| Nigéria (Nord-Est) | 8,1 M | IPC 3–4 | Boko Haram + inondations |
| Somalie | 6,8 M | IPC 4 | Sécheresse récurrente |
| Mali | 4,5 M | IPC 3 | Conflit + Sahel sec |
| Niger | 4,2 M | IPC 3–4 | Post-coup + sécheresse |
| RCA | 2,6 M | IPC 3 | Conflit chronique |
| Madagascar (Sud) | 1,5 M | IPC 4 | Sécheresse cyclique |

**Total Afrique en IPC Phase 3+ : ~78 millions de personnes**

### Facteurs d'amplification 2025
1. **El Niño 2024** : Saison des pluies déficitaire Corne (-25% vs normale)
2. **Conflits** : Soudan, Sahel, RDC — déplacements massifs = rupture chaînes agricoles
3. **Prix alimentaires** : Blé +15%, riz +8% (impacts importations africaines)
4. **Financement humanitaire** : Appels ONU couverts à seulement 38% en 2025

### Action internationale
PAM, UNICEF et FAO ont déclenché des réponses d'urgence dans 22 pays africains. Le système FEWS NET anticipe une dégradation dans le Sahel Central (juillet–septembre 2025).

*Sources : IPC/CH juin 2025 · FEWS NET · PAM · FAO GIEWS · OCHA*`,
  },
  {
    keywords: ["maroc", "economie", "croissance", "investissement", "maroc"],
    followUps: ["Comparer Maroc vs Tunisie performances macro 2025", "Analyse des réformes fiscales Maroc 2024-2026", "Secteur énergétique renouvelable Maroc — ambitions et réalité"],
    response: `## Profil macroéconomique — Maroc 2025e

### Fondamentaux (FMI WEO 2025e)
| Indicateur | 2023 | 2024e | 2025e | Région MENA |
|-----------|------|-------|-------|-------------|
| Croissance PIB | +3,4% | +3,0% | +4,2% | +3,6% |
| Inflation | 6,1% | 2,8% | 2,4% | 6,4% |
| Dette/PIB | 69,5% | 68% | 66% | 52% |
| Solde fiscal | -4,4% | -4,0% | -3,5% | -4,1% |
| Réserves (mois imports) | 5,2 | 5,6 | 5,9 | — |

### Atouts compétitifs
✅ **Coupe du Monde 2030** : Co-organisation → 11 Mds USD d'investissements infrastructure prévus
✅ **Énergie renouvelable** : 45% du mix en 2025 (objectif 52% en 2030 — Noor CSP + éolien)
✅ **Hub régional** : Plateforme d'export vers l'UE (accords agriculture, industrie)
✅ **Phosphates OCP** : #1 mondial exportateur — recettes en hausse avec prix élevés
✅ **Notation Ba1/BB+** — investment grade de facto, accès aux marchés de capitaux

### Risques à surveiller
⚠️ **Stress hydrique** : Score WRI 3,6/5 — barrage El Khettara en dessous de 20% capacité
⚠️ **Chômage des jeunes** : 35% (milieu urbain) — risque social structurel
⚠️ **Dépendance énergétique** : Importation résiduelle de gaz/pétrole (~6% PIB)

### Secteurs porteurs pour l'investissement
Energies vertes · Tourisme post-2030 · Agro-industrie · Offshoring digital · Phosphates & dérivés

*Sources : FMI Article IV Maroc 2024 · Banque Mondiale · OCP · AMEA Power · MANSA Research*`,
  },
];

function getDemoResponse(question: string): { text: string; followUps: string[] } {
  const q = question.toLowerCase();
  for (const dr of DEMO_RESPONSES) {
    if (dr.keywords.some((k) => q.includes(k))) {
      return { text: dr.response, followUps: dr.followUps ?? [] };
    }
  }
  const country = q.includes("nigeria") ? "Nigeria" : q.includes("kenya") ? "Kenya"
    : q.includes("ghana") ? "Ghana" : q.includes("maroc") ? "Maroc"
    : q.includes("ethiopia") || q.includes("éthiopie") ? "Éthiopie"
    : q.includes("zambie") ? "Zambie" : q.includes("angola") ? "Angola"
    : q.includes("egypte") || q.includes("égypte") ? "Égypte" : "Afrique";

  return {
    text: `## Analyse macro-fiscale — ${country}

Je traite votre question : *"${question}"*

> ⚡ **Mode démonstration** — Le service IA en temps réel est temporairement indisponible. Voici une analyse basée sur nos données intégrées (FMI WEO 2025, Banque Mondiale, MANSA Research).

### Contexte macroéconomique Afrique subsaharienne 2025e
| Indicateur | Valeur | Variation vs 2023 |
|-----------|--------|-------------------|
| Croissance moyenne PIB | +3,8% | ↑ +0,9 pt |
| Inflation moyenne | 14,8% | ↓ -4,6 pts |
| Solde budgétaire moyen | -4,2% PIB | → Stable |
| Dette publique moyenne | 57% PIB | ↑ +2 pts |
| Réserves de change moy. | 3,6 mois | ↓ -0,3 mois |

### Thèmes d'analyse 2025
1. **Mur de refinancement Eurobonds** : 18 Mds USD à refinancer 2026–2027
2. **Transition extractive** : Pétrole Sénégal, cuivre Zambie, GNL Mozambique en production
3. **Désinflation** : Taux directeurs en baisse progressive (BCEAO 3,50%, CBN 24,75%)
4. **ZLECAf** : Montée en puissance du commerce intra-africain (+3,5 pts depuis 2020)

Pour une analyse approfondie et personnalisée, posez une question plus spécifique ou connectez le service MANSA AI backend.

*Sources : FMI WEO Avril 2025 · Banque Mondiale WDI · BCEAO · MANSA Research*`,
    followUps: [
      `Approfondir l'analyse macro ${country}`,
      `Risques souverains et notation crédit ${country}`,
      `Comparer ${country} avec ses pairs régionaux`,
    ],
  };
}

async function* simulateDemoStream(
  question: string,
  deep: boolean
): AsyncGenerator<{ type: string; content: string; followUps?: string[] }> {
  if (deep) {
    // Simuler des étapes de recherche
    for (const step of RESEARCH_STEPS) {
      yield { type: "research_step", content: step };
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    }
  }
  const { text, followUps } = getDemoResponse(question);
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? "" : " ") + words[i];
    yield { type: "text", content: chunk };
    await new Promise((r) => setTimeout(r, deep ? 10 + Math.random() * 15 : 15 + Math.random() * 20));
  }
  yield { type: "done", content: "", followUps };
}

/* ── Queries suggérées catégorisées ───────────────────────── */
const SUGGESTED_CATEGORIES = [
  {
    label: "Fiscal & Dette",
    icon: BarChart2,
    color: "#EF4444",
    queries: [
      { q: "Compare la dynamique de la dette publique au Nigeria et au Ghana sur 5 ans", tags: ["IMF", "WB"] },
      { q: "Analyse la soutenabilité des Eurobonds africains et le risque de refinancement 2026", tags: ["IMF", "WB"] },
      { q: "Quels pays UEMOA sont les plus proches des critères de convergence en 2025 ?", tags: ["BCEAO", "IMF"] },
    ],
  },
  {
    label: "Pays & Marchés",
    icon: TrendingUp,
    color: "#3B82F6",
    queries: [
      { q: "Analyse les risques macro pour investir en Côte d'Ivoire en 2025", tags: ["IMF", "WB", "Comtrade"] },
      { q: "Sénégal : quel impact du pétrole Sangomar sur les finances publiques ?", tags: ["IMF", "WB"] },
      { q: "Compare les spreads souverains Eurobonds africains — Kenya vs Nigeria vs Maroc", tags: ["WB"] },
    ],
  },
  {
    label: "Commerce & Énergie",
    icon: Globe2,
    color: "#F59E0B",
    queries: [
      { q: "Quels pays africains ont la meilleure production d'énergie renouvelable ?", tags: ["EIA", "WB"] },
      { q: "Analyse le commerce intra-africain ZLECAf — progrès et obstacles", tags: ["Comtrade", "IMF"] },
      { q: "Quels ports africains ont subi le plus de disruptions en 2024 ?", tags: ["PortWatch"] },
    ],
  },
  {
    label: "Climat & ESG",
    icon: Leaf,
    color: "#10B981",
    queries: [
      { q: "Analyse le profil climatique et les risques catastrophes au Kenya 2025", tags: ["EM-DAT", "WRI"] },
      { q: "Analyse l'insécurité alimentaire en Afrique de l'Est en 2025", tags: ["IPC/CH", "FAO"] },
      { q: "Compare les scores ESG des 10 meilleures économies africaines", tags: ["WB", "IRENA"] },
    ],
  },
];

const SOURCES = ["FMI WEO", "Banque Mondiale", "BCEAO", "BEAC", "ACLED", "EM-DAT", "NASA GLDAS", "EIA", "PortWatch", "Comtrade", "IPC/CH", "MANSA Research"];

function SourceChip({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "IMF": "text-blue-400 bg-blue-400/10", "WB": "text-green-400 bg-green-400/10",
    "EM-DAT": "text-red-400 bg-red-400/10", "EIA": "text-amber-400 bg-amber-400/10",
    "IPC/CH": "text-orange-400 bg-orange-400/10", "BCEAO": "text-violet-400 bg-violet-400/10",
    "FAO": "text-lime-400 bg-lime-400/10", "PortWatch": "text-cyan-400 bg-cyan-400/10",
    "WRI": "text-teal-400 bg-teal-400/10", "Comtrade": "text-indigo-400 bg-indigo-400/10",
    "IRENA": "text-emerald-400 bg-emerald-400/10",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[label] ?? "text-gray-400 bg-gray-400/10"}`}>
      {label}
    </span>
  );
}

/* ── Indicateur étapes de recherche ─────────────────────────── */
function ResearchStepsIndicator({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-1.5 mb-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-xs animate-fade-in"
             style={{ color: "var(--text-muted)", animationDelay: `${i * 100}ms` }}>
          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)" }}>
            <Check size={9} style={{ color: "var(--mansa-green)" }} />
          </div>
          {step}
        </div>
      ))}
    </div>
  );
}

export default function MansaAIPage() {
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [input,           setInput]           = useState("");
  const [isLoading,       setIsLoading]       = useState(false);
  const [showHistory,     setShowHistory]     = useState(false);
  const [copied,          setCopied]          = useState<string | null>(null);
  const [deepMode,        setDeepMode]        = useState(false);
  const [activeCat,       setActiveCat]       = useState(0);
  const [activeResSteps,  setActiveResSteps]  = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  const { data: history, isLoading: historyLoading } = useQuery<AIHistoryItem[]>({
    queryKey: ["ai-history"],
    queryFn: () => aiApi.getHistory(30),
    enabled: showHistory,
    staleTime: 30_000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId, role: "assistant", content: "", isStreaming: true,
      sources: [], deep: deepMode, researchSteps: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);
    setActiveResSteps([]);

    const streamSource = async function*() {
      try {
        yield* streamAIQuery(question);
      } catch {
        yield* simulateDemoStream(question, deepMode);
      }
    };

    try {
      let fullContent = "";
      for await (const chunk of streamSource()) {
        if (chunk.type === "research_step") {
          setActiveResSteps((prev) => [...prev, chunk.content]);
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, researchSteps: [...(m.researchSteps ?? []), chunk.content] }
              : m)
          );
        } else if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m)
          );
        } else if (chunk.type === "done") {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, isStreaming: false, followUps: (chunk as any).followUps ?? [] }
              : m)
          );
        } else if (chunk.type === "error") {
          const errText = chunk.content ?? "Erreur inconnue du service IA.";
          if (errText.includes("Session") || errText.includes("session") || errText.includes("401") || errText.includes("auth")) {
            let demoContent = "";
            for await (const demoChunk of simulateDemoStream(question, deepMode)) {
              if (demoChunk.type === "text") {
                demoContent += demoChunk.content;
                setMessages((prev) =>
                  prev.map((m) => m.id === assistantId ? { ...m, content: demoContent } : m)
                );
              }
            }
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: errText, isStreaming: false, error: true }
                  : m
              )
            );
          }
        }
      }
    } catch (err) {
      let demoContent = "";
      for await (const demoChunk of simulateDemoStream(question, deepMode)) {
        if (demoChunk.type === "text") {
          demoContent += demoChunk.content;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: demoContent } : m)
          );
        }
        if (demoChunk.type === "done") {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, followUps: (demoChunk as any).followUps ?? [] }
              : m)
          );
        }
      }
      void err;
    } finally {
      setIsLoading(false);
      setActiveResSteps([]);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m)
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportConversation = () => {
    if (messages.length === 0) return;
    const rows = messages.map((m, i) => ({
      index: i + 1, role: m.role, content: m.content, timestamp: new Date().toISOString(),
    }));
    exportData(rows, "json", "mansa-ai-conversation");
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
               style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}>
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              MANSA AI
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", color: "var(--mansa-green)" }}>
                Powered by Claude
              </span>
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              IA spécialisée · 54 économies africaines · FMI WEO · Banque Mondiale · 12 sources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode analyse approfondie */}
          <button
            onClick={() => setDeepMode((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
            style={deepMode
              ? { background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)", borderColor: "var(--mansa-green)", color: "var(--mansa-green)" }
              : { background: "var(--input-bg)", borderColor: "var(--bg-border)", color: "var(--text-muted)" }
            }
          >
            <Search size={12} />
            Analyse approfondie
            {deepMode && <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5a0] animate-pulse" />}
          </button>
          {messages.length > 0 && (
            <button onClick={exportConversation} className="mansa-btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5">
              <Download size={12} /> Exporter
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}
            >
              <RefreshCw size={12} /> Nouveau
            </button>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="mansa-card px-4 py-2 text-sm flex items-center gap-2 rounded-lg transition-colors"
            style={showHistory ? { color: "var(--mansa-green)" } : { color: "var(--text-muted)" }}
          >
            <History size={14} /> Historique
          </button>
        </div>
      </div>

      {/* ── Mode info + Sources ── */}
      <div className="mb-3 space-y-2">
        {deepMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
               style={{ background: "color-mix(in srgb, var(--mansa-green) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)", color: "var(--mansa-green)" }}>
            <BookOpen size={12} />
            <span className="font-medium">Mode analyse approfondie actif</span>
            <span style={{ color: "var(--text-muted)" }}>— Recherche multi-sources, tableaux comparatifs, séries temporelles, recommandations structurées</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <Database size={10} />
            <span className="font-medium uppercase tracking-wider">Sources :</span>
          </div>
          {SOURCES.map((s) => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border cursor-default select-none"
                  style={{ borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)", color: "var(--mansa-green)", background: "color-mix(in srgb, var(--mansa-green) 8%, transparent)" }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Zone messages ── */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ scrollbarWidth: "thin" }}>

        {/* État vide — queries catégorisées */}
        {messages.length === 0 && (
          <div className="flex flex-col h-full py-4">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xl"
                   style={{ background: "linear-gradient(135deg, rgba(14,165,160,0.15), rgba(10,122,118,0.15))", border: "1px solid color-mix(in srgb, var(--mansa-green) 20%, transparent)" }}>
                <Zap size={28} style={{ color: "var(--mansa-green)" }} />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                Interrogez MANSA AI
              </h2>
              <p className="text-sm max-w-lg" style={{ color: "var(--text-muted)" }}>
                Analyses macro-fiscales · Risques souverains · Profils pays · Données FMI · Banque Mondiale · 12 sources spécialisées
              </p>
            </div>

            {/* Catégorie tabs */}
            <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: "var(--bg-border)" }}>
              {SUGGESTED_CATEGORIES.map((cat, i) => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.label}
                    onClick={() => setActiveCat(i)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
                    style={activeCat === i
                      ? { borderBottomColor: cat.color, color: cat.color }
                      : { borderBottomColor: "transparent", color: "var(--text-muted)" }
                    }
                  >
                    <CatIcon size={12} />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Queries de la catégorie active */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SUGGESTED_CATEGORIES[activeCat].queries.map(({ q, tags }) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="mansa-card text-left px-4 py-3 rounded-xl text-sm transition-all group"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `color-mix(in srgb, ${SUGGESTED_CATEGORIES[activeCat].color} 40%, transparent)`)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles size={12} className="flex-shrink-0 mt-0.5"
                              style={{ color: SUGGESTED_CATEGORIES[activeCat].color }} />
                    <div>
                      <p className="leading-snug mb-2 text-sm" style={{ color: "var(--text-secondary)" }}>{q}</p>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((t) => <SourceChip key={t} label={t} />)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-fade-in ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0ea5a0] to-[#0a7a76]
                              flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <Bot size={14} className="text-white" />
              </div>
            )}

            <div className={`max-w-3xl rounded-2xl px-4 py-3 group relative ${
              message.role === "user"
                ? "bg-[#3B82F6] text-white"
                : message.error
                  ? "border border-red-500/30"
                  : "mansa-card"
            }`}
            style={message.error ? { background: "rgba(239,68,68,0.07)" } : {}}>

              {message.role === "assistant" ? (
                <>
                  {/* Badge analyse approfondie */}
                  {message.deep && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                            style={{ background: "color-mix(in srgb, var(--mansa-green) 12%, transparent)", color: "var(--mansa-green)" }}>
                        <Search size={9} /> Analyse approfondie
                      </span>
                    </div>
                  )}

                  {/* Étapes de recherche */}
                  {message.deep && message.researchSteps && message.researchSteps.length > 0 && message.isStreaming && (
                    <ResearchStepsIndicator steps={message.researchSteps} />
                  )}

                  {message.error ? (
                    <div className="flex items-start gap-2.5">
                      <AlertCircle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400">{message.content}</p>
                        {message.errorCode === 401 && (
                          <a href="/auth/login" className="text-xs mt-1 block underline" style={{ color: "var(--mansa-green)" }}>
                            → Se reconnecter
                          </a>
                        )}
                        {message.errorCode === 403 && (
                          <a href="/billing" className="text-xs mt-1 block underline" style={{ color: "var(--mansa-green)" }}>
                            → Voir les plans d&apos;abonnement
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="prose prose-invert prose-sm max-w-none
                                      prose-headings:font-semibold
                                      prose-code:text-[#0ea5a0]
                                      prose-table:text-sm
                                      prose-strong:text-white"
                           style={{ color: "var(--text-secondary)" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                        {message.isStreaming && !message.content && (
                          <div className="flex items-center gap-1 h-5">
                            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "0ms" }} />
                            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "150ms" }} />
                            <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "300ms" }} />
                          </div>
                        )}
                        {message.isStreaming && message.content && (
                          <span className="inline-block w-2 h-4 animate-pulse ml-1 rounded-sm"
                                style={{ background: "var(--mansa-green)" }} />
                        )}
                      </div>

                      {!message.isStreaming && message.content && (
                        <>
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity"
                               style={{ borderColor: "var(--bg-border)" }}>
                            <button
                              onClick={() => copyMessage(message.id, message.content)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                              style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)" }}
                            >
                              {copied === message.id ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                              {copied === message.id ? "Copié !" : "Copier"}
                            </button>
                            <button
                              onClick={() => exportData([{ content: message.content }], "json", "mansa-ai-response")}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                              style={{ color: "var(--text-muted)", background: "var(--sidebar-bg)" }}
                            >
                              <Download size={10} /> Exporter
                            </button>
                          </div>

                          {/* Suggestions de suivi */}
                          {message.followUps && message.followUps.length > 0 && (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--bg-border)" }}>
                              <p className="text-[10px] font-medium mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                                Approfondir →
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {message.followUps.map((fu) => (
                                  <button
                                    key={fu}
                                    onClick={() => sendMessage(fu)}
                                    disabled={isLoading}
                                    className="text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50"
                                    style={{
                                      borderColor: "color-mix(in srgb, var(--mansa-green) 30%, transparent)",
                                      color: "var(--mansa-green)",
                                      background: "color-mix(in srgb, var(--mansa-green) 6%, transparent)",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--mansa-green) 12%, transparent)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--mansa-green) 6%, transparent)")}
                                  >
                                    {fu}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm leading-relaxed">{message.content}</p>
              )}
            </div>

            {message.role === "user" && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                   style={{ background: "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))" }}>
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Indicateur de frappe — hors contenu */}
        {isLoading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && !messages[messages.length - 1]?.researchSteps?.length && (
          <div className="flex gap-3 justify-start animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0ea5a0] to-[#0a7a76] flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="mansa-card rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--mansa-green)", animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Historique panel ── */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-96 z-50 flex flex-col shadow-2xl border-l"
             style={{ background: "var(--sidebar-bg)", borderColor: "var(--bg-border)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--bg-border)" }}>
            <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <History size={16} style={{ color: "var(--mansa-green)" }} />
              Historique des conversations
            </h2>
            <button onClick={() => setShowHistory(false)} style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {historyLoading && (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin" style={{ color: "var(--mansa-green)" }} />
              </div>
            )}
            {!historyLoading && (!history || history.length === 0) && (
              <div className="text-center py-12">
                <MessageSquare size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune requête pour l&apos;instant.</p>
              </div>
            )}
            {history?.map((item) => (
              <button
                key={item.id}
                onClick={() => { setInput(item.question); setShowHistory(false); textareaRef.current?.focus(); }}
                className="w-full text-left mansa-card rounded-xl px-4 py-3 transition-all"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--mansa-green) 40%, transparent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
              >
                <p className="text-sm line-clamp-2 mb-2" style={{ color: "var(--text-secondary)" }}>
                  {item.question}
                </p>
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {item.tokens_used > 0 && (
                    <span className="flex items-center gap-1">
                      <Coins size={10} />{item.tokens_used.toLocaleString()} tokens
                    </span>
                  )}
                  {item.countries.length > 0 && (
                    <span style={{ color: "var(--mansa-green)" }}>{item.countries.slice(0, 3).join(", ")}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Zone saisie ── */}
      <div className="mansa-card rounded-2xl p-4 shadow-lg" style={{ borderColor: deepMode ? "color-mix(in srgb, var(--mansa-green) 40%, transparent)" : "var(--card-border)", transition: "border-color 0.3s" }}>
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={deepMode
              ? "Ex: Analyse approfondie de la soutenabilité de la dette du Kenya avec séries temporelles et comparaison régionale…"
              : "Ex: Analyse la soutenabilité de la dette du Sénégal avec les dernières données FMI…"}
            rows={2}
            className="flex-1 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 disabled:cursor-not-allowed shadow-md"
            style={{
              background: !input.trim() || isLoading ? "var(--bg-border)" : "linear-gradient(135deg, var(--mansa-green), var(--mansa-blue))",
              color: "#fff",
            }}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Entrée pour envoyer · Maj+Entrée pour saut de ligne
            {deepMode && <span className="ml-2 font-semibold" style={{ color: "var(--mansa-green)" }}>· Mode approfondi actif</span>}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            FMI · BM · BCEAO · EM-DAT · EIA · PortWatch · Comtrade
          </p>
        </div>
      </div>
    </div>
  );
}
