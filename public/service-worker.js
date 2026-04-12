const STATIC_CACHE = 'fab-static-v2';
const RUNTIME_CACHE = 'fab-runtime-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './logo192.png',
  './logo512.png',
];
const SHELL_ASSET_PATTERN = /\.(?:js|css|svg|ico|woff2?)$/i;
const IMAGE_ASSET_PATTERN = /\.(?:png|jpg|jpeg|gif|webp|avif)$/i;
const JSON_ASSET_PATTERN = /\.json$/i;
const LARGE_DATASET_PATTERN = /(Geo_Burials|Burials|ARC_Burials).*\.json$/i;
const MAX_RUNTIME_CACHE_BYTES = 1_500_000;

const isCacheableResponse = (response) => Boolean(response && response.ok);

const putIfSmallEnough = async (cache, request, response) => {
  if (!isCacheableResponse(response)) {
    return response;
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_RUNTIME_CACHE_BYTES) {
    return response;
  }

  await cache.put(request, response.clone());
  return response;
};

const networkFirst = async (request, { cacheName = RUNTIME_CACHE, fallbackUrl } = {}) => {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    await putIfSmallEnough(cache, request, response);
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (fallbackUrl) {
      return caches.match(fallbackUrl);
    }

    throw error;
  }
};

const staleWhileRevalidate = async (request, { cacheName = RUNTIME_CACHE } = {}) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => putIfSmallEnough(cache, request, response))
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => ![STATIC_CACHE, RUNTIME_CACHE].includes(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, { cacheName: STATIC_CACHE, fallbackUrl: './index.html' })
    );
    return;
  }

  if (SHELL_ASSET_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(
      staleWhileRevalidate(request, { cacheName: RUNTIME_CACHE })
    );
    return;
  }

  if (JSON_ASSET_PATTERN.test(requestUrl.pathname)) {
    if (LARGE_DATASET_PATTERN.test(requestUrl.pathname)) {
      event.respondWith(
        fetch(request).catch(() => caches.match(request))
      );
      return;
    }

    event.respondWith(
      networkFirst(request, { cacheName: RUNTIME_CACHE })
    );
    return;
  }

  if (IMAGE_ASSET_PATTERN.test(requestUrl.pathname)) {
    event.respondWith(
      staleWhileRevalidate(request, { cacheName: RUNTIME_CACHE })
    );
  }
});
