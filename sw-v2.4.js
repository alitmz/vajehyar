const CACHE = 'vajehyar-v2.4.0';
const CORE = [
  './',
  './index.html',
  './styles-v2.4.css?release=2.4.0',
  './bootstrap-v2.4.js?release=2.4.0',
  './app-v2.4.js?release=2.4.0',
  './manifest.webmanifest?release=2.4.0',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && key.startsWith('vajehyar-')).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

async function networkFirst(request, fallback){
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, {cache:'no-store'});
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || (fallback ? await cache.match(fallback) : undefined) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({offline:true}), {
      status:503,
      headers:{'Content-Type':'application/json'}
    })));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  const isCode = /(?:app-v2\.4|bootstrap-v2\.4|styles-v2\.4|manifest\.webmanifest)/.test(url.pathname);
  if (isCode) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  })));
});
