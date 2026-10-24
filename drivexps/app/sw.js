const CACHE_NAME = 'drivexps-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercepta o envio de arquivo via Compartilhar do Android
  if (event.request.method === 'POST' && url.pathname.includes('compartilhar-arquivo')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('romaneio');

        if (file) {
          const cache = await caches.open('drivexps-shared-files');
          await cache.put('ultimo-romaneio', new Response(file, {
            headers: {
              'Content-Type': file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'X-File-Name': encodeURIComponent(file.name || 'romaneio_shopee.xlsx')
            }
          }));

          const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of clientList) {
            if ('focus' in client) {
              client.postMessage({ tipo: 'NOVO_ROMANEIO_COMPARTILHADO' });
              return client.focus();
            }
          }

          return Response.redirect('./?arquivo_compartilhado=true', 303);
        }
      } catch (err) {
        console.error('Erro no ServiceWorker ao processar romaneio compartilhado:', err);
      }
      return Response.redirect('./', 303);
    })());
    return;
  }

  // 2. Requisições normais
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
})