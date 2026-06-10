"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Label, ReferenceLine,
} from "recharts";
import { GitFork, Info, TrendingUp, BarChart3 } from "lucide-react";

/* ── 54 pays avec données statiques pour la corrélation ── */
const COUNTRIES_DATA: Record<string, {
  flag: string; name: string; region: string;
  NGDP_RPCH: number; PCPIPCH: number; GGXCNL_NGDP: number;
  GGXWDG_NGDP: number; BCA_NGDPD: number; NGDPDPC: number;
  LUR: number; BX_KLT_DINV_WD_GD_ZS: number;
}> = {
  NGA:{flag:"🇳🇬",name:"Nigeria",          region:"West Africa",    NGDP_RPCH:3.1, PCPIPCH:32.5,GGXCNL_NGDP:-4.6,GGXWDG_NGDP:46,  BCA_NGDPD:0.8, NGDPDPC:2200,LUR:5.0, BX_KLT_DINV_WD_GD_ZS:0.3},
  ZAF:{flag:"🇿🇦",name:"Afrique du Sud",   region:"Southern Africa",NGDP_RPCH:1.1, PCPIPCH:4.6, GGXCNL_NGDP:-5.0,GGXWDG_NGDP:75,  BCA_NGDPD:-1.6,NGDPDPC:6200,LUR:33.0,BX_KLT_DINV_WD_GD_ZS:0.9},
  EGY:{flag:"🇪🇬",name:"Égypte",           region:"North Africa",   NGDP_RPCH:3.8, PCPIPCH:28.3,GGXCNL_NGDP:-7.2,GGXWDG_NGDP:90,  BCA_NGDPD:-5.4,NGDPDPC:3400,LUR:7.2, BX_KLT_DINV_WD_GD_ZS:2.1},
  ETH:{flag:"🇪🇹",name:"Éthiopie",         region:"East Africa",    NGDP_RPCH:6.8, PCPIPCH:24.1,GGXCNL_NGDP:-2.6,GGXWDG_NGDP:38,  BCA_NGDPD:-3.1,NGDPDPC:1300,LUR:3.5, BX_KLT_DINV_WD_GD_ZS:1.8},
  KEN:{flag:"🇰🇪",name:"Kenya",            region:"East Africa",    NGDP_RPCH:5.0, PCPIPCH:6.5, GGXCNL_NGDP:-5.5,GGXWDG_NGDP:70,  BCA_NGDPD:-4.0,NGDPDPC:2100,LUR:5.7, BX_KLT_DINV_WD_GD_ZS:1.2},
  TZA:{flag:"🇹🇿",name:"Tanzanie",         region:"East Africa",    NGDP_RPCH:5.4, PCPIPCH:3.1, GGXCNL_NGDP:-3.0,GGXWDG_NGDP:42,  BCA_NGDPD:-3.5,NGDPDPC:1200,LUR:2.7, BX_KLT_DINV_WD_GD_ZS:2.5},
  MAR:{flag:"🇲🇦",name:"Maroc",            region:"North Africa",   NGDP_RPCH:3.2, PCPIPCH:2.4, GGXCNL_NGDP:-4.1,GGXWDG_NGDP:69,  BCA_NGDPD:-1.2,NGDPDPC:3700,LUR:12.9,BX_KLT_DINV_WD_GD_ZS:1.4},
  GHA:{flag:"🇬🇭",name:"Ghana",            region:"West Africa",    NGDP_RPCH:3.1, PCPIPCH:22.3,GGXCNL_NGDP:-4.6,GGXWDG_NGDP:83,  BCA_NGDPD:-2.0,NGDPDPC:2400,LUR:4.5, BX_KLT_DINV_WD_GD_ZS:3.2},
  CIV:{flag:"🇨🇮",name:"Côte d'Ivoire",    region:"West Africa",    NGDP_RPCH:6.5, PCPIPCH:3.8, GGXCNL_NGDP:-4.0,GGXWDG_NGDP:57,  BCA_NGDPD:-3.7,NGDPDPC:2900,LUR:3.8, BX_KLT_DINV_WD_GD_ZS:2.0},
  SEN:{flag:"🇸🇳",name:"Sénégal",          region:"West Africa",    NGDP_RPCH:8.3, PCPIPCH:2.8, GGXCNL_NGDP:-4.9,GGXWDG_NGDP:73,  BCA_NGDPD:-12.1,NGDPDPC:1800,LUR:20.1,BX_KLT_DINV_WD_GD_ZS:3.8},
  CMR:{flag:"🇨🇲",name:"Cameroun",         region:"Central Africa", NGDP_RPCH:4.1, PCPIPCH:7.4, GGXCNL_NGDP:-2.5,GGXWDG_NGDP:48,  BCA_NGDPD:-4.2,NGDPDPC:1700,LUR:4.2, BX_KLT_DINV_WD_GD_ZS:1.6},
  AGO:{flag:"🇦🇴",name:"Angola",           region:"Central Africa", NGDP_RPCH:2.4, PCPIPCH:28.2,GGXCNL_NGDP:-1.0,GGXWDG_NGDP:73,  BCA_NGDPD:4.5, NGDPDPC:3100,LUR:7.5, BX_KLT_DINV_WD_GD_ZS:0.6},
  DZA:{flag:"🇩🇿",name:"Algérie",          region:"North Africa",   NGDP_RPCH:3.6, PCPIPCH:9.2, GGXCNL_NGDP:-5.8,GGXWDG_NGDP:60,  BCA_NGDPD:2.4, NGDPDPC:5200,LUR:11.8,BX_KLT_DINV_WD_GD_ZS:0.4},
  MOZ:{flag:"🇲🇿",name:"Mozambique",       region:"East Africa",    NGDP_RPCH:5.5, PCPIPCH:6.2, GGXCNL_NGDP:-5.0,GGXWDG_NGDP:100, BCA_NGDPD:-26.0,NGDPDPC:560, LUR:3.2, BX_KLT_DINV_WD_GD_ZS:12.5},
  ZMB:{flag:"🇿🇲",name:"Zambie",           region:"Southern Africa",NGDP_RPCH:4.8, PCPIPCH:13.0,GGXCNL_NGDP:-7.6,GGXWDG_NGDP:137, BCA_NGDPD:1.5, NGDPDPC:1500,LUR:12.7,BX_KLT_DINV_WD_GD_ZS:4.1},
  RWA:{flag:"🇷🇼",name:"Rwanda",           region:"East Africa",    NGDP_RPCH:7.0, PCPIPCH:5.8, GGXCNL_NGDP:-6.0,GGXWDG_NGDP:68,  BCA_NGDPD:-11.4,NGDPDPC:900, LUR:1.3, BX_KLT_DINV_WD_GD_ZS:5.2},
  TUN:{flag:"🇹🇳",name:"Tunisie",          region:"North Africa",   NGDP_RPCH:1.8, PCPIPCH:9.3, GGXCNL_NGDP:-7.7,GGXWDG_NGDP:80,  BCA_NGDPD:-6.2,NGDPDPC:3700,LUR:15.4,BX_KLT_DINV_WD_GD_ZS:1.1},
  UGA:{flag:"🇺🇬",name:"Ouganda",          region:"East Africa",    NGDP_RPCH:6.1, PCPIPCH:3.8, GGXCNL_NGDP:-4.4,GGXWDG_NGDP:50,  BCA_NGDPD:-9.2,NGDPDPC:1100,LUR:2.1, BX_KLT_DINV_WD_GD_ZS:3.0},
  MLI:{flag:"🇲🇱",name:"Mali",             region:"West Africa",    NGDP_RPCH:4.0, PCPIPCH:2.5, GGXCNL_NGDP:-3.5,GGXWDG_NGDP:50,  BCA_NGDPD:-5.5,NGDPDPC:1000,LUR:7.9, BX_KLT_DINV_WD_GD_ZS:2.8},
  BFA:{flag:"🇧🇫",name:"Burkina Faso",     region:"West Africa",    NGDP_RPCH:2.5, PCPIPCH:3.0, GGXCNL_NGDP:-4.5,GGXWDG_NGDP:54,  BCA_NGDPD:-4.1,NGDPDPC:840, LUR:5.5, BX_KLT_DINV_WD_GD_ZS:2.2},
  MWI:{flag:"🇲🇼",name:"Malawi",           region:"East Africa",    NGDP_RPCH:1.8, PCPIPCH:25.0,GGXCNL_NGDP:-7.0,GGXWDG_NGDP:92,  BCA_NGDPD:-9.0,NGDPDPC:500, LUR:6.0, BX_KLT_DINV_WD_GD_ZS:1.5},
  NER:{flag:"🇳🇪",name:"Niger",            region:"West Africa",    NGDP_RPCH:12.3,PCPIPCH:3.9, GGXCNL_NGDP:-6.8,GGXWDG_NGDP:52,  BCA_NGDPD:-16.0,NGDPDPC:650, LUR:0.8, BX_KLT_DINV_WD_GD_ZS:6.5},
  BEN:{flag:"🇧🇯",name:"Bénin",            region:"West Africa",    NGDP_RPCH:6.4, PCPIPCH:2.7, GGXCNL_NGDP:-4.7,GGXWDG_NGDP:54,  BCA_NGDPD:-4.2,NGDPDPC:1500,LUR:2.3, BX_KLT_DINV_WD_GD_ZS:3.1},
  TGO:{flag:"🇹🇬",name:"Togo",             region:"West Africa",    NGDP_RPCH:6.0, PCPIPCH:4.0, GGXCNL_NGDP:-3.8,GGXWDG_NGDP:69,  BCA_NGDPD:-2.9,NGDPDPC:1050,LUR:3.5, BX_KLT_DINV_WD_GD_ZS:2.4},
  MUS:{flag:"🇲🇺",name:"Maurice",          region:"East Africa",    NGDP_RPCH:5.6, PCPIPCH:7.0, GGXCNL_NGDP:-4.0,GGXWDG_NGDP:85,  BCA_NGDPD:-5.9,NGDPDPC:10500,LUR:6.2,BX_KLT_DINV_WD_GD_ZS:4.8},
  BWA:{flag:"🇧🇼",name:"Botswana",         region:"Southern Africa",NGDP_RPCH:3.5, PCPIPCH:5.5, GGXCNL_NGDP:-1.5,GGXWDG_NGDP:19,  BCA_NGDPD:-1.6,NGDPDPC:7400,LUR:24.5,BX_KLT_DINV_WD_GD_ZS:1.9},
  COD:{flag:"🇨🇩",name:"Congo RDC",        region:"Central Africa", NGDP_RPCH:6.3, PCPIPCH:23.6,GGXCNL_NGDP:-1.0,GGXWDG_NGDP:15,  BCA_NGDPD:-3.7,NGDPDPC:660, LUR:4.5, BX_KLT_DINV_WD_GD_ZS:5.8},
  GAB:{flag:"🇬🇦",name:"Gabon",            region:"Central Africa", NGDP_RPCH:2.5, PCPIPCH:4.8, GGXCNL_NGDP:-1.8,GGXWDG_NGDP:75,  BCA_NGDPD:2.5, NGDPDPC:8600,LUR:6.0, BX_KLT_DINV_WD_GD_ZS:1.3},
};

