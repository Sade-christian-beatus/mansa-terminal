import { NextResponse } from "next/server";

const AFRICA_ISO3 = [
  "DZA","AGO","BEN","BWA","BFA","BDI","CPV","CMR","CAF","TCD",
  "COM","COD","COG","CIV","DJI","EGY","GNQ","ERI","SWZ","ETH",
  "GAB","GMB","GHA","GIN","GNB","KEN","LSO","LBR","LBY","MDG",
  "MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA","RWA",
  "STP","SEN","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","TUN",
  "UGA","ZMB","ZWE",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const indicator = searchParams.get("indicator") || "NGDP_RPCH";
  const periods = searchParams.get("periods") || "2019,2020,2021,2022,2023,2024";

  try {
    const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}?periods=${periods}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`IMF API error: ${res.status}`);
    const raw = await res.json();

    const allValues = (raw.values?.[indicator] ?? {}) as Record<string, Record<string, number>>;
    const africaValues: Record<string, Record<string, number>> = {};
    for (const iso3 of AFRICA_ISO3) {
      if (allValues[iso3]) africaValues[iso3] = allValues[iso3];
    }

    return NextResponse.json({
      indicator,
      periods: periods.split(","),
      values: africaValues,
    });
  } catch {
    return NextResponse.json({ error: "IMF data unavailable" }, { status: 503 });
  }
}
