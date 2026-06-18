/*
 * MANSA Terminal — Service Worker (PWA)
 * Stratégie volontairement légère :
 *   - Navigations (documents) : network-first avec repli sur le cache, puis page
 *     hors-ligne minimale → l'app reste ouvrable sans réseau.
 *   - Assets statiques same-origin (_next/static, icônes, images) : stale-while-
 *     revalidate → chargement instantané + mise à jour en arrière-plan.
 *   - Jamais de cache pour les appels API (/api/*) : données toujours fraîches.
 */
const VERSION = "mansa-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = ["/", OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;     // pas de cache cross-origin
  if (url.pathname.startsWith("/api/")) return;        // API : toujours réseau

  // Navigations : network-first → cache → page hors-ligne
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Assets statiques : stale-while-revalidate
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") ||
      url.pathname.startsWith("/images") || url.pathname === "/logo.png") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
