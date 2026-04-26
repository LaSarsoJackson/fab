import { describe, expect, test } from "bun:test";

import {
  DEVELOPMENT_ROUTING_PROVIDER,
  DEVELOPMENT_SURFACES,
  formatRuntimeToggleQueryOverride,
  getDevelopmentRoutingProvider,
  getMapEngineKind,
  isDevelopmentSurfaceEnabled,
  isFieldPacketsEnabled,
  RUNTIME_FEATURE_FLAGS,
} from "../src/shared/runtime/runtimeEnv";

describe("runtime boundaries", () => {
  test("keeps shipped product features separate from development surfaces", () => {
    expect(RUNTIME_FEATURE_FLAGS).toEqual({
      fieldPackets: expect.objectContaining({
        id: "fieldPackets",
        envKey: "REACT_APP_ENABLE_FIELD_PACKETS",
      }),
    });

    expect(DEVELOPMENT_SURFACES.customMapEngine).toMatchObject({
      id: "customMapEngine",
      envKey: "REACT_APP_ENABLE_CUSTOM_MAP_ENGINE",
      storageKey: "fab:dev:customMapEngine",
    });
    expect(formatRuntimeToggleQueryOverride(DEVELOPMENT_SURFACES.customMapEngine)).toBe(
      "mapEngine=custom|leaflet"
    );
  });

  test("exposes selectors with stable fallbacks", () => {
    expect(isFieldPacketsEnabled()).toBe(true);
    expect(isDevelopmentSurfaceEnabled(undefined, DEVELOPMENT_SURFACES.customMapEngine.id)).toBe(false);
    expect(getMapEngineKind()).toBe("leaflet");
    expect(getMapEngineKind({ customMapEngine: true })).toBe("custom");
    expect(getDevelopmentRoutingProvider({ routingProvider: DEVELOPMENT_ROUTING_PROVIDER.validValues[2] })).toBe(
      "valhalla"
    );
    expect(getDevelopmentRoutingProvider({ routingProvider: "invalid" })).toBe("api");
  });
});
