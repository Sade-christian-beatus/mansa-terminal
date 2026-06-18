import type { MetadataRoute } from "next";

// Manifeste PWA — rend MANSA Terminal installable sur mobile et desktop.
// Next.js sert ce fichier sur /manifest.webmanifest et injecte le <link> associé.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MANSA Terminal — Intelligence macro-fiscale africaine",
    short_name: "MANSA",
    description:
      "Plateforme d'intelligence macro-fiscale de l'Afrique, propulsée par l'IA — " +
      "données temps réel pour 54 économies africaines.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#000000",
    theme_color: "#0ea5a0",
    categories: ["finance", "business", "education", "news"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
