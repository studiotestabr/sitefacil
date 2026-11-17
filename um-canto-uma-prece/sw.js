/* ==========================================================================
   Um Canto, Uma Prece! v1.0.0 - Service Worker Oficial
   Cache Seguro, PWA Instalável & Reprodução de Áudio Offline com Suporte Range
   Arquivo: /um-canto-uma-prece/sw.js
   ========================================================================== */

const CACHE_NAME = 'um-canto-uma-prece-v1.0.0';
const AUDIO_CACHE_NAME = 'um-canto-uma-prece-audios-v1';

// Recursos essenciais para inicialização offline
const RECURSOS_ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css?v=1.0.0',
  './js/app.js?v=1.0.0'
];

// 1. INSTALAÇÃO DO SERVICE WORKER
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        RECURSOS_ESSENCIAIS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[Um Canto SW] Não foi possível pré-cachear: ${url}`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// 2. ATIVAÇÃO E LIMPEZA DE CACHES OBSOLETOS
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chavesCache) => {
      return Promise.all(
        chavesCache.map((chave) => {
          if (chave !== CACHE_NAME && chave !== AUDIO_CACHE_NAME) {
            console.log(`[Um Canto SW] Limpando cache obsoleto: ${chave}`);
            return caches.delete(chave);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Helper: Atende áudios do Directus salvos offline com suporte completo a Range (206 Partial Content)
async function responderAudioComCache(request) {
  const urlLimpa = request.url.split('#')[0];

  try {
    const audioCache = await caches.open(AUDIO_CACHE_NAME);
    const cachedResponse = await audioCache.match(urlLimpa);

    if (cachedResponse) {
      const rangeHeader = request.headers.get('range');
      if (!rangeHeader) {
        return cachedResponse;
      }

      const buf = await cachedResponse.arrayBuffer();
      const match = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader);
      if (!match) {
        return cachedResponse;
      }

      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), buf.byteLength - 1) : buf.byteLength - 1;
      const slice = buf.slice(start, end + 1);

      return new Response(slice, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
          'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
          'Content-Length': String(slice.byteLength),
          'Accept-Ranges': 'bytes'
        }
      });
    }
  } catch (err) {
    console.warn('[Um Canto SW] Falha ao ler cache de áudio:', err);
  }

  // Se não está no cache offline, busca direto da rede
  return fetch(request);
}

// 3. INTERCEPTAÇÃO DE REQUISIÇÕES
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. ÁUDIOS DO DIRECTUS (/assets/) -> Suporta reprodução offline salva pelo médium
  if (
    event.request.method === 'GET' &&
    url.hostname.includes('banco.studiotesta.com.br') &&
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(responderAudioComCache(event.request));
    return;
  }

  // B. REQUISIÇÕES DE API / EXTERNAS (DIRECTUS, N8N, CDNs) -> Rede direta
  const isApiOuExterna =
    url.hostname.includes('banco.studiotesta.com.br') ||
    url.hostname.includes('n8n.studiotesta.com.br') ||
    url.hostname !== self.location.hostname ||
    event.request.method !== 'GET';

  if (isApiOuExterna) {
    event.respondWith(fetch(event.request));
    return;
  }

  // C. ARQUIVOS ESTÁTICOS LOCAIS (NETWORK FIRST COM FALLBACK PARA CACHE)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// 4. MENSAGENS ENTRE APP E SERVICE WORKER
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});