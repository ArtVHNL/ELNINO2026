/* El Niño 2026 — service worker (v2)
   Network-first for everything: the shell (HTML) and live data are always
   fetched fresh, so a stale cached bundle can never blank the page again.
   Versioned assets are cached only as an offline fallback. */
const CACHE = "el-nino-2026-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never serve a cached copy of the HTML shell or live data
  const isDocument = request.destination === "document" || /\.html?$/.test(url.pathname);

  event.respondWith(
    fetch(request)
      .then(resp => {
        if (resp && resp.ok && !isDocument && !/\/data\.json$|\/meta\.json$|\/news\//.test(url.pathname)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(request))
  );
});
