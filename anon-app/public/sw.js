// ANON service worker: cache public static assets only.
// Dynamic pages, RSC payloads, API responses, chat content and navigations are network-only.
const CACHE_NAME = "anon-static-v2";
const PRECACHE = ["/manifest.json", "/icons/icon.svg"];
const STATIC_PATH = /^\/(?:icons\/[^/]+\.(?:svg|png|ico|webp)|fonts\/[^/]+\.(?:woff2?|ttf)|_next\/static\/.+|favicon\.ico|manifest\.json)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key.startsWith("anon-") && key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.search || request.headers.has("authorization")) return;
  if (!STATIC_PATH.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    const cacheControl = response.headers.get("cache-control") || "";
    const vary = response.headers.get("vary") || "";
    const safeToCache =
      response.status === 200 &&
      response.type === "basic" &&
      !/private|no-store/i.test(cacheControl) &&
      vary.trim() !== "*";

    if (safeToCache) {
      try { await cache.put(request, response.clone()); } catch { /* cache failure must not fail the request */ }
    }
    return response;
  })());
});
