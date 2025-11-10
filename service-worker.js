self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// 🚫 No cacheamos nada, todo online (hasta que terminemos visual pro)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
