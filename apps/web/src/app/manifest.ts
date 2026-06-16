import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MANSA Terminal",
    short_name: "MANSA",
    description: "Africa's AI-Powered Macro-Fiscal Intelligence Platform",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#0ea5a0",
    orientation: "portrait-primary",
    categories: ["finance", "business", "productivity"],
    lang: "fr",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "MANSA AI",
        url: "/ai",
        description: "Interroger l'analyste IA",
      },
      {
        name: "Pays",
        url: "/countries",
        description: "Explorer les 54 économies africaines",
      },
    ],
  };
}
