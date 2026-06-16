// MANSA Terminal — Service Worker (PWA offline support)
const CACHE_NAME = "mansa-v1";

// Assets statiques à mettre en cache pour offline
const STATIC_ASSETS = [
  "/",
  "/logo.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas intercepter les requêtes API (toujours live)
  if (url.pathname.startsWith("/api/")) return;

  // Stratégie Network-first pour les pages, Cache-first pour les assets statiques
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/") ?? new Response("Offline", { status: 503 }))
    );
  } else if (["image", "font", "style", "script"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    );
  }
});
