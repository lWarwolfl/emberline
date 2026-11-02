export {};
declare const self: ServiceWorkerGlobalScope;
/* Offline cache for the static build. Bump CACHE when any cached file changes. */
const CACHE = "emberline-v7.1.8";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./dist/game.js",
  "./site.webmanifest",
  "./favicon.ico",
  "./assets/favicon.svg",
  "./assets/icon-16.png",
  "./assets/icon-32.png",
  "./assets/icon-48.png",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/og-image.png",
  "./assets/preview-square.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/host-info" ||
    url.pathname === "/desktop-info" ||
    url.pathname === "/party"
  )
    return;
  if (request.cache === "reload" || request.cache === "no-cache" || request.cache === "no-store")
    return;
  const freshAsset =
    url.pathname.endsWith("/style.css") ||
    url.pathname.endsWith("/dist/game.js") ||
    url.pathname.endsWith("/game.js");
  if (freshAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) ?? Response.error()),
    );
    return;
  }
  // Navigation stays fresh online; installed clients still open offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(async () => (await caches.match("./index.html")) ?? Response.error()),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
