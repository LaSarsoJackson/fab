import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const loadServiceWorkerFetchListener = ({ fetchImpl, cacheImpl }) => {
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
  return listeners.fetch;
};

describe("service worker runtime caching", () => {
  test("caches the public search payload when storage allows it", async () => {
    const cachedRequests = [];
    const response = {
      ok: true,
      headers: {
        get: (name) => (name.toLowerCase() === "content-length" ? "36000000" : null),
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
        url: "https://example.test/data/Search_Burials.json",
      },
      respondWith: (promise) => {
        responsePromise = Promise.resolve(promise);
      },
    });

    await expect(responsePromise).resolves.toBe(response);
    expect(cachedRequests).toEqual(["https://example.test/data/Search_Burials.json"]);
  });

  test("falls back to the cached public search payload when the network fails", async () => {
    const cachedResponse = { ok: true, source: "runtime-cache" };
    const cache = {
      match: async () => cachedResponse,
      put: async () => {
        throw new Error("offline response should not be rewritten");
      },
    };
    const fetchListener = loadServiceWorkerFetchListener({
      fetchImpl: async () => {
        throw new Error("offline");
      },
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
        url: "https://example.test/data/Search_Burials.json",
      },
      respondWith: (promise) => {
        responsePromise = Promise.resolve(promise);
      },
    });

    await expect(responsePromise).resolves.toBe(cachedResponse);
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
