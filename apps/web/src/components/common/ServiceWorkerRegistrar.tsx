"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker PWA (`/sw.js`) côté client, après le montage.
 * Uniquement en production (le HMR de dev et les SW font mauvais ménage).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Non bloquant : l'app fonctionne sans SW.
        console.warn("Échec d'enregistrement du service worker:", err);
      });
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
