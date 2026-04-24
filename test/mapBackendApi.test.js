import { describe, expect, test } from "bun:test";

import { APP_PROFILE } from "../src/features/fab/profile";
import {
  getMapBackendDescriptor,
  getMapStorageStrategy,
  getOptimizationArtifactsByRole,
  getPreferredBuildSourceArtifact,
  MAP_BACKEND_API_VERSION,
} from "../src/features/map/engine";

describe("map backend api", () => {
  test("publishes the storage strategy that keeps GeoParquet invisible to runtime callers", () => {
    expect(getMapStorageStrategy(APP_PROFILE)).toEqual({
      sourceOfTruthFormat: "geojson",
      preferredBuildSourceFormat: "geoparquet",
      preferredDeliveryFormat: "pmtiles-vector",
      preferredSearchFormat: "json",
      migrationGoal: "Treat GeoParquet as a build-time 1:1 replacement for GeoJSON while preserving the existing runtime API and generated artifacts.",
    });
  });

  test("prefers the GeoParquet artifact as the build-time source when it is declared", () => {
    expect(getPreferredBuildSourceArtifact(APP_PROFILE, {
      sourceModuleId: APP_PROFILE.moduleIds.primaryRecord,
    })).toMatchObject({
      id: "burials-source-geoparquet",
      format: "geoparquet",
      filePath: "src/data/Geo_Burials.parquet",
    });
  });

  test("exposes backend descriptor formats and artifact roles for engine documentation", () => {
    expect(getMapBackendDescriptor(APP_PROFILE)).toEqual({
      apiVersion: MAP_BACKEND_API_VERSION,
      storageStrategy: getMapStorageStrategy(APP_PROFILE),
      basemapTypes: ["raster-xyz", "pmtiles-vector"],
      overlayFormats: ["geojson", "pmtiles-vector", "json"],
      artifactFormats: ["geojson", "geoparquet", "json", "pmtiles-vector"],
      preferredBuildArtifact: getPreferredBuildSourceArtifact(APP_PROFILE, {
        sourceModuleId: APP_PROFILE.moduleIds.primaryRecord,
      }),
    });

    expect(getOptimizationArtifactsByRole(APP_PROFILE, "columnar-canonical")).toHaveLength(1);
  });
});
