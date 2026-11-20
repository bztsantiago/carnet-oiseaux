// Service worker : met toute l'appli en cache pour qu'elle marche sans réseau.
// À CHAQUE MODIFICATION D'UN FICHIER, augmenter VERSION : les téléphones
// téléchargent alors la nouvelle version au prochain lancement en ligne.
// tools/check-assets.mjs vérifie que la liste ASSETS est complète.
const VERSION = 'v2';
const CACHE = `carnet-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './data/seed.json',
  './js/app.js',
  './js/router.js',
  './js/db/idb.js',
  './js/db/repo.js',
  './js/db/seed.js',
  './js/domain/models.js',
  './js/domain/normalize.js',
  './js/domain/species.js',
  './js/lib/xlsx-writer.js',
  './js/screens/balade.js',
  './js/screens/export.js',
  './js/screens/history.js',
  './js/screens/start.js',
  './js/screens/stats.js',
  './js/screens/walk.js',
  './js/services/export-xlsx.js',
  './js/services/stats.js',
  './js/services/sync/supabase.js',
  './js/services/sync/sync.js',
  './js/ui/add-panel.js',
  './js/ui/components.js',
  './js/ui/lieu-form.js',
  './js/ui/obs-item.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('carnet-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(request)));
    return;
  }
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
