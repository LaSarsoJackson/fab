const CACHE_NAME = "fab-v8";
const SEARCH_DATA_PATH = "/data/Search_Burials.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(self.registration.scope))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => /^(?:fab-v|fab-static-v|fab-runtime-v)\d+$/.test(key) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const appPath = new URL(self.registration.scope).pathname;
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(appPath)) return;

  // Avoid cloning and storing the 13 MB search payload while the worker is
  // decoding it. The browser's HTTP cache remains the single cache owner.
  if (url.pathname.endsWith(SEARCH_DATA_PATH)) return;

  if (request.mode === "navigate") {
    const cacheKey = url.pathname === appPath || url.pathname === `${appPath}index.html`
      ? self.registration.scope
      : null;
    if (!cacheKey) return;
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(cacheKey, response.clone());
          }
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  // Build assets alone belong in this app cache. The HTTP cache owns query
  // variants and documents outside the application shell.
  if (url.search || !url.pathname.startsWith(`${appPath}assets/`)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        event.waitUntil(storeAsset(request, response.clone()));
      }
      return response;
    }))
  );
});

// Serialize cache writes so simultaneous loads cannot bypass the entry budget.
let cacheWrites = Promise.resolve();
function storeAsset(request, response) {
  const operation = cacheWrites.then(async () => {
    const reader = response.body?.getReader();
    if (!reader) return;
    let bytes = 0;
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2 * 1024 * 1024) { await reader.cancel(); return; }
      chunks.push(value);
    }
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    // One shell plus at most 32 assets of at most 2 MiB each, including MapView.
    const assets = keys.filter((key) => key.url !== self.registration.scope);
    for (const key of assets.slice(0, Math.max(0, assets.length - 31))) await cache.delete(key);
    await cache.put(request, new Response(new Blob(chunks), { status: response.status, headers: response.headers }));
  });
  cacheWrites = operation.catch(() => {});
  return cacheWrites;
}
