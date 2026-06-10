/** @type {import('next').NextConfig} */

// Bundle analyzer (optionnel — ANALYZE=true npm run build)
const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? require("@next/bundle-analyzer")({ enabled: true })
  : (cfg) => cfg;

const nextConfig = {
  reactStrictMode: true,

  // ── Compression ─────────────────────────────────────────────
  compress: true,

  // ── Optimisation des images ──────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    // Domaines autorisés pour les images externes (drapeaux, logos partenaires)
    remotePatterns: [
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
    // Tailles d'écrans ciblées (Africa-first — mobile 360/390, tablette 768, desktop 1280)
    deviceSizes: [360, 390, 640, 768, 1024, 1280, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128],
  },

  // ── Packages externalisés (Server Components) ───────────────
  experimental: {
    serverComponentsExternalPackages: [],
    // Optimisations du compilateur Next.js
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "@tanstack/react-query",
      "date-fns",
    ],
  },

  // ── Headers HTTP ────────────────────────────────────────────
  async headers() {
    return [
      // Sécurité — toutes les routes
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control",     value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Cache long — assets statiques Next.js (hash dans le nom de fichier)
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache court — fichiers publics (images, fonts)
      {
        source: "/public/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=3600",
          },
        ],
      },
      // Pas de cache — pages dynamiques et API routes Next.js
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },

  // ── Proxy vers FastAPI ───────────────────────────────────────
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },

  // ── Webpack — optimisations bundle ──────────────────────────
  webpack(config, { isServer }) {
    // Exclure les modules Node.js lourds inutiles côté client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Réduire le bundle recharts en tree-shaking plus agressif
    config.optimization = {
      ...config.optimization,
      sideEffects: true,
    };

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
