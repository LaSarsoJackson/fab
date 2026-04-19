import { describe, expect, test } from "bun:test";

import { APP_PROFILE, getAppFeature } from "../src/config/appProfile";
import { DATA_MODULES } from "../src/admin/moduleRegistry";

const TOUR_FEATURE = getAppFeature("tours");
const TOUR_DEFINITIONS = TOUR_FEATURE?.definitions || [];
const TOUR_STYLES = TOUR_FEATURE?.styles || {};

describe("app profile", () => {
  test("exposes the active data modules through the shared profile", () => {
    expect(DATA_MODULES).toEqual(APP_PROFILE.dataModules);
    expect(APP_PROFILE.moduleIds.primaryRecord).toBe("burials");
    expect(DATA_MODULES.some((definition) => definition.id === APP_PROFILE.moduleIds.boundary)).toBe(true);
  });

  test("keeps boutique FAB tours behind an explicit feature flag boundary", () => {
    expect(TOUR_FEATURE.featureFlag).toBe("fabTours");
    expect(TOUR_DEFINITIONS.length).toBeGreaterThan(0);
    expect(
      DATA_MODULES
        .filter((definition) => definition.kind === "tour")
        .every((definition) => definition.featureFlag === "fabTours")
    ).toBe(true);
    expect(Object.keys(TOUR_STYLES)).toHaveLength(TOUR_DEFINITIONS.length);
  });

  test("keeps boutique record presentation behind an explicit feature flag boundary", () => {
    expect(APP_PROFILE.features.boutiqueRecordPresentation.featureFlag).toBe("fabRecordPresentation");
    expect(typeof APP_PROFILE.features.boutiqueRecordPresentation.resolveBiographyLink).toBe("function");
    expect(typeof APP_PROFILE.features.boutiqueRecordPresentation.resolveImageUrl).toBe("function");
  });

  test("exposes the iPhone app listing used by shared-link install prompts", () => {
    expect(APP_PROFILE.distribution.iosAppStoreUrl).toBe(
      "https://apps.apple.com/us/app/albany-grave-finder/id6746413050"
    );
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
