const CACHE_NAME = 'drivexps-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Passa as requisições direto para a rede
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});