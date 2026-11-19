const CACHE_VERSION = "tralixia-offline-v4";
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
      fetch(request).then(async (response) => {
        // OT Viva is a client-rendered shell; cache only its visited navigation
        // response. Technical records remain in authenticated server storage.
        if (response.ok && /^\/ot\/[^/]+\/viva$/.test(url.pathname)) {
          try {
            const cache = await caches.open(TERRAIN_CACHE);
            await cache.put(url.pathname, response.clone());
          } catch {
            // Offline preparation is best effort; never block online navigation.
          }
        }
        return response;
      }).catch(async () => {
        const isViva = /^\/ot\/[^/]+\/viva$/.test(url.pathname);
        const isPreparedTerrainRoute =
          url.pathname === "/haras/partos" ||
          url.pathname === "/ot" ||
          /^\/ot\/[^/]+$/.test(url.pathname) ||
          isViva;

        if (isPreparedTerrainRoute) {
          const terrainCache = await caches.open(TERRAIN_CACHE);
          const preparedRoute = await terrainCache.match(url.pathname, {
            ignoreSearch: true,
          });
          if (preparedRoute) return preparedRoute;

          // A first visit to OT Viva while already offline cannot load the
          // dynamic route. Keep the requested OT in the prepared terrain editor.
          if (isViva) {
            const preparedOtRoute = await terrainCache.match("/ot");
            if (preparedOtRoute) {
              const otId = url.pathname.split("/")[2];
              return Response.redirect(
                new URL(`/ot?offline_ot=${encodeURIComponent(otId)}`, self.location.origin),
                302,
              );
            }
          }

          if (url.pathname.startsWith("/ot/") && url.pathname.split("/").length === 3) {
            const preparedOtRoute = await terrainCache.match("/ot");
            if (preparedOtRoute) {
              const otId = url.pathname.split("/")[2];
              return Response.redirect(
                new URL(`/ot?offline_ot=${encodeURIComponent(otId)}`, self.location.origin),
                302,
              );
            }
          }

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
