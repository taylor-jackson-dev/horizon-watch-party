/*
 * Watch Party service worker — deliberately conservative.
 *
 * This is a real-time app (sockets, synced video, voice, auth). The SW must
 * NOT cache anything dynamic or it will serve stale/cross-user state. So:
 *   - non-GET, /api/*, cross-origin (YouTube/LiveKit/avatars) → passthrough.
 *   - page navigations → network-first, with an offline fallback page.
 *     HTML is never cached (avoids serving a stale or another user's page).
 *   - immutable build assets (/_next/static) → cache-first.
 *   - other same-origin GETs (icons, manifest) → stale-while-revalidate.
 */
const CACHE = "wp-cache-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/favicon-32.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCacheable(res) {
  return res && res.ok && res.type === "basic";
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (isCacheable(res)) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || fetch(req);
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (isCacheable(res)) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // YouTube, LiveKit, avatars…
  if (url.pathname.startsWith("/api")) return; // auth, sockets handshake, REST

  // Page navigations: always try the network (fresh, authed); fall back to the
  // offline page when there's no connection. HTML is intentionally not cached.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});
