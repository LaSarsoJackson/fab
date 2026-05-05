import { describe, expect, test } from "bun:test";

import {
  APP_PROFILE,
  DATA_MODULES,
  EMPTY_MAP_FEATURE_COLLECTION,
  getEmptyCoreMapData,
  loadCoreMapData,
  normalizeMapFeatureCollection,
} from "../src/features/fab/profile";

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

  test("documents the map source and optimization formats needed for invisible GeoParquet migration", () => {
    expect(APP_PROFILE.map.storageStrategy.preferredBuildSourceFormat).toBe("geoparquet");
    expect(APP_PROFILE.map.storageStrategy.preferredDeliveryFormat).toBe("json");
    expect(APP_PROFILE.map.overlaySources.some((source) => source.type === "pmtiles-vector")).toBe(false);
    expect(APP_PROFILE.map.optimizationArtifacts.some((artifact) => artifact.id.startsWith("site-twin"))).toBe(false);

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

  test("returns stable empty feature-collection defaults for map overlays", () => {
    expect(getEmptyCoreMapData()).toEqual({
      boundaryData: EMPTY_MAP_FEATURE_COLLECTION,
      roadsData: EMPTY_MAP_FEATURE_COLLECTION,
      sectionsData: EMPTY_MAP_FEATURE_COLLECTION,
    });
  });

  test("normalizes missing map features into an empty feature collection", () => {
    expect(normalizeMapFeatureCollection({ name: "roads" })).toEqual({
      type: "FeatureCollection",
      name: "roads",
      features: [],
    });
  });

  test("loads boundary, roads, and sections through the profile data-module contract", async () => {
    const resolvedModuleIds = [];
    const loadedModuleIds = [];
    const profile = {
      moduleIds: {
        boundary: "boundary",
        roads: "roads",
        sections: "sections",
      },
    };
    const resolveModule = (moduleId) => {
      resolvedModuleIds.push(moduleId);
      return { id: moduleId };
    };
    const loadModule = async (moduleDefinition) => {
      loadedModuleIds.push(moduleDefinition.id);
      return {
        type: "FeatureCollection",
        name: moduleDefinition.id,
        features: [{ type: "Feature", properties: { id: moduleDefinition.id } }],
      };
    };

    expect(await loadCoreMapData(profile, { resolveModule, loadModule })).toEqual({
      boundaryData: {
        type: "FeatureCollection",
        name: "boundary",
        features: [{ type: "Feature", properties: { id: "boundary" } }],
      },
      roadsData: {
        type: "FeatureCollection",
        name: "roads",
        features: [{ type: "Feature", properties: { id: "roads" } }],
      },
      sectionsData: {
        type: "FeatureCollection",
        name: "sections",
        features: [{ type: "Feature", properties: { id: "sections" } }],
      },
    });
    expect(resolvedModuleIds).toEqual(["boundary", "roads", "sections"]);
    expect(loadedModuleIds).toEqual(["boundary", "roads", "sections"]);
  });

  test("throws when the active profile is missing a required map data module", async () => {
    const profile = {
      moduleIds: {
        boundary: "boundary",
        roads: "roads",
        sections: "sections",
      },
    };

    await expect(loadCoreMapData(profile, {
      resolveModule: (moduleId) => (moduleId === "roads" ? null : { id: moduleId }),
      loadModule: async (moduleDefinition) => moduleDefinition,
    })).rejects.toThrow("Missing required map data module: roads");
  });
});
