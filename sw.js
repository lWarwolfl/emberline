/* Offline cache for the static build. Bump CACHE when any cached file changes. */
const CACHE = "emberline-v5.3.0";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
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
  "./src/config.js",
  "./src/upgrades.js",
  "./src/loadout.js",
  "./src/random.js",
  "./src/content.js",
  "./src/difficulty.js",
  "./src/generator.js",
  "./src/combat.js",
  "./src/engine.js",
  "./src/audio.js",
  "./src/particles.js",
  "./src/pixel.js",
  "./src/backgrounds.js",
  "./src/cloth.js",
  "./src/sprites.js",
  "./src/renderer.js",
  "./src/storage.js",
  "./src/economy.js",
  "./src/ui.js",
  "./src/input.js",
  "./src/popups.js",
  "./src/upgrade-panel.js",
  "./src/wardrobe.js",
  "./src/app.js",
  "./src/main.js",
  "./src/pwa.js",
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
  // Navigation stays fresh online; installed clients still open offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html")),
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
