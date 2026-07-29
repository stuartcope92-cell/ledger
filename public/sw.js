// Minimal offline app-shell service worker. No account, no server sync —
// purely a packaging change so the app installs and its shell still loads
// offline. Vite's build hashes JS/CSS filenames, so instead of precaching a
// fixed asset list at write time, this runtime-caches same-origin GET
// responses as they're fetched: the shell + assets become available offline
// after the first successful (online) load.
const CACHE = "ledger-shell-v1";
const APP_SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Network-first for the app shell so online users get the latest build;
    // fall back to the cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./"))),
    );
    return;
  }

  // Everything else (hashed JS/CSS, icons): serve from cache if we have it,
  // refreshing in the background; otherwise fetch and cache for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});
