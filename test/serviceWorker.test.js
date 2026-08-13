import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const loadServiceWorkerListeners = ({ fetchImpl, cacheImpl }) => {
  const listeners = {};
  const context = {
    URL,
    console: {
      warn: () => {},
      error: () => {},
      log: () => {},
    },
    fetch: fetchImpl,
    caches: cacheImpl,
    self: {
      location: {
        origin: "https://example.test",
      },
      addEventListener: (type, listener) => {
        listeners[type] = listener;
      },
      skipWaiting: () => {},
      clients: {
        claim: () => {},
      },
    },
  };

  // Run the checked-in service worker script so the tests exercise its real
  // fetch listener instead of a copied helper that can drift.
  vm.runInNewContext(readFileSync("public/service-worker.js", "utf8"), context);
  return listeners;
};

const loadServiceWorkerFetchListener = (options) => {
  return loadServiceWorkerListeners(options).fetch;
};

describe("service worker runtime caching", () => {
  test("removes caches from earlier app releases during activation", async () => {
    const deletedCaches = [];
    const listeners = loadServiceWorkerListeners({
      fetchImpl: async () => {
        throw new Error("activation should not fetch");
      },
      cacheImpl: {
        open: async () => ({
          addAll: async () => undefined,
        }),
        match: async () => undefined,
        keys: async () => [
          "fab-static-v3",
          "fab-runtime-v3",
          "fab-static-v4",
          "fab-runtime-v4",
        ],
        delete: async (cacheName) => {
          deletedCaches.push(cacheName);
          return true;
        },
      },
    });

    let activationPromise;
    listeners.activate({
      waitUntil: (promise) => {
        activationPromise = Promise.resolve(promise);
      },
    });

    await activationPromise;
    expect(deletedCaches).toEqual([
      "fab-static-v3",
      "fab-runtime-v3",
      "fab-static-v4",
      "fab-runtime-v4",
    ]);
  });

  test("fetches the public search payload without cloning it into service-worker storage", async () => {
    let openedRuntimeCache = false;
    let cloneCount = 0;
    const response = {
      ok: true,
      clone: () => {
        cloneCount += 1;
        return response;
      },
    };
    const fetchListener = loadServiceWorkerFetchListener({
      fetchImpl: async () => response,
      cacheImpl: {
        open: async () => {
          openedRuntimeCache = true;
          return {};
        },
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      },
    });

    let responsePromise;
    fetchListener({
      request: {
        method: "GET",
        mode: "same-origin",
        url: "https://example.test/data/Search_Burials.json",
      },
      respondWith: (promise) => {
        responsePromise = Promise.resolve(promise);
      },
    });

    await expect(responsePromise).resolves.toBe(response);
    expect(openedRuntimeCache).toBe(false);
    expect(cloneCount).toBe(0);
  });

  test("does not revive a stale service-worker copy of the large search payload", async () => {
    const fetchListener = loadServiceWorkerFetchListener({
      fetchImpl: async () => {
        throw new Error("offline");
      },
      cacheImpl: {
        open: async () => {
          throw new Error("search should not open runtime storage");
        },
        match: async () => ({ ok: true, source: "stale-runtime-cache" }),
        keys: async () => [],
        delete: async () => true,
      },
    });

    let responsePromise;
    fetchListener({
      request: {
        method: "GET",
        mode: "same-origin",
        url: "https://example.test/data/Search_Burials.json",
      },
      respondWith: (promise) => {
        responsePromise = Promise.resolve(promise);
      },
    });

    await expect(responsePromise).rejects.toThrow("offline");
  });

  test("caches multi-megabyte basemap tiles that exceed the generic image cap", async () => {
    const cachedRequests = [];
    const response = {
      ok: true,
      headers: {
        // ~5 MB tile: above the 1.5 MB generic image cap, below the basemap cap.
        get: (name) => (name.toLowerCase() === "content-length" ? "5000000" : null),
      },
      clone: () => response,
    };
    const cache = {
      match: async () => undefined,
      put: async (request) => {
        cachedRequests.push(request.url);
      },
    };
    const fetchListener = loadServiceWorkerFetchListener({
      fetchImpl: async () => response,
      cacheImpl: {
        open: async () => cache,
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      },
    });

    let responsePromise;
    fetchListener({
      request: {
        method: "GET",
        mode: "same-origin",
        url: "https://example.test/basemaps/albany-rural-cemetery-nys-ortho-latest-r0-c0.jpg",
      },
      respondWith: (promise) => {
        responsePromise = Promise.resolve(promise);
      },
    });

    await expect(responsePromise).resolves.toBe(response);
    await Promise.resolve();
    expect(cachedRequests).toEqual([
      "https://example.test/basemaps/albany-rural-cemetery-nys-ortho-latest-r0-c0.jpg",
    ]);
  });

  test("does not runtime-cache the full burial source dataset", async () => {
    const response = { ok: true };
    let openedRuntimeCache = false;
    const fetchListener = loadServiceWorkerFetchListener({
      fetchImpl: async () => response,
      cacheImpl: {
        open: async () => {
          openedRuntimeCache = true;
          return {
            match: async () => undefined,
            put: async () => undefined,
          };
        },
        match: async () => undefined,
        keys: async () => [],
        delete: async () => true,
      },
    });

    let responsePromise;
    fetchListener({
      request: {
        method: "GET",
        mode: "same-origin",
        url: "https://example.test/data/Geo_Burials.json",
      },
      respondWith: (promise) => {
        responsePromise = Promise.resolve(promise);
      },
    });

    await expect(responsePromise).resolves.toBe(response);
    expect(openedRuntimeCache).toBe(false);
  });
});
