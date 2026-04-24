import { describe, expect, test } from "bun:test";

import { APP_PROFILE } from "../src/features/fab/profile";
import { DATA_MODULES } from "../src/admin/moduleRegistry";

const TOUR_FEATURE = APP_PROFILE.features?.tours || null;
const TOUR_DEFINITIONS = TOUR_FEATURE?.definitions || [];
const TOUR_STYLES = TOUR_FEATURE?.styles || {};

describe("app profile", () => {
  test("exposes the active data modules through the shared profile", () => {
    expect(DATA_MODULES).toEqual(APP_PROFILE.dataModules);
    expect(APP_PROFILE.moduleIds.primaryRecord).toBe("burials");
    expect(DATA_MODULES.some((definition) => definition.id === APP_PROFILE.moduleIds.boundary)).toBe(true);
  });

  test("keeps tour definitions and styles in the app profile instead of a second registry layer", () => {
    expect(TOUR_DEFINITIONS.length).toBeGreaterThan(0);
    expect(DATA_MODULES.filter((definition) => definition.kind === "tour")).toHaveLength(TOUR_DEFINITIONS.length);
    expect(Object.keys(TOUR_STYLES)).toHaveLength(TOUR_DEFINITIONS.length);
  });

  test("exposes FAB record presentation directly from the app profile", () => {
    expect(typeof APP_PROFILE.features.recordPresentation.resolveBiographyLink).toBe("function");
    expect(typeof APP_PROFILE.features.recordPresentation.resolveImageUrl).toBe("function");
  });

  test("exposes the iPhone app listing used by shared-link install prompts", () => {
    expect(APP_PROFILE.distribution.iosAppStoreUrl).toBe(
      "https://apps.apple.com/us/app/albany-grave-finder/id6746413050"
    );
  });

  test("keeps FAB-owned browser storage keys in the profile contract", () => {
    expect(APP_PROFILE.runtimeStorageKeys).toEqual({
      pmtilesExperiment: "fab:enablePmtilesExperiment",
      siteTwinDebug: "fab:siteTwinDebugState",
    });
  });

  test("documents the map source and optimization formats needed for invisible GeoParquet migration", () => {
    expect(APP_PROFILE.map.storageStrategy.preferredBuildSourceFormat).toBe("geoparquet");
    expect(APP_PROFILE.map.overlaySources.some((source) => source.type === "pmtiles-vector")).toBe(true);

    const geoParquetArtifact = APP_PROFILE.map.optimizationArtifacts.find(
      (artifact) => artifact.format === "geoparquet"
    );

    expect(geoParquetArtifact).toBeTruthy();
    expect(geoParquetArtifact.filePath).toBe("src/data/Geo_Burials.parquet");
    expect(geoParquetArtifact.buildCommand).toBe("bun run build:geoparquet");
  });

  test("keeps large map geometry behind async data modules instead of embedding it in the profile shell", () => {
    expect(APP_PROFILE.map.boundaryData).toBeUndefined();
    expect(APP_PROFILE.map.roadsData).toBeUndefined();
    expect(APP_PROFILE.map.sectionsData).toBeUndefined();

    expect(
      DATA_MODULES
        .filter((definition) => ["boundary", "roads", "sections"].includes(definition.id))
        .every((definition) => typeof definition.load === "function")
    ).toBe(true);
  });
});