const INDICATORS = [
  { code: "NGDP_RPCH",           label: "Croissance PIB réel (%)" },
  { code: "PCPIPCH",             label: "Inflation IPC (%)" },
  { code: "GGXCNL_NGDP",        label: "Solde budgétaire (% PIB)" },
  { code: "GGXWDG_NGDP",        label: "Dette publique (% PIB)" },
  { code: "BCA_NGDPD",          label: "Compte courant (% PIB)" },
  { code: "NGDPDPC",            label: "PIB par habitant (USD)" },
  { code: "LUR",                label: "Chômage (%)" },
  { code: "BX_KLT_DINV_WD_GD_ZS", label: "IDE entrants (% PIB)" },
];

const REGION_COLORS: Record<string, string> = {
  "West Africa":     "#00D4AA",
  "East Africa":     "#3B82F6",
  "North Africa":    "#F59E0B",
  "Southern Africa": "#8B5CF6",
  "Central Africa":  "#EF4444",
};

/** Coefficient de corrélation de Pearson */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
    ys.reduce((s, y) => s + (y - my) ** 2, 0)
  );
  return den === 0 ? 0 : num / den;
}

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill={payload.color} opacity={0.15} />
      <circle cx={cx} cy={cy} r={5}  fill={payload.color} opacity={0.85} />
      <text x={cx + 7} y={cy - 7} fontSize={9} fill={payload.color} opacity={0.8}>{payload.flag}</text>
    </g>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border px-3 py-2 text-sm shadow-xl"
         style={{ background: "var(--dropdown-bg)", borderColor: "var(--bg-border)", color: "var(--text-primary)" }}>
      <p className="font-bold">{d.flag} {d.name}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.region}</p>
      <div className="mt-1 space-y-0.5 text-xs">
        <p>X : <span style={{ color: "var(--mansa-green)" }}>{d.x?.toFixed(2)}</span></p>
        <p>Y : <span style={{ color: "var(--mansa-green)" }}>{d.y?.toFixed(2)}</span></p>
      </div>
    </div>
  );
}

