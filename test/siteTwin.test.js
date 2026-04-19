import { describe, expect, test } from "bun:test";

import {
  DEFAULT_SITE_TWIN_DEBUG_STATE,
  EMPTY_SITE_TWIN_MANIFEST,
  buildSiteTwinPointEntries,
  filterSiteTwinFeatureCollection,
  isSiteTwinReady,
  normalizeSiteTwinDebugState,
  normalizeSiteTwinFeatureCollection,
  normalizeSiteTwinManifest,
  summarizeSiteTwinFeatureCollection,
} from "../src/features/map/siteTwin";

describe("site twin helpers", () => {
  test("normalizes the static manifest into the runtime shape", () => {
    const manifest = normalizeSiteTwinManifest({
      status: "ready",
      terrainImage: {
        url: "/data/site_twin/terrain_surface.png",
        bounds: [
          ["42.69", "-73.74"],
          ["42.71", "-73.72"],
        ],
      },
      graveCandidates: {
        url: "/data/site_twin/grave_candidates.geojson",
        count: 14541,
      },
    });

    expect(manifest).toEqual({
      ...EMPTY_SITE_TWIN_MANIFEST,
      status: "ready",
      terrainImage: {
        url: "/data/site_twin/terrain_surface.png",
        bounds: [
          [42.69, -73.74],
          [42.71, -73.72],
        ],
        opacity: 0.84,
      },
      graveCandidates: {
        url: "/data/site_twin/grave_candidates.geojson",
        count: 14541,
      },
    });
    expect(isSiteTwinReady(manifest)).toBe(true);
  });

  test("converts candidate feature collections into runtime point entries", () => {
    const featureCollection = normalizeSiteTwinFeatureCollection({
      type: "FeatureCollection",
      features: [
        {
          id: "grave-candidate-1",
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-73.73198, 42.70418],
          },
          properties: {
            arcGeoId: "ARC-123",
            burialCount: 5,
          },
        },
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [],
          },
          properties: {},
        },
      ],
    });

    expect(buildSiteTwinPointEntries(featureCollection)).toEqual([
      {
        id: "grave-candidate-1",
        coordinates: [-73.73198, 42.70418],
        record: {
          arcGeoId: "ARC-123",
          burialCount: 5,
          featureId: "grave-candidate-1",
        },
      },
    ]);
  });

  test("normalizes and clamps debug state controls", () => {
    expect(normalizeSiteTwinDebugState({
      showSurface: false,
      surfaceOpacity: 3,
      monumentHeightScale: 0.2,
      minConfidence: -1,
      minHeightMeters: 9,
      knownHeadstonesOnly: 1,
    })).toEqual({
      ...DEFAULT_SITE_TWIN_DEBUG_STATE,
      showSurface: false,
      showMonuments: true,
      surfaceOpacity: 1,
      monumentHeightScale: 0.5,
      minConfidence: 0,
      minHeightMeters: 2,
      knownHeadstonesOnly: true,
    });
  });

  test("filters and summarizes grave candidates for the debug inspector", () => {
    const featureCollection = normalizeSiteTwinFeatureCollection({
      type: "FeatureCollection",
      features: [
        {
          id: "grave-1",
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-73.73198, 42.70418],
          },
          properties: {
            knownHeadstone: false,
            confidence: 0.42,
            heightMeters: 0.28,
          },
        },
        {
          id: "grave-2",
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-73.73148, 42.70448],
          },
          properties: {
            knownHeadstone: true,
            confidence: 0.91,
            heightMeters: 0.88,
          },
        },
      ],
    });

    const filtered = filterSiteTwinFeatureCollection(featureCollection, {
      knownHeadstonesOnly: true,
      minConfidence: 0.7,
      minHeightMeters: 0.5,
    });

    expect(filtered.features.map((feature) => feature.id)).toEqual(["grave-2"]);
    expect(summarizeSiteTwinFeatureCollection(featureCollection)).toEqual({
      count: 2,
      knownHeadstoneCount: 1,
      meanConfidence: 0.665,
      heightP95Meters: 0.85,
    });
  });
});
