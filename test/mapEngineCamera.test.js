import { describe, expect, test } from "bun:test";

import {
  getFitBoundsCamera,
  normalizeBounds,
  panLatLngIntoView,
} from "../src/features/map/engine";

describe("map engine camera helpers", () => {
  test("normalizes south-west and north-east bounds ordering", () => {
    expect(normalizeBounds([
      [42.71, -73.72],
      [42.70, -73.74],
    ])).toEqual({
      south: 42.7,
      west: -73.74,
      north: 42.71,
      east: -73.72,
    });
  });

  test("fits bounds into a padded viewport", () => {
    const camera = getFitBoundsCamera(
      [
        [42.70, -73.74],
        [42.71, -73.72],
      ],
      {
        width: 1200,
        height: 800,
        minZoom: 13,
        maxZoom: 25,
        paddingTopLeft: [320, 24],
        paddingBottomRight: [24, 24],
      }
    );

    expect(camera).not.toBeNull();
    expect(camera.zoom).toBeGreaterThanOrEqual(13);
    expect(camera.zoom).toBeLessThanOrEqual(25);
    expect(camera.center.lat).toBeGreaterThan(42.70);
    expect(camera.center.lat).toBeLessThan(42.71);
    expect(camera.center.lng).toBeGreaterThan(-73.74);
    expect(camera.center.lng).toBeLessThan(-73.72);
  });

  test("pans a target point into the padded viewport without changing zoom", () => {
    const camera = panLatLngIntoView(
      {
        center: [42.70418, -73.73198],
        zoom: 14,
      },
      {
        lat: 42.709,
        lng: -73.68,
      },
      {
        width: 1200,
        height: 800,
        paddingTopLeft: [320, 24],
        paddingBottomRight: [24, 24],
      }
    );

    expect(camera.zoom).toBe(14);
    expect(camera.center.lat).not.toBe(42.70418);
    expect(camera.center.lng).not.toBe(-73.73198);
  });
});
