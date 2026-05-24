import { NextResponse } from "next/server";

interface Article {
  title: string;
  description: string | null;
  source: { name: string };
  publishedAt: string;
  url: string;
}

const MOCK_ARTICLES: Article[] = [
  {
    title: "Le FMI revoit à la hausse la croissance de l'Afrique subsaharienne à 4,2 % en 2024",
    description: "Le FMI améliore ses prévisions pour la région, portées par la reprise des matières premières et la stabilisation des taux de change.",
    source: { name: "FMI" },
    publishedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    url: "https://www.imf.org/fr/News/Articles",
  },
  {
    title: "La Banque Mondiale alloue 5 Md$ pour l'infrastructure climatique en Afrique",
    description: "Nouveau programme de financement pour accélérer la transition énergétique et réduire la vulnérabilité climatique sur le continent.",
    source: { name: "World Bank" },
    publishedAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    url: "https://www.worldbank.org/fr/region/afr",
  },
  {
    title: "Le naira nigérian se stabilise après les réformes de change de la CBN",
    description: "La Banque centrale du Nigeria maintient sa politique de flottement géré, permettant une appréciation progressive du naira.",
    source: { name: "Reuters Africa" },
    publishedAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
    url: "#",
  },
  {
    title: "Le Kenya émet un eurobond de 1,5 Md$ avec succès malgré la pression sur la dette",
    description: "Forte demande des investisseurs internationaux pour l'emprunt obligataire kenyan, signe de confiance dans l'économie.",
    source: { name: "Bloomberg" },
    publishedAt: new Date(Date.now() - 12 * 3600_000).toISOString(),
    url: "#",
  },
  {
    title: "L'Égypte finalise un accord de 8 Md$ avec le FMI pour stabiliser l'économie",
    description: "Le programme de réformes structurelles vise à réduire le déficit budgétaire et à maîtriser l'inflation qui dépasse 30%.",
    source: { name: "Al-Ahram" },
    publishedAt: new Date(Date.now() - 18 * 3600_000).toISOString(),
    url: "#",
  },
  {
    title: "L'AfCFTA : les échanges intra-africains en hausse de 12% au T3 2024",
    description: "La Zone de Libre-Échange Continentale Africaine commence à produire des effets tangibles sur les flux commerciaux régionaux.",
    source: { name: "UA / AfCFTA" },
    publishedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    url: "#",
  },
];

export async function GET() {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ articles: MOCK_ARTICLES, source: "mock" });
  }

  try {
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=africa+economy+IMF+GDP&language=en&sortBy=publishedAt&pageSize=6&apiKey=${apiKey}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) throw new Error(`NewsAPI error: ${res.status}`);
    const data = await res.json();
    const articles = data.articles?.slice(0, 6) ?? MOCK_ARTICLES;
    return NextResponse.json({ articles, source: "live" });
  } catch {
    return NextResponse.json({ articles: MOCK_ARTICLES, source: "mock" });
  }
}
