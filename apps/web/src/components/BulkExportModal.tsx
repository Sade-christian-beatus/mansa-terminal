"use client";

import { useState } from "react";
import { X, Download, Database, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { bulkExportApi } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

const REGIONS = ["West Africa", "East Africa", "North Africa", "Central Africa", "Southern Africa"];

const KEY_INDICATORS_PRESET = [
  { code: "NGDP_RPCH",   name: "Croissance PIB réel (%)" },
  { code: "PCPIPCH",     name: "Inflation IPC (%)" },
  { code: "GGXWDG_NGDP", name: "Dette publique (% PIB)" },
  { code: "GGXCNL_NGDP", name: "Solde budgétaire (% PIB)" },
  { code: "BCA_NGDPD",   name: "Compte courant (% PIB)" },
  { code: "NGDPDPC",     name: "PIB/habitant (USD)" },
  { code: "LUR",         name: "Chômage (%)" },
  { code: "NGDPD",       name: "PIB nominal (Mds USD)" },
  { code: "BX_KLT_DINV_WD_GD_ZS", name: "IDE entrants (% PIB)" },
  { code: "GGR_NGDP",   name: "Recettes publiques (% PIB)" },
];

const TOP_COUNTRIES = [
  { id: "NGA", name: "Nigeria" }, { id: "ZAF", name: "Afrique du Sud" },
  { id: "EGY", name: "Égypte" }, { id: "ETH", name: "Éthiopie" },
  { id: "KEN", name: "Kenya" }, { id: "MAR", name: "Maroc" },
  { id: "GHA", name: "Ghana" }, { id: "CIV", name: "Côte d'Ivoire" },
  { id: "SEN", name: "Sénégal" }, { id: "TZA", name: "Tanzanie" },
  { id: "CMR", name: "Cameroun" }, { id: "DZA", name: "Algérie" },
];

interface Props {
  onClose: () => void;
}

export default function BulkExportModal({ onClose }: Props) {
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(
    KEY_INDICATORS_PRESET.slice(0, 5).map((i) => i.code)
  );
  const [fromYear, setFromYear]   = useState(2015);
  const [toYear,   setToYear]     = useState(2025);
  const [format,   setFormat]     = useState<"csv" | "json">("csv");
  const [region,   setRegion]     = useState("");
  const [allCountries, setAllCountries] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const toggleCountry = (id: string) => {
    setSelectedCountries((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleIndicator = (code: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const estimatedRows = () => {
    const nCountries = allCountries ? 54 : (selectedCountries.length || 10);
    const nIndicators = selectedIndicators.length || 10;
    const nYears = toYear - fromYear + 1;
    return nCountries * nIndicators * nYears;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Obtenir le token Supabase pour l'authentification
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const url = bulkExportApi.buildUrl({
        countries: allCountries ? undefined : (selectedCountries.length > 0 ? selectedCountries.join(",") : undefined),
        indicators: selectedIndicators.length > 0 ? selectedIndicators.join(",") : undefined,
        from_year: fromYear,
        to_year: toYear,
        format,
        region: region || undefined,
      });

      // Fetch avec auth header pour déclencher le téléchargement
      const resp = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Erreur ${resp.status}`);
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `mansa_data_${fromYear}_${toYear}.${format}`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIsDownloading(false);
    }
  };

  const years = Array.from({ length: 36 }, (_, i) => 1990 + i);
  const estimated = estimatedRows();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.7)" }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
           style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
             style={{ borderColor: "var(--bg-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: "color-mix(in srgb, var(--mansa-green) 15%, transparent)" }}>
              <Download size={16} style={{ color: "var(--mansa-green)" }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Export massif de données
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                54 pays · 30+ indicateurs · 1990–2025
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Pays */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                PAYS ({allCountries ? "Tous (54)" : `${selectedCountries.length} sélectionné(s)`})
              </label>
              <button
                onClick={() => { setAllCountries((v) => !v); setSelectedCountries([]); setRegion(""); }}
                className="text-[10px] px-2 py-0.5 rounded font-medium transition-colors"
                style={allCountries
                  ? { background: "var(--mansa-green)", color: "#fff" }
                  : { background: "var(--sidebar-bg)", color: "var(--text-muted)" }
                }
              >
                {allCountries ? "✓ Tous les pays" : "Tous les pays"}
              </button>
            </div>

            {!allCountries && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TOP_COUNTRIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleCountry(c.id)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border transition-all font-medium"
                      style={selectedCountries.includes(c.id)
                        ? { background: "var(--mansa-green)", color: "#fff", borderColor: "var(--mansa-green)" }
                        : { background: "var(--sidebar-bg)", color: "var(--text-secondary)", borderColor: "var(--bg-border)" }
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>Ou par région :</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="text-xs rounded-lg px-2 py-1 border flex-1"
                    style={{ background: "var(--input-bg)", color: "var(--text-secondary)", borderColor: "var(--input-border)" }}
                  >
                    <option value="">— Toutes les régions —</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Indicateurs */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-secondary)" }}>
              INDICATEURS ({selectedIndicators.length} sélectionné(s))
            </label>
            <div className="flex flex-wrap gap-1.5">
              {KEY_INDICATORS_PRESET.map((ind) => (
                <button
                  key={ind.code}
                  onClick={() => toggleIndicator(ind.code)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border transition-all"
                  style={selectedIndicators.includes(ind.code)
                    ? { background: "color-mix(in srgb, var(--mansa-blue) 20%, transparent)", color: "var(--mansa-blue)", borderColor: "var(--mansa-blue)" }
                    : { background: "var(--sidebar-bg)", color: "var(--text-muted)", borderColor: "var(--bg-border)" }
                  }
                >
                  {ind.name}
                </button>
              ))}
              <button
                onClick={() => setSelectedIndicators(KEY_INDICATORS_PRESET.map((i) => i.code))}
                className="text-[11px] px-2.5 py-1 rounded-lg border"
                style={{ background: "var(--sidebar-bg)", color: "var(--text-muted)", borderColor: "var(--bg-border)" }}
              >
                Tout sélectionner
              </button>
            </div>
          </div>

          {/* Années + format */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>DE</label>
              <select value={fromYear} onChange={(e) => setFromYear(+e.target.value)}
                      className="mansa-input text-sm w-full">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>À</label>
              <select value={toYear} onChange={(e) => setToYear(+e.target.value)}
                      className="mansa-input text-sm w-full">
                {years.filter((y) => y >= fromYear).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text-secondary)" }}>FORMAT</label>
              <div className="flex gap-2">
                {(["csv", "json"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border transition-all"
                    style={format === f
                      ? { background: "var(--mansa-green)", color: "#fff", borderColor: "var(--mansa-green)" }
                      : { background: "var(--input-bg)", color: "var(--text-secondary)", borderColor: "var(--input-border)" }
                    }
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between"
             style={{ borderColor: "var(--bg-border)" }}>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            <Database size={10} className="inline mr-1" />
            ~{estimated.toLocaleString("fr-FR")} lignes estimées
            {estimated > 50_000 && (
              <span className="ml-1 text-amber-400"> (limité à 50 000)</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="mansa-btn-ghost text-sm px-4 py-2">Annuler</button>
            <button
              onClick={handleDownload}
              disabled={isDownloading || (selectedIndicators.length === 0)}
              className="mansa-btn-primary text-sm px-4 py-2 flex items-center gap-2"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isDownloading ? "Téléchargement…" : `Télécharger .${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
