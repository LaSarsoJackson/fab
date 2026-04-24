import { describe, expect, test } from "bun:test";

import { APP_PROFILE } from "../src/features/fab/profile";
import { formatRuntimeFlagQueryOverride, RUNTIME_FEATURE_FLAGS } from "../src/shared/runtime";
import {
  getMapEngineManifest,
  MAP_BACKEND_API_VERSION,
  MAP_ENGINE_MANIFEST_VERSION,
  MAP_RUNTIME_API_VERSION,
} from "../src/features/map/engine";

describe("map engine manifest", () => {
  test("describes the custom engine in application terms instead of Leaflet terms", () => {
    const customMapEngineFlag = RUNTIME_FEATURE_FLAGS.customMapEngine;

    expect(getMapEngineManifest(APP_PROFILE)).toMatchObject({
      manifestVersion: MAP_ENGINE_MANIFEST_VERSION,
      engineId: "fab-custom-map-engine",
      engineName: "FAB Custom Map Engine",
      runtimeApiVersion: MAP_RUNTIME_API_VERSION,
      backendApiVersion: MAP_BACKEND_API_VERSION,
      runtimeKinds: ["custom", "leaflet-adapter"],
      layerKinds: ["geojson", "image", "points"],
      runtimeSelection: {
        featureFlag: customMapEngineFlag.id,
        envVar: customMapEngineFlag.envKey,
        queryOverride: formatRuntimeFlagQueryOverride(customMapEngineFlag),
        stickyStorageKey: customMapEngineFlag.storageKey,
        defaultRuntimeKind: "leaflet-adapter",
      },
      basemapRegistry: {
        defaultBasemapId: "imagery",
        preferredDeliveryFormat: "pmtiles-vector",
      },
      operationalCommands: {
        describe: "bun run describe:map-engine",
        buildData: "bun run build:data",
        buildGeoParquet: "bun run build:geoparquet",
        validateGeoParquet: "bun run validate:geoparquet",
      },
    });
  });

  test("captures shipped flows, adapter-backed boundaries, and deferred work for FAB", () => {
    const manifest = getMapEngineManifest(APP_PROFILE);

    expect(manifest.appNeeds).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "burial-search-popup",
        status: "shipped",
        runtimeKinds: ["custom", "leaflet-adapter"],
      }),
      expect.objectContaining({
        id: "section-browse",
        status: "shipped",
        runtimeKinds: ["custom", "leaflet-adapter"],
      }),
      expect.objectContaining({
        id: "deep-links",
        status: "shipped",
        runtimeKinds: ["custom", "leaflet-adapter"],
      }),
      expect.objectContaining({
        id: "on-map-routing",
        status: "adapter-backed",
        runtimeKinds: ["custom", "leaflet-adapter"],
      }),
      expect.objectContaining({
        id: "live-geolocation",
        status: "adapter-backed",
        runtimeKinds: ["custom", "leaflet-adapter"],
      }),
      expect.objectContaining({
        id: "authoring-editing",
        status: "deferred",
      }),
    ]));

    expect(manifest.dataBackend.preferredBuildArtifact).toMatchObject({
      id: "burials-source-geoparquet",
      format: "geoparquet",
    });
  });
});
