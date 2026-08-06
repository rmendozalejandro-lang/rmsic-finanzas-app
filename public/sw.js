const CACHE_VERSION = "tralixia-offline-v3";
const TERRAIN_CACHE = "tralixia-terrain-v1";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [
  OFFLINE_URL,
  "/offline.css",
  "/offline.js",
  "/tralixia.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("tralixia-offline-") && key !== CACHE_VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/"))
    return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const isPreparedTerrainRoute =
          url.pathname === "/haras/partos" ||
          url.pathname === "/ot" ||
          /^\/ot\/[^/]+$/.test(url.pathname);

        if (isPreparedTerrainRoute) {
          const terrainCache = await caches.open(TERRAIN_CACHE);
          const preparedRoute = await terrainCache.match(request, {
            ignoreSearch: true,
          });
          if (preparedRoute) return preparedRoute;

          // /ot funciona como contenedor del detalle preparado cuando la ruta
          // dinámica no está disponible en la caché de navegación.
          if (url.pathname === "/ot") {
            const preparedOtRoute = await terrainCache.match("/ot");
            if (preparedOtRoute) return preparedOtRoute;
          }
        }
        return caches.match(OFFLINE_URL);
      }),
    );
    return;
  }

  const isStaticResource =
    url.pathname.startsWith("/_next/static/") ||
    ["font", "image", "script", "style"].includes(request.destination);

  if (!isStaticResource) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          void caches
            .open(CACHE_VERSION)
            .then((cache) => cache.put(request, responseToCache));
        }

        return networkResponse;
      });
    }),
  );
});
