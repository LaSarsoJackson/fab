import { describe, expect, test } from "bun:test";

import { APP_PROFILE } from "../src/features/fab/profile";
import {
  createRouteGeoJsonRenderKey,
  getMapMaxZoom,
  isLocationCandidateWithinBuffer,
  isRenderableBounds,
} from "../src/features/map/mapViewHelpers";

const BUFFER_BOUNDARY = APP_PROFILE.map.locationBufferBoundary;

// Derive an in-buffer point from the boundary polygon so the fixture tracks the
// shipped cemetery extent instead of a hardcoded coordinate that could drift.
const firstBoundaryRing = BUFFER_BOUNDARY.geometry.coordinates[0];
const ringAverage = firstBoundaryRing.reduce(
  (acc, [longitude, latitude]) => ({
    longitude: acc.longitude + longitude / firstBoundaryRing.length,
    latitude: acc.latitude + latitude / firstBoundaryRing.length,
  }),
  { longitude: 0, latitude: 0 }
);

describe("isLocationCandidateWithinBuffer", () => {
  test("returns false for a missing candidate", () => {
    expect(isLocationCandidateWithinBuffer(null)).toBe(false);
    expect(isLocationCandidateWithinBuffer(undefined)).toBe(false);
  });

  test("accepts a point inside the cemetery buffer", () => {
    expect(isLocationCandidateWithinBuffer(ringAverage)).toBe(true);
  });

  test("rejects a point far outside the cemetery buffer", () => {
    expect(isLocationCandidateWithinBuffer({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isLocationCandidateWithinBuffer({ latitude: 51.5, longitude: -0.12 })).toBe(false);
  });
});

describe("isRenderableBounds", () => {
  test("accepts a valid bounds expression", () => {
    expect(isRenderableBounds([[42.7, -73.7], [42.71, -73.69]])).toBe(true);
  });

  test("accepts a live bounds object that reports itself valid", () => {
    expect(isRenderableBounds({ isValid: () => true })).toBe(true);
  });

  test("rejects an invalid bounds object", () => {
    expect(isRenderableBounds({ isValid: () => false })).toBe(false);
  });

  test("rejects null and malformed bounds", () => {
    expect(isRenderableBounds(null)).toBe(false);
    expect(isRenderableBounds([[42.7]])).toBe(false);
    expect(isRenderableBounds({})).toBe(false);
  });
});

describe("getMapMaxZoom", () => {
  test("prefers a finite basemap maxZoom", () => {
    expect(getMapMaxZoom({ maxZoom: 22 }, 18)).toBe(22);
    expect(getMapMaxZoom({ maxZoom: 0 }, 18)).toBe(0);
  });

  test("falls back when the basemap omits a numeric maxZoom", () => {
    expect(getMapMaxZoom(null, 18)).toBe(18);
    expect(getMapMaxZoom({}, 19)).toBe(19);
    expect(getMapMaxZoom({ maxZoom: "20" }, 19)).toBe(19);
    expect(getMapMaxZoom({ maxZoom: Infinity }, 19)).toBe(19);
  });
});

describe("createRouteGeoJsonRenderKey", () => {
  test("returns a stable fallback when there are no coordinates", () => {
    expect(createRouteGeoJsonRenderKey(null)).toBe("active-route");
    expect(createRouteGeoJsonRenderKey({})).toBe("active-route");
    expect(createRouteGeoJsonRenderKey({ features: [] })).toBe("active-route");
    expect(createRouteGeoJsonRenderKey({
      features: [{ geometry: { coordinates: [] } }],
    })).toBe("active-route");
  });

  test("encodes coordinates to a fixed precision joined key", () => {
    expect(createRouteGeoJsonRenderKey({
      features: [{
        geometry: {
          coordinates: [
            [-73.123456789, 42.987654321],
            [-73.2, 42.8],
          ],
        },
      }],
    })).toBe("-73.1234568,42.9876543|-73.2000000,42.8000000");
  });

  test("changes the key when the path changes", () => {
    const build = (lng) => createRouteGeoJsonRenderKey({
      features: [{ geometry: { coordinates: [[lng, 42.8]] } }],
    });

    expect(build(-73.2)).not.toBe(build(-73.3));
  });
});
