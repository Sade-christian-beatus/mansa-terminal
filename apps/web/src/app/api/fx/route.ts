import { NextResponse } from "next/server";
import { FX_FALLBACK } from "@/lib/demo-data";

const CURRENCIES = "NGN,ZAR,KES,GHS,EGP,ETB,MAD,TZS,UGX,XOF,XAF";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export async function GET() {
  try {
    const [latestRes, prevRes] = await Promise.all([
      fetch(`https://api.frankfurter.app/latest?from=USD&to=${CURRENCIES}`, {
        next: { revalidate: 300 },
      }),
      fetch(`https://api.frankfurter.app/${daysAgo(30)}?from=USD&to=${CURRENCIES}`, {
        next: { revalidate: 86400 },
      }),
    ]);

    if (!latestRes.ok) throw new Error(`Frankfurter API ${latestRes.status}`);

    const latest = await latestRes.json();
    const prev = prevRes.ok ? await prevRes.json() : null;

    return NextResponse.json({ latest, prev });
  } catch {
    // Retourner le fallback statique plutôt qu'une erreur 503
    // → le MarketTicker affiche toujours des données (indicateur "DEMO" discret)
    return NextResponse.json(FX_FALLBACK);
  }
}
