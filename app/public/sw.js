/* El Niño 2026 — service worker
   Network-first for live data (data.json, meta.json, news/*) so the dashboard
   always shows the freshest committed payload; stale-while-revalidate for the
   app shell assets. */
const CACHE = "el-nino-2026-v1";
const DATA_PATTERNS = [/\/data\.json$/, /\/meta\.json$/, /\/news\//];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin

  const isData = DATA_PATTERNS.some((p) => p.test(url.pathname));

  if (isData) {
    // network-first: live data must never go stale
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // stale-while-revalidate for the shell
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
