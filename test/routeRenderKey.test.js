import { describe, expect, test } from "bun:test";

import { createRouteGeoJsonRenderKey } from "../src/features/map/routeRenderKey";

const routeFromCoordinates = (coordinates) => ({
  features: [{ geometry: { coordinates } }],
});

describe("createRouteGeoJsonRenderKey", () => {
  test("returns the constant fallback when no GeoJSON is provided", () => {
    expect(createRouteGeoJsonRenderKey(undefined)).toBe("active-route");
    expect(createRouteGeoJsonRenderKey(null)).toBe("active-route");
  });

  test("returns the fallback when the route has no usable coordinates", () => {
    expect(createRouteGeoJsonRenderKey({})).toBe("active-route");
    expect(createRouteGeoJsonRenderKey(routeFromCoordinates([]))).toBe("active-route");
    expect(createRouteGeoJsonRenderKey(routeFromCoordinates("nope"))).toBe("active-route");
  });

  test("joins fixed-precision coordinate pairs into a stable key", () => {
    const key = createRouteGeoJsonRenderKey(
      routeFromCoordinates([
        [-73.7357281, 42.7056155],
        [-73.728166, 42.710807],
      ])
    );

    expect(key).toBe("-73.7357281,42.7056155|-73.7281660,42.7108070");
  });

  test("rounds coordinates to seven decimals so trivial jitter shares a key", () => {
    const noisy = createRouteGeoJsonRenderKey(
      routeFromCoordinates([[-73.73572811, 42.70561554]])
    );
    const rounded = createRouteGeoJsonRenderKey(
      routeFromCoordinates([[-73.73572812, 42.70561551]])
    );

    expect(noisy).toBe(rounded);
    expect(noisy).toBe("-73.7357281,42.7056155");
  });

  test("is stable across equivalent route objects", () => {
    const coordinates = [
      [-73.73, 42.70],
      [-73.74, 42.71],
    ];

    expect(createRouteGeoJsonRenderKey(routeFromCoordinates(coordinates))).toBe(
      createRouteGeoJsonRenderKey(routeFromCoordinates(coordinates))
    );
  });
});
