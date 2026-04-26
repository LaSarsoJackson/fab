import { describe, expect, test } from "bun:test";

import {
  buildRoadRoutingGraph,
  buildOfflineWalkingRouteUrl,
  buildWalkingRouteUrl,
  calculateWalkingRoute,
  fetchWalkingRoute,
  getRoutingErrorMessage,
  snapPointToRoadNetwork,
} from "../src/features/map/mapRouting";

const SIMPLE_ROADS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "MultiLineString",
        coordinates: [
          [
            [-73.73198, 42.70418],
            [-73.72811, 42.7061],
            [-73.72154, 42.70911],
          ],
        ],
      },
      properties: {},
    },
  ],
};

const FRAGMENTED_ROADS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.732, 42.704],
          [-73.731, 42.705],
        ],
      },
      properties: {},
    },
    {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.730999995, 42.705000004],
          [-73.73, 42.706],
        ],
      },
      properties: {},
    },
  ],
};

describe("map routing helpers", () => {
  test("builds a hosted Valhalla walking-route request with an OSRM-compatible payload", () => {
    const requestUrl = new URL(buildWalkingRouteUrl({
      from: [42.70418, -73.73198],
      to: [42.70911, -73.72154],
    }));
    const payload = JSON.parse(requestUrl.searchParams.get("json"));

    expect(requestUrl.origin).toBe("https://valhalla1.openstreetmap.de");
    expect(requestUrl.pathname).toBe("/route");
    expect(payload).toEqual({
      locations: [
        { lat: 42.70418, lon: -73.73198 },
        { lat: 42.70911, lon: -73.72154 },
      ],
      costing: "pedestrian",
      directions_type: "none",
      format: "osrm",
      shape_format: "geojson",
      units: "kilometers",
    });
  });

  test("uses the configured hosted Valhalla API root for route fetches", async () => {
    const originalApiUrl = process.env.REACT_APP_VALHALLA_API_URL;
    process.env.REACT_APP_VALHALLA_API_URL = "https://routing.example.test/base";
    let requestedUrl = "";

    try {
      await fetchWalkingRoute({
        from: [42.70418, -73.73198],
        to: [42.70911, -73.72154],
        fetchImpl: async (url) => {
          requestedUrl = String(url);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              code: "Ok",
              routes: [
                {
                  distance: 25,
                  duration: 18,
                  geometry: {
                    type: "LineString",
                    coordinates: [
                      [-73.73198, 42.70418],
                      [-73.72154, 42.70911],
                    ],
                  },
                },
              ],
            }),
          };
        },
      });
    } finally {
      if (originalApiUrl === undefined) {
        delete process.env.REACT_APP_VALHALLA_API_URL;
      } else {
        process.env.REACT_APP_VALHALLA_API_URL = originalApiUrl;
      }
    }

    const requestUrl = new URL(requestedUrl);
    expect(requestUrl.origin).toBe("https://routing.example.test");
    expect(requestUrl.pathname).toBe("/base/route");
  });

  test("builds a relative offline Valhalla request through the dev proxy", () => {
    const requestUrl = new URL(buildOfflineWalkingRouteUrl({
      from: [42.70418, -73.73198],
      to: [42.70911, -73.72154],
    }), "http://localhost");

    expect(requestUrl.pathname).toBe("/__valhalla/route");
    expect(JSON.parse(requestUrl.searchParams.get("json"))).toMatchObject({
      costing: "pedestrian",
    });
  });

  test("normalizes a hosted Valhalla route into shared geojson and bounds", async () => {
    const route = await fetchWalkingRoute({
      from: [42.70418, -73.73198],
      to: [42.70911, -73.72154],
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          code: "Ok",
          routes: [
            {
              distance: 412.7,
              duration: 301,
              geometry: {
                type: "LineString",
                coordinates: [
                  [-73.73198, 42.70418],
                  [-73.72811, 42.7061],
                  [-73.72154, 42.70911],
                ],
              },
            },
          ],
        }),
      }),
    });

    expect(route.provider).toBe("api");
    expect(route.distance).toBe(412.7);
    expect(route.time).toBe(301000);
    expect(route.geojson).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            id: "active-route",
            kind: "walking-route",
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-73.73198, 42.70418],
              [-73.72811, 42.7061],
              [-73.72154, 42.70911],
            ],
          },
        },
      ],
    });
    expect(route.bounds).toEqual([
      [42.70418, -73.73198],
      [42.70911, -73.72154],
    ]);
  });

  test("routes along the bundled road graph for the local provider", async () => {
    const roadGraph = buildRoadRoutingGraph(SIMPLE_ROADS);
    const route = await calculateWalkingRoute({
      provider: "local",
      roadGraph,
      from: [42.7042, -73.73195],
      to: [42.70908, -73.72157],
    });

    expect(route.provider).toBe("local");
    expect(route.distance).toBeGreaterThan(0);
    expect(route.time).toBeGreaterThan(0);
    expect(route.geojson.features[0].geometry.coordinates.length).toBeGreaterThanOrEqual(3);
    expect(route.geojson.features[0].geometry.coordinates[0]).toEqual([-73.73195, 42.7042]);
    expect(route.geojson.features[0].geometry.coordinates.at(-1)).toEqual([-73.72157, 42.70908]);
    expect(route.bounds[0][0]).toBeCloseTo(42.7042, 3);
    expect(route.bounds[0][1]).toBeCloseTo(-73.73195, 3);
    expect(route.bounds[1][0]).toBeCloseTo(42.70911, 3);
    expect(route.bounds[1][1]).toBeCloseTo(-73.72154, 3);
  });

  test("reconnects sub-meter road gaps before calculating a local route", async () => {
    const roadGraph = buildRoadRoutingGraph(FRAGMENTED_ROADS);
    const route = await calculateWalkingRoute({
      provider: "local",
      roadGraph,
      from: [42.704, -73.732],
      to: [42.706, -73.73],
    });

    expect(route.provider).toBe("local");
    expect(route.geojson.features[0].geometry.coordinates.length).toBeGreaterThanOrEqual(3);
    expect(route.geojson.features[0].geometry.coordinates[0]).toEqual([-73.732, 42.704]);
    expect(route.geojson.features[0].geometry.coordinates.at(-1)).toEqual([-73.73, 42.706]);
  });

  test("snaps arbitrary points onto the bundled road graph", () => {
    const roadGraph = buildRoadRoutingGraph(SIMPLE_ROADS);
    const snap = snapPointToRoadNetwork(42.7042, -73.73195, roadGraph);

    expect(snap).toMatchObject({
      segment: expect.any(Object),
    });
    expect(snap.distanceMeters).toBeLessThan(10);
    expect(snap.lat).toBeCloseTo(42.7042, 3);
    expect(snap.lng).toBeCloseTo(-73.73195, 3);
  });

  test("dispatches offline routing through the local Valhalla proxy", async () => {
    let requestedUrl = "";

    const route = await calculateWalkingRoute({
      provider: "valhalla",
      from: [42.70418, -73.73198],
      to: [42.70911, -73.72154],
      fetchImpl: async (url) => {
        requestedUrl = String(url);
        return {
          ok: true,
          json: async () => ({
            code: "Ok",
            routes: [
              {
                distance: 120,
                duration: 95,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [-73.73198, 42.70418],
                    [-73.72154, 42.70911],
                  ],
                },
              },
            ],
          }),
        };
      },
    });

    expect(requestedUrl.startsWith("/__valhalla/route?json=")).toBe(true);
    expect(route.provider).toBe("valhalla");
  });

  test("prefers the bundled road graph when both route endpoints are on-site", async () => {
    let requestedExternalRoute = false;
    const roadGraph = buildRoadRoutingGraph(SIMPLE_ROADS);
    const route = await calculateWalkingRoute({
      provider: "api",
      roadGraph,
      from: [42.7042, -73.73195],
      to: [42.70908, -73.72157],
      fetchImpl: async () => {
        requestedExternalRoute = true;
        throw new Error("external provider should not be used for on-site routing");
      },
    });

    expect(requestedExternalRoute).toBe(false);
    expect(route.provider).toBe("local");
  });

  test("keeps using the external provider when the origin is off-site", async () => {
    let requestedExternalRoute = false;
    const roadGraph = buildRoadRoutingGraph(SIMPLE_ROADS);
    const route = await calculateWalkingRoute({
      provider: "api",
      roadGraph,
      from: [42.72, -73.75],
      to: [42.70908, -73.72157],
      fetchImpl: async () => {
        requestedExternalRoute = true;
        return {
          ok: true,
          json: async () => ({
            code: "Ok",
            routes: [
              {
                distance: 240,
                duration: 180,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [-73.75, 42.72],
                    [-73.72157, 42.70908],
                  ],
                },
              },
            ],
          }),
        };
      },
    });

    expect(requestedExternalRoute).toBe(true);
    expect(route.provider).toBe("api");
  });

  test("surfaces routing errors with provider-aware user-facing copy", () => {
    expect(getRoutingErrorMessage({
      provider: "valhalla",
      status: 503,
    })).toBe("Offline routing service unavailable. Start local Valhalla and try again.");
    expect(getRoutingErrorMessage({ status: 0 })).toBe("Network error: Please check your internet connection.");
    expect(getRoutingErrorMessage({ status: 429 })).toBe("Too many requests: Rate limit exceeded.");
    expect(getRoutingErrorMessage(new Error("No route found"))).toBe("No route found");
  });
});
