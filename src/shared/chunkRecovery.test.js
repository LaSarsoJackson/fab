import { describe, expect, test } from "bun:test";

import {
  isChunkLoadError,
  recoverFromStaleChunkLoad,
} from "./chunkRecovery";

const createWindowStub = () => {
  const storage = new Map();
  let reloadCount = 0;

  return {
    get reloadCount() {
      return reloadCount;
    },
    location: {
      reload: () => {
        reloadCount += 1;
      },
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
};

describe("stale chunk recovery", () => {
  test("recognizes browser and webpack dynamic-import failures", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError" })).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 61 failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Burial records failed to load"))).toBe(false);
  });

  test("reloads once and then stops a short reload loop", () => {
    const windowRef = createWindowStub();
    const error = new Error("Loading chunk 61 failed.");

    expect(recoverFromStaleChunkLoad(error, { now: 1_000, windowRef })).toBe(true);
    expect(windowRef.reloadCount).toBe(1);
    expect(recoverFromStaleChunkLoad(error, { now: 2_000, windowRef })).toBe(false);
    expect(windowRef.reloadCount).toBe(1);
    expect(recoverFromStaleChunkLoad(error, { now: 62_000, windowRef })).toBe(true);
    expect(windowRef.reloadCount).toBe(2);
  });

  test("does not reload when the cooldown marker cannot be persisted", () => {
    let reloadCount = 0;
    const windowRef = {
      location: {
        reload: () => {
          reloadCount += 1;
        },
      },
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage denied");
        },
      },
    };

    expect(recoverFromStaleChunkLoad(
      new Error("Loading chunk 61 failed."),
      { now: 1_000, windowRef }
    )).toBe(false);
    expect(reloadCount).toBe(0);
  });
});
