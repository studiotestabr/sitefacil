/* ==========================================================================
   SPXrotas Pro v1.0.0 - Service Worker Oficial
   Receptor de Romaneios Compartilhados, Cache Seguro & PWA Offline
   Arquivo: /spxrotas/app/sw.js
   ========================================================================== */

const CACHE_NAME = 'spxrotas-v1.0.0';
const SHARED_CACHE_NAME = 'spxrotas-shared-files';

// Recursos essenciais para inicialização offline
const RECURSOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './splash.jpg',
  './css/styles.css?v=7.0.0',
  './js/app.js?v=7.0.0',
  './js/relatorio.js?v=7.0.0'
];

// 1. INSTALAÇÃO DO SERVICE WORKER
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta fazer o pré-cache dos recursos estáticos locais sem travar a instalação caso algum falhe
      return Promise.allSettled(
        RECURSOS_ESSENCIAIS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SPXrotas SW] Não foi possível pré-cachear: ${url}`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// 2. ATIVAÇÃO E LIMPEZA DE CACHES ANTIGOS (INCLUINDO DRIVEXPS LEGADO)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chavesCache) => {
      return Promise.all(
        chavesCache.map((chave) => {
          // Deleta caches com versões anteriores ou com a marca antiga drivexps
          if (chave !== CACHE_NAME && chave !== SHARED_CACHE_NAME) {
            console.log(`[SPXrotas SW] Limpando cache obsoleto: ${chave}`);
            return caches.delete(chave);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. INTERCEPTAÇÃO DE REQUISIÇÕES E SHARE TARGET DO ANDROID
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. INTERCEPTAÇÃO DO RECURSO "COMPARTILHAR COM SPXROTAS" DO ANDROID
  if (event.request.method === 'POST' && url.pathname.includes('compartilhar-arquivo')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('romaneio');

        if (file) {
          const cacheCompartilhado = await caches.open(SHARED_CACHE_NAME);
          await cacheCompartilhado.put(
            'ultimo-romaneio',
            new Response(file, {
              headers: {
                'Content-Type': file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'X-File-Name': encodeURIComponent(file.name || 'romaneio_shopee.xlsx')
              }
            })
          );

          // Procura se o app já está aberto em alguma aba e notifica em tempo real
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of clientList) {
            if ('focus' in client) {
              client.postMessage({ tipo: 'NOVO_ROMANEIO_COMPARTILHADO' });
              return client.focus();
            }
          }

          // Se o app não estava aberto, redireciona abrindo com o parâmetro de captura
          return Response.redirect('./?arquivo_compartilhado=true', 303);
        }
      } catch (err) {
        console.error('[SPXrotas SW] Erro ao interceptar arquivo compartilhado:', err);
      }
      return Response.redirect('./', 303);
    })());
    return;
  }

  // B. REQUISIÇÕES DE API / EXTERNAS (DIRECTUS, N8N, OSRM, CARTOCDN, NOMINATIM, ETC.)
  // Estas devem passar direto pela rede para garantir dados 100% atualizados
  const isApiExterna = 
    url.hostname.includes('banco.studiotesta.com.br') ||
    url.hostname.includes('n8n.studiotesta.com.br') ||
    url.hostname.includes('rotas.studiotesta.com.br') ||
    url.hostname.includes('pushinpay.com.br') ||
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('router.project-osrm.org') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    event.request.method !== 'GET';

  if (isApiExterna) {
    event.respondWith(fetch(event.request));
    return;
  }

  // C. REQUISIÇÕES ESTÁTICAS LOCAIS (NETWORK FIRST COM FALLBACK PARA CACHE)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se a resposta for válida, salva uma cópia no cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Sem internet (subsolo / garagem / área de sombra) -> usa o cache do PWA
        return caches.match(event.request);
      })
  );
});

// 4. MENSAGENS ENTRE JANELAS E SERVICE WORKER
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});