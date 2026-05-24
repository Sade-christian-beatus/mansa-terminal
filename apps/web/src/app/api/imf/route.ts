import { NextResponse } from "next/server";
import { getImfFallback } from "@/lib/demo-data";

const AFRICA_ISO3 = new Set([
  "DZA","AGO","BEN","BWA","BFA","BDI","CPV","CMR","CAF","TCD",
  "COM","COD","COG","CIV","DJI","EGY","GNQ","ERI","SWZ","ETH",
  "GAB","GMB","GHA","GIN","GNB","KEN","LSO","LBR","LBY","MDG",
  "MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA","RWA",
  "STP","SEN","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","TUN",
  "UGA","ZMB","ZWE",
]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const indicator = searchParams.get("indicator") || "NGDP_RPCH";
  const periodsParam = searchParams.get("periods") || "2019,2020,2021,2022,2023,2024";
  const periods = periodsParam.split(",");

  try {
    const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}?periods=${periodsParam}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`IMF API error: ${res.status}`);
    const raw = await res.json();

    const allValues = (raw.values?.[indicator] ?? {}) as Record<string, Record<string, number>>;
    const africaValues: Record<string, Record<string, number>> = {};
    for (const iso3 of AFRICA_ISO3) {
      if (allValues[iso3]) africaValues[iso3] = allValues[iso3];
    }

    // Si l'API répond mais sans données (body vide), basculer sur le fallback
    if (Object.keys(africaValues).length === 0) {
      return NextResponse.json(getImfFallback(indicator, periods));
    }

    return NextResponse.json({ indicator, periods, values: africaValues });
  } catch {
    // Fallback statique : données WEO Oct 2024 pour 15 grandes économies africaines
    return NextResponse.json(getImfFallback(indicator, periods));
  }
}
