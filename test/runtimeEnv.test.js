import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  clearStoredDevelopmentRoutingProvider,
  clearStoredDevelopmentSurfaceOverride,
  DEVELOPMENT_SURFACES,
  getRuntimeEnv,
  isAdminStudioEnabled,
  setStoredDevelopmentRoutingProvider,
  setStoredDevelopmentSurfaceOverride,
} from "../src/shared/runtime/runtimeEnv";

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
        fieldPackets: true,
      },
      devSurfaces: {
        adminStudio: true,
        customMapEngine: false,
        pmtilesExperiment: false,
        siteTwinDebug: true,
        routingProvider: "api",
      },
    });
  });

  test("resolves the local road provider from the dev routing env flag", () => {
    expect(getRuntimeEnv({
      REACT_APP_DEV_ROUTING_PROVIDER: "local",
    }).devSurfaces.routingProvider).toBe("local");
  });

  test("keeps non-api routing overrides development-only", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "production",
      REACT_APP_DEV_ROUTING_PROVIDER: "valhalla",
    })).toEqual({
      appEnvironment: "production",
      isDev: false,
      featureFlags: {
        fieldPackets: true,
      },
      devSurfaces: {
        adminStudio: false,
        customMapEngine: false,
        pmtilesExperiment: false,
        siteTwinDebug: false,
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

  test("allows explicit runtime feature and development-surface overrides", () => {
    expect(getRuntimeEnv({
      REACT_APP_ENVIRONMENT: "development",
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "true",
      REACT_APP_ENABLE_FIELD_PACKETS: "true",
      REACT_APP_DEV_ROUTING_PROVIDER: "valhalla",
    })).toEqual({
      appEnvironment: "development",
      isDev: true,
      featureFlags: {
        fieldPackets: true,
      },
      devSurfaces: {
        adminStudio: true,
        customMapEngine: true,
        pmtilesExperiment: false,
        siteTwinDebug: true,
        routingProvider: "valhalla",
      },
    });
  });

  test("lets a query-string override force the selected routing provider in development", () => {
    globalThis.window = createWindowStub({
      search: "?routing=valhalla&mapEngine=custom",
      storage: new Map([
        ["fab:dev:routingProvider", "local"],
        ["fab:dev:customMapEngine", "false"],
      ]),
    });

    const runtimeEnv = getRuntimeEnv({
      REACT_APP_DEV_ROUTING_PROVIDER: "api",
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "false",
    });

    expect(runtimeEnv.devSurfaces.routingProvider).toBe("valhalla");
    expect(runtimeEnv.devSurfaces.customMapEngine).toBe(true);
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
        fieldPackets: true,
      },
      devSurfaces: {
        adminStudio: true,
        customMapEngine: true,
        pmtilesExperiment: false,
        siteTwinDebug: true,
        routingProvider: "local",
      },
    });
  });

  test("persists sticky runtime overrides when localStorage is available", () => {
    const storage = new Map();
    globalThis.window = createWindowStub({ storage });

    expect(setStoredDevelopmentSurfaceOverride(DEVELOPMENT_SURFACES.customMapEngine.id, true)).toBe(true);
    expect(storage.get("fab:dev:customMapEngine")).toBe("true");

    expect(setStoredDevelopmentSurfaceOverride(DEVELOPMENT_SURFACES.pmtilesExperiment.id, true)).toBe(true);
    expect(storage.get("fab:dev:pmtilesExperiment")).toBe("true");

    expect(setStoredDevelopmentRoutingProvider("valhalla")).toBe(true);
    expect(storage.get("fab:dev:routingProvider")).toBe("valhalla");

    const runtimeEnv = getRuntimeEnv({
      REACT_APP_ENABLE_CUSTOM_MAP_ENGINE: "false",
      REACT_APP_DEV_ROUTING_PROVIDER: "api",
    });

    expect(runtimeEnv.devSurfaces.customMapEngine).toBe(true);
    expect(runtimeEnv.devSurfaces.pmtilesExperiment).toBe(true);
    expect(runtimeEnv.devSurfaces.routingProvider).toBe("valhalla");

    expect(clearStoredDevelopmentRoutingProvider()).toBe(true);
    expect(clearStoredDevelopmentSurfaceOverride(DEVELOPMENT_SURFACES.customMapEngine.id)).toBe(true);
    expect(clearStoredDevelopmentSurfaceOverride(DEVELOPMENT_SURFACES.pmtilesExperiment.id)).toBe(true);
    expect(storage.has("fab:dev:routingProvider")).toBe(false);
    expect(storage.has("fab:dev:customMapEngine")).toBe(false);
    expect(storage.has("fab:dev:pmtilesExperiment")).toBe(false);
  });
});
