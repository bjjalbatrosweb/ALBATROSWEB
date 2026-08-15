const CACHE_VERSION = "albatros-static-v3";
const SAFE_SHELL = ["/offline.html", "/manifest.webmanifest"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SAFE_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("albatros-") && key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION); const cached = await cache.match(request);
  const network = fetch(request).then((response) => { if (response.ok && response.type === "basic") void cache.put(request, response.clone()); return response; });
  return cached || network;
}
self.addEventListener("fetch", (event) => {
  const request = event.request; if (request.method !== "GET") return; const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") { event.respondWith(fetch(request).catch(() => caches.match("/offline.html"))); return; }
  if (url.pathname.startsWith("/_next/static/") || /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|avif|ico)$/i.test(url.pathname)) event.respondWith(staleWhileRevalidate(request));
});
