/**
 * Runtime PWA cache policy for the static FAB build. The service worker keeps
 * the shell installable, caches the compact public search payload generously,
 * and avoids pinning full source datasets into constrained browser storage.
 */
const STATIC_CACHE = 'fab-static-v3';
const RUNTIME_CACHE = 'fab-runtime-v3';
// Keep the app shell installable, but leave large and frequently regenerated
// datasets to route-specific caching rules below.
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
const FIELD_SEARCH_PAYLOAD_PATTERN = /\/data\/Search_Burials\.json$/i;
const LARGE_DATASET_PATTERN = /(Geo_Burials|Burials|ARC_Burials).*\.json$/i;
// Most runtime assets are tiny enough for a conservative cache cap. Search data
// is the exception because it is the offline-critical browse payload.
const MAX_RUNTIME_CACHE_BYTES = 1_500_000;
const MAX_FIELD_DATA_CACHE_BYTES = 50_000_000;

const isCacheableResponse = (response) => Boolean(response && response.ok);

const putIfSmallEnough = async (
  cache,
  request,
  response,
  { maxBytes = MAX_RUNTIME_CACHE_BYTES } = {}
) => {
  if (!isCacheableResponse(response)) {
    return response;
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength && contentLength > maxBytes) {
    return response;
  }

  try {
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('Unable to cache runtime response:', error);
  }
  return response;
};

const networkFirst = async (
  request,
  {
    cacheName = RUNTIME_CACHE,
    fallbackUrl,
    maxBytes = MAX_RUNTIME_CACHE_BYTES,
  } = {}
) => {
  const cache = await caches.open(cacheName);

  try {
    // Data and navigations should prefer fresh content, then fall back to the
    // last cached response when the cemetery visitor is offline.
    const response = await fetch(request);
    await putIfSmallEnough(cache, request, response, { maxBytes });
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

const staleWhileRevalidate = async (
  request,
  {
    cacheName = RUNTIME_CACHE,
    maxBytes = MAX_RUNTIME_CACHE_BYTES,
  } = {}
) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  // Static shell assets and images can render immediately from cache while the
  // service worker refreshes them in the background for the next visit.
  const networkPromise = fetch(request)
    .then((response) => putIfSmallEnough(cache, request, response, { maxBytes }))
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
    if (FIELD_SEARCH_PAYLOAD_PATTERN.test(requestUrl.pathname)) {
      event.respondWith(
        networkFirst(request, {
          cacheName: RUNTIME_CACHE,
          maxBytes: MAX_FIELD_DATA_CACHE_BYTES,
        })
      );
      return;
    }

    if (LARGE_DATASET_PATTERN.test(requestUrl.pathname)) {
      // Full source datasets can be much larger than the PWA cache budget. Try
      // the network first and use an existing cache entry only as an offline
      // safety net.
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
