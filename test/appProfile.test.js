import { describe, expect, test } from "bun:test";

import { APP_DATA_MODULES, APP_PROFILE, APP_TOUR_DEFINITIONS, APP_TOUR_STYLES } from "../src/config/appProfile";
import { DATA_MODULES } from "../src/admin/moduleRegistry";

describe("app profile", () => {
  test("exposes the active data modules through the shared profile", () => {
    expect(DATA_MODULES).toEqual(APP_DATA_MODULES);
    expect(APP_PROFILE.moduleIds.primaryRecord).toBe("burials");
    expect(APP_DATA_MODULES.some((definition) => definition.id === APP_PROFILE.moduleIds.boundary)).toBe(true);
  });

  test("keeps boutique FAB tours behind an explicit feature flag boundary", () => {
    expect(APP_PROFILE.features.tours.featureFlag).toBe("fabTours");
    expect(APP_TOUR_DEFINITIONS.length).toBeGreaterThan(0);
    expect(
      APP_DATA_MODULES
        .filter((definition) => definition.kind === "tour")
        .every((definition) => definition.featureFlag === "fabTours")
    ).toBe(true);
    expect(Object.keys(APP_TOUR_STYLES)).toHaveLength(APP_TOUR_DEFINITIONS.length);
  });

  test("keeps boutique record presentation behind an explicit feature flag boundary", () => {
    expect(APP_PROFILE.features.boutiqueRecordPresentation.featureFlag).toBe("fabRecordPresentation");
    expect(typeof APP_PROFILE.features.boutiqueRecordPresentation.resolveBiographyLink).toBe("function");
    expect(typeof APP_PROFILE.features.boutiqueRecordPresentation.resolveImageUrl).toBe("function");
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
});
