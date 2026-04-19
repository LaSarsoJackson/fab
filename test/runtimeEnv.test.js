import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearStoredCustomMapEngineOverride,
  clearStoredRoutingProviderOverride,
  getRuntimeEnv,
  isAdminStudioEnabled,
  setStoredCustomMapEngineOverride,
  setStoredRoutingProviderOverride,
} from "../src/shared/runtime";

const originalWindow = globalThis.window;

const createWindowStub = ({
  search = "",
  storage = new Map(),
} = {}) => ({
  location: { search },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    removeItem: (key) => storage.delete(key),
    setItem: (key, value) => storage.set(key, String(value)),
  },
});

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
  test("defaults to development with hosted routing when the environment flag is absent", () => {
    expect(getRuntimeEnv({})).toEqual({
      appEnvironment: "development",
      isDev: true,
      featureFlags: {
        customMapEngine: false,
        fabRecordPresentation: true,
        fabTours: true,
        fieldPackets: true,
        routingProvider: "api",
      },
    });
  });

  test("resolves the local road provider from the dev routing env flag", () => {
    expect(getRuntimeEnv({
      REACT_APP_DEV_ROUTING_PROVIDER: "local",
    }).featureFlags.routingProvider).toBe("local");
  });

  test("keeps non-api routing overrides development-only", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "production",
      REACT_APP_DEV_ROUTING_PROVIDER: "valhalla",
      REACT_APP_ENABLE_CLIENT_SIDE_ROUTING: "true",
    })).toEqual({
      appEnvironment: "production",
      isDev: false,
      featureFlags: {
        customMapEngine: false,
        fabRecordPresentation: true,
        fabTours: true,
        fieldPackets: true,
        routingProvider: "api",
      },
    });
  });

  test("treats the admin studio as development-only", () => {
    expect(isAdminStudioEnabled({
      REACT_APP_ENVIRONMENT: "development",
    })).toBe(true);
    expect(isAdminStudioEnabled({
      REACT_APP_ENVIRONMENT: "production",
    })).toBe(false);
  });

  test("allows explicit feature flag overrides", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "development",
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "true",
      REACT_APP_ENABLE_FIELD_PACKETS: "true",
      REACT_APP_ENABLE_FAB_TOURS: "false",
      REACT_APP_ENABLE_FAB_RECORD_PRESENTATION: "false",
      REACT_APP_DEV_ROUTING_PROVIDER: "valhalla",
    })).toEqual({
      appEnvironment: "development",
      isDev: true,
      featureFlags: {
        customMapEngine: true,
        fabRecordPresentation: false,
        fabTours: false,
        fieldPackets: true,
        routingProvider: "valhalla",
      },
    });
  });

  test("lets a query-string override force the selected routing provider in development", () => {
    globalThis.window = createWindowStub({
      search: "?routing=valhalla&mapEngine=custom",
      storage: new Map([
        ["fab:routingProvider", "local"],
        ["fab:enableCustomMapEngine", "false"],
      ]),
    });

    const runtimeEnv = getRuntimeEnv({
      REACT_APP_DEV_ROUTING_PROVIDER: "api",
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "false",
    });

    expect(runtimeEnv.featureFlags.routingProvider).toBe("valhalla");
    expect(runtimeEnv.featureFlags.customMapEngine).toBe(true);
  });

  test("supports the legacy client-side routing query parameter", () => {
    globalThis.window = createWindowStub({
      search: "?clientSideRouting=true",
    });

    expect(getRuntimeEnv({
      REACT_APP_DEV_ROUTING_PROVIDER: "api",
    }).featureFlags.routingProvider).toBe("local");
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
      REACT_APP_DEV_ROUTING_PROVIDER: "local",
    })).toEqual({
      appEnvironment: "development",
      isDev: true,
      featureFlags: {
        customMapEngine: true,
        fabRecordPresentation: true,
        fabTours: true,
        fieldPackets: true,
        routingProvider: "local",
      },
    });
  });

  test("persists sticky runtime overrides when localStorage is available", () => {
    const storage = new Map();
    globalThis.window = createWindowStub({ storage });

    expect(setStoredCustomMapEngineOverride(true)).toBe(true);
    expect(storage.get("fab:enableCustomMapEngine")).toBe("true");

    expect(setStoredRoutingProviderOverride("valhalla")).toBe(true);
    expect(storage.get("fab:routingProvider")).toBe("valhalla");
    expect(storage.get("fab:enableClientSideRouting")).toBe("false");

    const runtimeEnv = getRuntimeEnv({
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "false",
      REACT_APP_DEV_ROUTING_PROVIDER: "api",
    });

    expect(runtimeEnv.featureFlags.customMapEngine).toBe(true);
    expect(runtimeEnv.featureFlags.routingProvider).toBe("valhalla");

    expect(clearStoredRoutingProviderOverride()).toBe(true);
    expect(clearStoredCustomMapEngineOverride()).toBe(true);
    expect(storage.has("fab:routingProvider")).toBe(false);
    expect(storage.has("fab:enableClientSideRouting")).toBe(false);
    expect(storage.has("fab:enableCustomMapEngine")).toBe(false);
  });
});
