// SanguKu Service Worker — network-first (update otomatis saat online)
const C = 'sanguku-v3';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isDoc) {
    // Halaman: jaringan dulu (selalu versi terbaru), fallback ke cache kalau offline
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-store' });
        const cache = await caches.open(C); cache.put(e.request, fresh.clone()); return fresh;
      } catch (err) {
        const cached = await caches.match(e.request); return cached || caches.match('./');
      }
    })());
    return;
  }
  // Aset lain: cache-first untuk kecepatan
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try { const res = await fetch(e.request); const c = await caches.open(C); c.put(e.request, res.clone()); return res; }
    catch (err) { return cached; }
  })());
});
