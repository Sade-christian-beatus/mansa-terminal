import { NextResponse } from "next/server";

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

    if (!latestRes.ok) throw new Error("Frankfurter API error");

    const latest = await latestRes.json();
    const prev = prevRes.ok ? await prevRes.json() : null;

    return NextResponse.json({ latest, prev });
  } catch {
    return NextResponse.json(
      { error: "FX data temporarily unavailable" },
      { status: 503 }
    );
  }
}
