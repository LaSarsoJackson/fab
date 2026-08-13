const DEFAULT_CHUNK_RELOAD_COOLDOWN_MS = 60_000;
const DEFAULT_CHUNK_RELOAD_STORAGE_KEY = "fab:stale-chunk-reload";

export const isChunkLoadError = (error) => {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "");

  return name === "ChunkLoadError" || (
    /loading chunk [^ ]+ failed/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message)
  );
};

/**
 * Reload once when an open PWA shell points at a hashed bundle removed by a
 * newer deployment. The cooldown prevents a bad deployment from becoming a
 * reload loop; storage failures never hide the original loading error.
 */
export const recoverFromStaleChunkLoad = (
  error,
  {
    cooldownMs = DEFAULT_CHUNK_RELOAD_COOLDOWN_MS,
    now = Date.now(),
    storageKey = DEFAULT_CHUNK_RELOAD_STORAGE_KEY,
    windowRef = typeof window === "undefined" ? null : window,
  } = {}
) => {
  if (!windowRef || !isChunkLoadError(error)) {
    return false;
  }

  let lastReloadAt = 0;
  try {
    if (!windowRef.sessionStorage) {
      return false;
    }
    lastReloadAt = Number(windowRef.sessionStorage.getItem(storageKey) || 0);
  } catch (_error) {
    // Without a durable marker, reloading could trap a locked-down WebView in
    // a loop. Keep the original error visible instead.
    return false;
  }

  if (lastReloadAt > 0 && (now - lastReloadAt) < cooldownMs) {
    return false;
  }

  try {
    windowRef.sessionStorage.setItem(storageKey, String(now));
  } catch (_error) {
    return false;
  }

  windowRef.location?.reload?.();
  return true;
};
