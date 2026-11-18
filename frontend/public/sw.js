/* Cache only the application shell/assets. NEVER cache /api or auth-bearing responses. */
const CACHE = 'aquasentra-stage2-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(req).then(resp => {
    if (resp.ok && (req.mode === 'navigate' || url.pathname.startsWith('/assets/'))) {
      const clone = resp.clone(); caches.open(CACHE).then(cache => cache.put(req, clone));
    }
    return resp;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('/') : Response.error())));
});
