import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearStoredCustomMapEngineOverride,
  getRuntimeEnv,
  setStoredCustomMapEngineOverride,
} from "../src/shared/runtime";

const originalWindow = globalThis.window;

beforeEach(() => {
  delete globalThis.window;
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
    return;
  }

  globalThis.window = originalWindow;
});

describe("getRuntimeEnv", () => {
  test("defaults to development when the environment flag is absent", () => {
    expect(getRuntimeEnv({})).toEqual({
      appEnvironment: "development",
      isDev: true,
      featureFlags: {
        customMapEngine: false,
        fabRecordPresentation: true,
        fabTours: true,
        fieldPackets: true,
      },
    });
  });

  test("stays in development when explicitly requested", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "development",
    })).toEqual({
      appEnvironment: "development",
      isDev: true,
      featureFlags: {
        customMapEngine: false,
        fabRecordPresentation: true,
        fabTours: true,
        fieldPackets: true,
      },
    });
  });

  test("switches to production when explicitly requested", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "production",
    })).toEqual({
      appEnvironment: "production",
      isDev: false,
      featureFlags: {
        customMapEngine: false,
        fabRecordPresentation: true,
        fabTours: true,
        fieldPackets: false,
      },
    });
  });

  test("allows explicit feature flag overrides", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "production",
      REACT_APP_ENABLE_FIELD_PACKETS: "true",
      REACT_APP_ENABLE_FAB_TOURS: "false",
      REACT_APP_ENABLE_FAB_RECORD_PRESENTATION: "false",
    })).toEqual({
      appEnvironment: "production",
      isDev: false,
      featureFlags: {
        customMapEngine: false,
        fabRecordPresentation: false,
        fabTours: false,
        fieldPackets: true,
      },
    });
  });

  test("lets a query-string override force the custom map runtime", () => {
    globalThis.window = {
      location: { search: "?mapEngine=custom" },
      localStorage: {
        getItem: () => "false",
      },
    };

    expect(getRuntimeEnv({
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "false",
    }).featureFlags.customMapEngine).toBe(true);
  });

  test("falls back cleanly when localStorage access throws", () => {
    globalThis.window = {
      location: { search: "" },
      localStorage: {
        getItem: () => {
          throw new Error("storage unavailable");
        },
      },
    };

    expect(getRuntimeEnv({
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "true",
    }).featureFlags.customMapEngine).toBe(true);
  });

  test("persists a sticky custom map engine override when localStorage is available", () => {
    const storage = new Map();
    globalThis.window = {
      location: { search: "" },
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        removeItem: (key) => storage.delete(key),
        setItem: (key, value) => storage.set(key, value),
      },
    };

    expect(setStoredCustomMapEngineOverride(true)).toBe(true);
    expect(storage.get("fab:enableCustomMapEngine")).toBe("true");
    expect(getRuntimeEnv({
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "false",
    }).featureFlags.customMapEngine).toBe(true);

    expect(clearStoredCustomMapEngineOverride()).toBe(true);
    expect(storage.has("fab:enableCustomMapEngine")).toBe(false);
  });
});
