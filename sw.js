const CACHE_NAME = 'checklist-veicular-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/empresa.html',
  '/documentos.html',
  '/inspecao.html',
  '/conclusao.html',
  '/historico.html',
  '/css/estilo.css',
  '/js/app.js',
  '/js/db.js',
  '/js/camera.js',
  '/js/sync.js',
  '/js/config.js',
  '/manifest.json'
];

// URLs externas (Google Drive JSONs)
const externalUrls = [
  CONFIG.CPFS_URL,
  CONFIG.VEICULOS_URL,
  CONFIG.IRREGULARIDADES_URL
];

// Instalação
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all([
          cache.addAll(urlsToCache),
          ...externalUrls.map(url => 
            fetch(url).then(response => cache.put(url, response))
          )
        ]);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia: Stale-While-Revalidate para JSONs, Cache First para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Para JSONs do Drive: Stale-While-Revalidate
  if (url.href.includes('drive.google.com') || externalUrls.includes(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  } else {
    // Para assets locais: Cache First
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request);
        })
    );
  }
});

// Background Sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-checklists') {
    event.waitUntil(syncChecklists());
  }
});

async function syncChecklists() {
  try {
    // Aqui será implementada a sincronização com R2
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STARTED'
      });
    });
    
    // TODO: Implementar upload para R2
    
  } catch (error) {
    console.error('Erro na sincronização:', error);
  }
}