import { describe, expect, test } from "bun:test";

import {
  projectLatLngToWorldPoint,
  quantizeZoom,
  selectDecollidedMarkers,
} from "../src/features/map/mapMarkerDeclutter";

describe("mapMarkerDeclutter", () => {
  describe("projectLatLngToWorldPoint", () => {
    test("lat 0, lng 0, zoom 0 maps to the center of a 256x256 tile", () => {
      const result = projectLatLngToWorldPoint({ lat: 0, lng: 0, zoom: 0 });
      expect(result.x).toBeCloseTo(128, 1);
      expect(result.y).toBeCloseTo(128, 1);
    });

    test("lng 90 at zoom 0 gives x 192", () => {
      const result = projectLatLngToWorldPoint({ lat: 0, lng: 90, zoom: 0 });
      expect(result.x).toBeCloseTo(192, 1);
    });

    test("same point at zoom 1 has exactly 2× the coordinates of zoom 0", () => {
      const zoom0 = projectLatLngToWorldPoint({ lat: 42.7, lng: -73.73, zoom: 0 });
      const zoom1 = projectLatLngToWorldPoint({ lat: 42.7, lng: -73.73, zoom: 1 });
      expect(zoom1.x).toBeCloseTo(zoom0.x * 2, 1);
      expect(zoom1.y).toBeCloseTo(zoom0.y * 2, 1);
    });

    test("higher latitude gives smaller y than lower latitude", () => {
      const lower = projectLatLngToWorldPoint({ lat: 20, lng: -73.73, zoom: 10 });
      const higher = projectLatLngToWorldPoint({ lat: 50, lng: -73.73, zoom: 10 });
      expect(higher.y).toBeLessThan(lower.y);
    });
  });

  describe("quantizeZoom", () => {
    test("14.3 with step 0.5 rounds to 14.5", () => {
      expect(quantizeZoom(14.3, 0.5)).toBeCloseTo(14.5, 1);
    });

    test("14.24 with step 0.5 rounds to 14.0", () => {
      expect(quantizeZoom(14.24, 0.5)).toBeCloseTo(14.0, 1);
    });

    test("14.3 with step 1 rounds to 14", () => {
      expect(quantizeZoom(14.3, 1)).toBeCloseTo(14, 1);
    });

    test("non-finite zoom returns 0", () => {
      expect(quantizeZoom(NaN, 0.5)).toBe(0);
      expect(quantizeZoom(Infinity, 0.5)).toBe(0);
      expect(quantizeZoom(-Infinity, 0.5)).toBe(0);
    });

    test("non-finite step defaults to 0.5", () => {
      expect(quantizeZoom(14.3, NaN)).toBeCloseTo(14.5, 1);
    });

    test("non-positive step defaults to 0.5", () => {
      expect(quantizeZoom(14.3, 0)).toBeCloseTo(14.5, 1);
      expect(quantizeZoom(14.3, -1)).toBeCloseTo(14.5, 1);
    });
  });

  describe("selectDecollidedMarkers", () => {
    test("empty input returns empty array", () => {
      expect(selectDecollidedMarkers([])).toEqual([]);
    });

    test("null or non-array input returns empty array", () => {
      expect(selectDecollidedMarkers(null)).toEqual([]);
      expect(selectDecollidedMarkers()).toEqual([]);
      expect(selectDecollidedMarkers("not an array")).toEqual([]);
    });

    test("markers missing finite lat/lng are dropped even when zoom is non-finite", () => {
      const markers = [
        { lat: 42.7, lng: -73.73, count: 1 },
        { lat: NaN, lng: -73.73, count: 2 },
        { lat: 42.7, lng: NaN, count: 3 },
        { lat: 42.8, lng: -73.72, count: 4 },
      ];
      const result = selectDecollidedMarkers(markers, { zoom: NaN });
      expect(result).toEqual([
        { lat: 42.7, lng: -73.73, count: 1 },
        { lat: 42.8, lng: -73.72, count: 4 },
      ]);
    });

    test("two markers at the same coordinates: only the one with higher count is returned", () => {
      const markers = [
        { lat: 42.7, lng: -73.73, count: 10 },
        { lat: 42.7, lng: -73.73, count: 20 },
      ];
      const result = selectDecollidedMarkers(markers, { zoom: 14 });
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(20);
    });

    test("equal priority tie: the one earlier in the input array wins", () => {
      const markers = [
        { id: "first", lat: 42.7, lng: -73.73, count: 10 },
        { id: "second", lat: 42.7, lng: -73.73, count: 10 },
      ];
      const result = selectDecollidedMarkers(markers, { zoom: 14 });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("first");
    });

    test("two markers far apart at zoom 14: both returned in original input order", () => {
      const markers = [
        { id: "first", lat: 42.70, lng: -73.73, count: 5 },
        { id: "second", lat: 42.75, lng: -73.60, count: 50 },
      ];
      const result = selectDecollidedMarkers(markers, { zoom: 14 });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("first");
      expect(result[1].id).toBe("second");
    });

    test("zoom reveals more: markers collide at zoom 13 but not at zoom 16", () => {
      // Two markers at lat 42.7, lng differs by ~0.003 degrees
      // At Web Mercator with tileSize 256:
      // At zoom 13: scale = 256 * 2^13 = 2097152 pixels
      // lng difference of 0.003 ≈ (0.003/360) * 2097152 ≈ 17.5 pixels
      // With default extents (18+3=21 px on each side), they collide
      // At zoom 16: scale = 256 * 2^16 = 16777216 pixels
      // Same lng difference ≈ 140 pixels apart, no collision
      const markers = [
        { id: "first", lat: 42.7, lng: -73.73, count: 10 },
        { id: "second", lat: 42.7, lng: -73.727, count: 20 },
      ];

      // Verify at zoom 13 they collide (only higher priority survives)
      const resultZoom13 = selectDecollidedMarkers(markers, { zoom: 13 });
      expect(resultZoom13).toHaveLength(1);
      expect(resultZoom13[0].id).toBe("second");

      // Verify at zoom 16 they both survive
      const resultZoom16 = selectDecollidedMarkers(markers, { zoom: 16 });
      expect(resultZoom16).toHaveLength(2);
    });

    test("getHalfExtentsPx is respected: collision with large extents, pass with small", () => {
      const markers = [
        { id: "first", lat: 42.7, lng: -73.73, count: 10 },
        { id: "second", lat: 42.7, lng: -73.727, count: 20 },
      ];

      // With large extents, they collide at zoom 14
      const resultLarge = selectDecollidedMarkers(markers, {
        zoom: 14,
        getHalfExtentsPx: () => ({ halfWidth: 18, halfHeight: 20 }),
        paddingPx: 3,
      });
      expect(resultLarge).toHaveLength(1);

      // With tiny extents and no padding, they should both survive
      const resultSmall = selectDecollidedMarkers(markers, {
        zoom: 14,
        getHalfExtentsPx: () => ({ halfWidth: 1, halfHeight: 1 }),
        paddingPx: 0,
      });
      expect(resultSmall).toHaveLength(2);
    });

    test("non-finite zoom returns valid markers unfiltered", () => {
      const markers = [
        { lat: 42.7, lng: -73.73, count: 10 },
        { lat: 42.75, lng: -73.60, count: 20 },
      ];
      const result = selectDecollidedMarkers(markers, { zoom: NaN });
      expect(result).toEqual(markers);
    });
  });
});
