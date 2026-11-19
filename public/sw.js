/* 小手机 BYOK Service Worker：静态资源缓存优先，页面网络优先，API 不缓存 */
const CACHE = 'sp-byok-v3';
// 支持子路径部署：/phone/sw.js → BASE=/phone/
const BASE = new URL('./', self.location).pathname;
const PRECACHE = [
  BASE,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-180.png`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-maskable-512.png`,
];
const NAV_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('sp-byok-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** 网络优先，超时或失败时回退缓存 */
function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      caches.match(request).then((hit) => resolve(hit || caches.match(BASE)));
    }, NAV_TIMEOUT);

    fetch(request)
      .then((response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        resolve(response);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        caches.match(request).then((hit) => resolve(hit || caches.match(BASE)));
      });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;
  if (url.pathname.startsWith(`${BASE}api/`)) return;

  // 页面导航：网络优先，离线/超时回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    }),
  );
});
