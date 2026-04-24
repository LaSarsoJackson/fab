import { describe, expect, test } from "bun:test";

import {
  formatRuntimeFlagQueryOverride,
  getMapEngineKind,
  getRuntimeRoutingProvider,
  isCustomMapEngineEnabled,
  isFieldPacketsEnabled,
  ROUTING_PROVIDER_RUNTIME,
  RUNTIME_FEATURE_FLAGS,
} from "../src/shared/runtime";

describe("runtime feature toggles", () => {
  test("keeps runtime feature metadata in one shared module", () => {
    expect(RUNTIME_FEATURE_FLAGS.customMapEngine).toMatchObject({
      id: "customMapEngine",
      envKey: "REACT_APP_ENABLE_CUSTOM_MAP_ENGINE",
      storageKey: "fab:enableCustomMapEngine",
    });
    expect(formatRuntimeFlagQueryOverride(RUNTIME_FEATURE_FLAGS.customMapEngine)).toBe(
      "mapEngine=custom|leaflet"
    );
  });

  test("exposes selectors with stable fallbacks", () => {
    expect(isFieldPacketsEnabled()).toBe(true);
    expect(isCustomMapEngineEnabled()).toBe(false);
    expect(getMapEngineKind()).toBe("leaflet");
    expect(getMapEngineKind({ customMapEngine: true })).toBe("custom");
    expect(getRuntimeRoutingProvider({ routingProvider: ROUTING_PROVIDER_RUNTIME.validValues[2] })).toBe(
      "valhalla"
    );
    expect(getRuntimeRoutingProvider({ routingProvider: "invalid" })).toBe("api");
  });
});
