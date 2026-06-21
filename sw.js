const CACHE = 'p2p-v14';
const TILE_CACHE = 'p2p-tiles-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/styles-modern.css',
  '/styles-map-first.css',
  '/styles-features.css',
  '/styles-interaction.css',
  '/styles-roles.css',
  '/styles-map-fixed.css',
  '/styles-premium.css',
  '/styles-search-ai.css',
  '/styles-map-chrome.css',
  '/styles-map-rail.css',
  '/js/search-ai.js',
  '/js/interaction-ui.js',
  '/js/premium-hub.js',
  '/js/charts.js',
  '/js/trip-tracker.js',
  '/js/role-hub.js',
  '/js/admin-hub.js',
  '/js/env.js',
  '/js/config.js',
  '/js/firebase-init.js',
  '/js/api-client.js',
  '/js/map-engine.js',
  '/js/i18n.js',
  '/js/ws-client.js',
  '/js/rail-hub.js',
  '/js/features.js',
  '/js/app.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/node_modules/leaflet/dist/leaflet.css',
  '/node_modules/leaflet/dist/leaflet.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'cache_tiles') {
    const { lat, lng } = e.data;
    cacheTilesAround(lat, lng);
  }
});

async function cacheTilesAround(lat, lng) {
  const cache = await caches.open(TILE_CACHE);
  const zoom = 13;
  const n = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  const m = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const urls = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      urls.push(`https://tile.openstreetmap.org/${zoom}/${n + dx}/${m + dy}.png`);
    }
  }
  await Promise.all(urls.map((url) => fetch(url).then((r) => r.ok && cache.put(url, r)).catch(() => {})));
}

self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'P2P Transport', body: 'نئی اطلاع' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg'
    })
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;

  if (request.url.includes('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(TILE_CACHE).then((cache) =>
        cache.match(request).then((cached) =>
          cached || fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached)
        )
      )
    );
    return;
  }

  if (request.url.includes('/api/')) {
    e.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() =>
          new Response(JSON.stringify({ success: false, error: 'Offline — API unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        )
    );
    return;
  }

  e.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok && request.method === 'GET') {
            caches.open(CACHE).then((cache) => cache.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
