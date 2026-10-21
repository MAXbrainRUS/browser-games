// Service worker: makes the catalog and every game work offline and installable as an app.
// scripts/build.mjs fills in VERSION and FILES; edit this file, not dist/sw.js.
//
// Strategy: always try the network first (revalidating past GitHub Pages' 10-minute HTTP cache),
// so a merged change shows up on the next launch; fall back to the cached copy when offline
// or when the network is slower than NETWORK_TIMEOUT.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'games-' + VERSION;
const FONT_CACHE = 'fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 3500;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key !== FONT_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    const key = url.origin + url.pathname + url.search;
    // Navigations keep redirect: 'manual' so a redirect reaches the browser instead of failing in Safari
    const network = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin', redirect: req.mode === 'navigate' ? 'manual' : 'follow' });
    event.waitUntil(network.then(res => res.ok && put(CACHE, key, res.clone())).catch(() => {}));
    event.respondWith(networkFirst(network, key, req.mode === 'navigate'));
    return;
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    // Fetch with CORS so the cached copy is a readable response rather than an opaque one
    const network = () => fetch(url.href, { mode: 'cors', credentials: 'omit' });
    event.respondWith(caches.match(url.href).then(hit => {
      if (hit && url.hostname === 'fonts.gstatic.com') return hit;
      const fresh = network();
      event.waitUntil(fresh.then(res => res.ok && put(FONT_CACHE, url.href, res.clone())).catch(() => {}));
      return hit || fresh;
    }));
  }
});

async function networkFirst(network, key, isPage) {
  const cached = await caches.match(key, { ignoreSearch: isPage });
  if (!cached) return network;
  const slow = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT, null));
  try {
    const res = await Promise.race([network, slow]);
    return res && (res.ok || res.type === 'opaqueredirect') ? res : cached;
  } catch {
    return cached;
  }
}

async function put(cacheName, key, res) {
  const cache = await caches.open(cacheName);
  await cache.put(key, res);
}