export default function CorrelationPage() {
  const [indX, setIndX] = useState(INDICATORS[0].code);
  const [indY, setIndY] = useState(INDICATORS[1].code);
  const [region, setRegion] = useState("Toutes");

  const regions = ["Toutes", "West Africa", "East Africa", "North Africa", "Southern Africa", "Central Africa"];

  const points = useMemo(() => {
    return Object.entries(COUNTRIES_DATA)
      .filter(([, d]) => region === "Toutes" || d.region === region)
      .map(([id, d]) => ({
        id,
        flag:   d.flag,
        name:   d.name,
        region: d.region,
        x:      (d as any)[indX] as number,
        y:      (d as any)[indY] as number,
        color:  REGION_COLORS[d.region] ?? "#00D4AA",
      }))
      .filter(p => p.x != null && p.y != null);
  }, [indX, indY, region]);

  const xVals = points.map(p => p.x);
  const yVals = points.map(p => p.y);
  const r = pearson(xVals, yVals);
  const r2 = r * r;

  const labelX = INDICATORS.find(i => i.code === indX)?.label ?? indX;
  const labelY = INDICATORS.find(i => i.code === indY)?.label ?? indY;

  const interpretR = (r: number) => {
    const a = Math.abs(r);
    if (a >= 0.8) return { label: "Très forte", color: "#10B981" };
    if (a >= 0.6) return { label: "Forte",      color: "#3B82F6" };
    if (a >= 0.4) return { label: "Modérée",    color: "#F59E0B" };
    if (a >= 0.2) return { label: "Faible",     color: "#F97316" };
    return         { label: "Très faible",       color: "#6B7280" };
  };
  const interp = interpretR(r);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <GitFork size={22} style={{ color: "var(--mansa-green)" }} />
          Analyse de corrélation
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Corrélation entre deux indicateurs macro à travers {points.length} pays africains
        </p>
      </div>

      {/* ── Sélecteurs ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mansa-card rounded-xl p-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Axe X — Indicateur
          </label>
          <select
            value={indX}
            onChange={e => setIndX(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2 border focus:outline-none"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
          >
            {INDICATORS.map(i => <option key={i.code} value={i.code}>{i.label}</option>)}
          </select>
        </div>

        <div className="mansa-card rounded-xl p-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Axe Y — Indicateur
          </label>
          <select
            value={indY}
            onChange={e => setIndY(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2 border focus:outline-none"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
          >
            {INDICATORS.filter(i => i.code !== indX).map(i => <option key={i.code} value={i.code}>{i.label}</option>)}
          </select>
        </div>

        <div className="mansa-card rounded-xl p-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Filtre région
          </label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="w-full text-sm rounded-lg px-3 py-2 border focus:outline-none"
            style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}
          >
            {regions.map(r => <option key={r} value={r}>{r === "Toutes" ? "Toutes les régions" : r}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPIs corrélation ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Coeff. Pearson (r)", value: r.toFixed(3), color: interp.color },
          { label: "R² (variance expliquée)", value: (r2 * 100).toFixed(1) + "%", color: "var(--mansa-green)" },
          { label: "Intensité", value: interp.label, color: interp.color },
          { label: "Pays analysés", value: String(points.length), color: "var(--text-primary)" },
        ].map(k => (
          <div key={k.label} className="mansa-card rounded-xl p-4 text-center">
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Scatter Plot ── */}
      <div className="mansa-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={14} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {labelX} vs {labelY}
          </h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `color-mix(in srgb, ${interp.color} 15%, transparent)`, color: interp.color }}>
            r = {r.toFixed(3)} · {r > 0 ? "corrélation positive" : r < 0 ? "corrélation négative" : "aucune corrélation"}
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Chaque point = un pays africain · Couleur = région géographique
        </p>

        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
            <XAxis dataKey="x" type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} domain={["auto","auto"]}>
              <Label value={labelX} offset={-10} position="insideBottom" style={{ fontSize: 11, fill: "var(--text-muted)" }} />
            </XAxis>
            <YAxis dataKey="y" type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={60}>
              <Label value={labelY} angle={-90} position="insideLeft" style={{ fontSize: 11, fill: "var(--text-muted)" }} />
            </YAxis>
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 2" opacity={0.4} />
            <ReferenceLine x={0} stroke="var(--text-muted)" strokeDasharray="4 2" opacity={0.4} />
            <Scatter data={points} shape={<CustomDot />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* ── Légende régions ── */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(REGION_COLORS).map(([reg, color]) => (
          <div key={reg} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            {reg}
          </div>
        ))}
      </div>

      {/* ── Tableau des valeurs ── */}
      <div className="mansa-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--card-border)" }}>
          <Info size={14} style={{ color: "var(--mansa-green)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Données par pays
          </h3>
          <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
            Trié par valeur X décroissante
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--bg-border)" }}>
                {["Pays", "Région", labelX, labelY].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].sort((a,b) => b.x - a.x).map(p => (
                <tr key={p.id} className="border-b"
                    style={{ borderColor: "var(--bg-border)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--sidebar-item-bg)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span>{p.flag}</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `color-mix(in srgb, ${p.color} 15%, transparent)`, color: p.color }}>
                      {p.region}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                    {p.x?.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                    {p.y?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 text-xs border flex items-start gap-2"
           style={{ background: "color-mix(in srgb, var(--mansa-green) 6%, var(--card-bg))", borderColor: "color-mix(in srgb, var(--mansa-green) 20%, transparent)", color: "var(--text-muted)" }}>
        <TrendingUp size={12} className="flex-shrink-0 mt-0.5" style={{ color: "var(--mansa-green)" }} />
        <span>
          <strong style={{ color: "var(--text-primary)" }}>Interprétation :</strong>{" "}
          Le coefficient de Pearson r = {r.toFixed(3)} indique une corrélation {r > 0 ? "positive" : "négative"} {interp.label.toLowerCase()} entre{" "}
          <em>{labelX}</em> et <em>{labelY}</em> sur les {points.length} pays africains analysés.{" "}
          R² = {(r2*100).toFixed(1)}% signifie que {(r2*100).toFixed(1)}% de la variance de Y est expliquée par X.
          Note : corrélation ≠ causalité.
        </span>
      </div>
    </div>
  );
}
