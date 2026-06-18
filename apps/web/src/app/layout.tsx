import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/common/Providers";
import { AppShell } from "@/components/common/AppShell";
import { ServiceWorkerRegistrar } from "@/components/common/ServiceWorkerRegistrar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MANSA Terminal — Intelligence macro-fiscale africaine",
  description:
    "Plateforme d'intelligence macro-fiscale de l'Afrique, propulsée par l'IA — données temps réel pour 54 économies africaines.",
  applicationName: "MANSA Terminal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "MANSA",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5a0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
