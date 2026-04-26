import { describe, expect, test } from "bun:test";

import {
  EMPTY_MAP_FEATURE_COLLECTION,
  getEmptyCoreMapData,
  loadCoreMapData,
  normalizeMapFeatureCollection,
} from "../src/features/map/coreMapData";

describe("core map data helpers", () => {
  test("returns stable empty feature-collection defaults for map overlays", () => {
    const emptyState = getEmptyCoreMapData();

    expect(emptyState).toEqual({
      boundaryData: EMPTY_MAP_FEATURE_COLLECTION,
      roadsData: EMPTY_MAP_FEATURE_COLLECTION,
      sectionsData: EMPTY_MAP_FEATURE_COLLECTION,
    });
  });

  test("normalizes missing features into an empty feature collection", () => {
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
