/* service-worker.js — Mercado Limpio Ventas (PWA) */
const CACHE_VERSION = 'ml-pwa-v4';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// IMPORTANTE: cacheamos SOLO archivos del mismo origen
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',

  './ml-favicon-16.png',
  './ml-favicon-32.png',

  './ml-icon-48.png',
  './ml-icon-72.png',
  './ml-icon-96.png',
  './ml-icon-96-monochrome.png',
  './ml-icon-128.png',
  './ml-icon-192.png',
  './ml-icon-192-maskable.png',
  './ml-icon-256.png',
  './ml-icon-384.png',
  './ml-icon-512.png',
  './ml-icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (![STATIC_CACHE, RUNTIME_CACHE].includes(k)) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET
  if (req.method !== 'GET') return;

  // No cachear llamadas a tu Worker/API (si están en otro dominio)
  // (Igual no entran por ser cross-origin, pero por las dudas)
  if (url.hostname.includes('workers.dev')) return;

  // Navegación: Network-first con fallback al cache (clave para PWA)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put('./', fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match('./');
        return cached || caches.match('./index.html') || new Response('Offline', { status: 200 });
      }
    })());
    return;
  }

  // Estáticos: Cache-first + refresh en background
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Cachear solo same-origin y respuestas OK
      if (res && res.ok && url.origin === self.location.origin) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      // fallback si no hay nada
      return cached || new Response('', { status: 200 });
    }
  })());
});
