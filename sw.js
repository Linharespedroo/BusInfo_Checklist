const CACHE_NAME = "checklist-veicular-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/empresa.html",
  "/documentos.html",
  "/inspecao.html",
  "/conclusao.html",
  "/historico.html",
  "/css/estilo.css",
  "/js/config.js",
  "/js/db.js",
  "/js/parser.js",
  "/js/camera.js",
  "/js/sync.js",
  "/js/app.js",
  "https://unpkg.com/dexie@3.2.4/dist/dexie.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker instalando...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Cache aberto");
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker ativado");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Removendo cache antigo:", cacheName);
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }),
  );
});
