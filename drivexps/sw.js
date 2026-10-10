const CACHE_NAME = 'drivexps-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercepta arquivos compartilhados no Android pelo "Compartilhar com DriveXPS"
  if (event.request.method === 'POST' && url.pathname.includes('compartilhar-arquivo')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('romaneio');
        if (file) {
          const cache = await caches.open('drivexps-shared-files');
          await cache.put('ultimo-romaneio', new Response(file));
          return Response.redirect('./?arquivo_compartilhado=true', 303);
        }
      } catch (err) {
        console.error('Erro ao receber arquivo compartilhado:', err);
      }
      return Response.redirect('./', 303);
    })());
    return;
  }

  // Requisições normais do app
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});