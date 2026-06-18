/**
 * Constantes géographiques partagées pour les cartes Afrique.
 *
 * Source GeoJSON : Natural Earth (world-atlas) — on filtre uniquement les pays
 * africains via la table ISO-3166 numeric → ISO-3. Utilisé par
 * `components/dashboard/AfricaHeatmap.tsx` et `components/regions/RegionMap.tsx`.
 */

// GeoJSON monde Natural Earth — on filtre uniquement les pays africains
export const WORLD_TOPO =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO-3166 numeric → ISO-3 (pays africains uniquement)
export const NUM_TO_ISO3: Record<string, string> = {
  "012": "DZA", "024": "AGO", "204": "BEN", "072": "BWA", "854": "BFA",
  "108": "BDI", "132": "CPV", "120": "CMR", "140": "CAF", "148": "TCD",
  "174": "COM", "180": "COD", "178": "COG", "384": "CIV", "262": "DJI",
  "818": "EGY", "226": "GNQ", "232": "ERI", "231": "ETH", "266": "GAB",
  "270": "GMB", "288": "GHA", "324": "GIN", "624": "GNB", "404": "KEN",
  "426": "LSO", "430": "LBR", "434": "LBY", "450": "MDG", "454": "MWI",
  "466": "MLI", "478": "MRT", "480": "MUS", "504": "MAR", "508": "MOZ",
  "516": "NAM", "562": "NER", "566": "NGA", "646": "RWA", "678": "STP",
  "686": "SEN", "694": "SLE", "706": "SOM", "710": "ZAF", "728": "SSD",
  "729": "SDN", "748": "SWZ", "834": "TZA", "768": "TGO", "788": "TUN",
  "800": "UGA", "894": "ZMB", "716": "ZWE",
};

export const AFRICAN_NUMERIC = new Set(Object.keys(NUM_TO_ISO3));

/** ISO-3 → ISO-3166 numeric (inverse de NUM_TO_ISO3). */
export const ISO3_TO_NUM: Record<string, string> = Object.fromEntries(
  Object.entries(NUM_TO_ISO3).map(([num, iso3]) => [iso3, num]),
);

/** Renvoie l'ISO-3 d'une géométrie Natural Earth, ou null si hors Afrique. */
export function geoToIso3(geoId: string | number): string | null {
  const num = String(geoId).padStart(3, "0");
  return NUM_TO_ISO3[num] ?? null;
}
