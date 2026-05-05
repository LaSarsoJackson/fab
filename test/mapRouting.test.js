import { describe, expect, test } from "bun:test";

import ARC_ROADS from "../src/data/ARC_Roads.json";
import {
  buildRoadRoutingGraph,
  calculateWalkingRoute,
  getRoutingErrorMessage,
  snapPointToRoadNetwork,
} from "../src/features/map/mapRouting";

const EARTH_RADIUS_METERS = 6371008.8;
const RENDERED_ROAD_GAP_TOLERANCE_METERS = 1;

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

const REPAIRED_ROAD_JOINS = [
  {
    from: [42.710577555398572, -73.733957158683879],
    join: [-73.733989215596942, 42.710663410361557],
    to: [42.710685742425213, -73.734001484618204],
  },
  {
    from: [42.706562156958022, -73.737135451891419],
    join: [-73.73713492359312, 42.70656171482194],
    to: [42.706600645765278, -73.737142541270543],
  },
  {
    from: [42.706605255936914, -73.730641233122711],
    join: [-73.730302996398379, 42.706434242026184],
    to: [42.706405682843986, -73.730247520892519],
  },
  {
    from: [42.711972227737128, -73.730243636943243],
    join: [-73.730218719246998, 42.712029099518034],
    to: [42.712084798360671, -73.730194330977767],
  },
];

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const getApproximateDistanceMeters = (from, to) => {
  const referenceLat = (Number(from[1]) + Number(to[1])) / 2;
  const deltaLng = toRadians(Number(to[0]) - Number(from[0])) *
    EARTH_RADIUS_METERS *
    Math.cos(toRadians(referenceLat));
  const deltaLat = toRadians(Number(to[1]) - Number(from[1])) * EARTH_RADIUS_METERS;

  return Math.hypot(deltaLng, deltaLat);
};

const createCoordinateKey = ([lng, lat]) => `${Number(lng).toFixed(6)},${Number(lat).toFixed(6)}`;

const getRoadLineGroups = (roadsFeatureCollection) => (
  (roadsFeatureCollection?.features || []).flatMap((feature, featureIndex) => {
    const geometry = feature?.geometry;
    const lineGroups = geometry?.type === "MultiLineString"
      ? geometry.coordinates
      : (geometry?.type === "LineString" ? [geometry.coordinates] : []);

    return lineGroups
      .filter((coordinates) => Array.isArray(coordinates) && coordinates.length >= 2)
      .map((coordinates, lineIndex) => ({
        coordinates,
        featureIndex,
        lineIndex,
        roadName: feature.properties?.Cemetery_R || feature.properties?.G_ST_NAME || "",
      }));
  })
);

const findRenderedRoadEndpointGaps = (
  roadsFeatureCollection,
  { maxGapMeters = RENDERED_ROAD_GAP_TOLERANCE_METERS } = {}
) => {
  const lineGroups = getRoadLineGroups(roadsFeatureCollection);
  const endpointCounts = new Map();
  const endpoints = [];

  lineGroups.forEach(({ coordinates, featureIndex, lineIndex, roadName }) => {
    [coordinates[0], coordinates.at(-1)].forEach((coordinate, endpointIndex) => {
      const normalizedCoordinate = [Number(coordinate?.[0]), Number(coordinate?.[1])];
      if (!Number.isFinite(normalizedCoordinate[0]) || !Number.isFinite(normalizedCoordinate[1])) {
        return;
      }

      const key = createCoordinateKey(normalizedCoordinate);
      endpointCounts.set(key, (endpointCounts.get(key) || 0) + 1);
      endpoints.push({
        coordinate: normalizedCoordinate,
        endpointIndex,
        featureIndex,
        key,
        lineIndex,
        roadName,
      });
    });
  });

  const danglingEndpoints = endpoints.filter((endpoint) => endpointCounts.get(endpoint.key) === 1);
  const gaps = [];

  for (let leftIndex = 0; leftIndex < danglingEndpoints.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < danglingEndpoints.length; rightIndex += 1) {
      const left = danglingEndpoints[leftIndex];
      const right = danglingEndpoints[rightIndex];
      const distanceMeters = getApproximateDistanceMeters(left.coordinate, right.coordinate);

      if (distanceMeters > 0 && distanceMeters <= maxGapMeters) {
        gaps.push({
          distanceMeters: Number(distanceMeters.toFixed(3)),
          from: `${left.featureIndex}:${left.lineIndex}:${left.endpointIndex}:${left.roadName}`,
          to: `${right.featureIndex}:${right.lineIndex}:${right.endpointIndex}:${right.roadName}`,
        });
      }
    }
  }

  return gaps.sort((left, right) => left.distanceMeters - right.distanceMeters);
};

const countRoadGraphComponents = (roadGraph) => {
  const seen = new Set();
  let componentCount = 0;

  roadGraph.nodes.forEach((_node, startKey) => {
    if (seen.has(startKey)) {
      return;
    }

    componentCount += 1;
    const stack = [startKey];
    seen.add(startKey);

    while (stack.length > 0) {
      const currentKey = stack.pop();
      const currentNode = roadGraph.nodes.get(currentKey);

      currentNode?.edges?.forEach((_distanceMeters, nextKey) => {
        if (seen.has(nextKey)) {
          return;
        }

        seen.add(nextKey);
        stack.push(nextKey);
      });
    }
  });

  return componentCount;
};

describe("map routing helpers", () => {
  test("routes along the bundled road graph by default", async () => {
    const roadGraph = buildRoadRoutingGraph(SIMPLE_ROADS);
    const route = await calculateWalkingRoute({
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
      roadGraph,
      from: [42.704, -73.732],
      to: [42.706, -73.73],
    });

    expect(route.provider).toBe("local");
    expect(route.geojson.features[0].geometry.coordinates.length).toBeGreaterThanOrEqual(3);
    expect(route.geojson.features[0].geometry.coordinates[0]).toEqual([-73.732, 42.704]);
    expect(route.geojson.features[0].geometry.coordinates.at(-1)).toEqual([-73.73, 42.706]);
  });

  test("keeps the bundled cemetery road graph connected after closing tiny source gaps", () => {
    const roadGraph = buildRoadRoutingGraph(ARC_ROADS);

    expect(roadGraph.nodes.size).toBeGreaterThan(1000);
    expect(roadGraph.segments.length).toBeGreaterThan(1000);
    expect(countRoadGraphComponents(roadGraph)).toBe(1);
  });

  test("keeps the bundled road overlay free of graph-only endpoint gaps", () => {
    expect(findRenderedRoadEndpointGaps(ARC_ROADS)).toEqual([]);
  });

  test("routes across repaired source road joins", async () => {
    const roadGraph = buildRoadRoutingGraph(ARC_ROADS);

    for (const repairedJoin of REPAIRED_ROAD_JOINS) {
      const route = await calculateWalkingRoute({
        roadGraph,
        from: repairedJoin.from,
        to: repairedJoin.to,
        maxSnapDistanceMeters: 10,
      });
      const routeCoordinateKeys = route.geojson.features[0].geometry.coordinates.map(createCoordinateKey);

      expect(route.provider).toBe("local");
      expect(routeCoordinateKeys).toContain(createCoordinateKey(repairedJoin.join));
    }
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

  test("reports an on-site routing error when an endpoint is outside the cemetery road network", async () => {
    const roadGraph = buildRoadRoutingGraph(SIMPLE_ROADS);

    await expect(calculateWalkingRoute({
      roadGraph,
      from: [42.72, -73.75],
      to: [42.70908, -73.72157],
    })).rejects.toMatchObject({
      code: "LOCAL_ROUTING_OUT_OF_RANGE",
      provider: "local",
      status: 400,
    });
  });

  test("reports a local routing error when the road graph is unavailable", async () => {
    await expect(calculateWalkingRoute({
      roadGraph: null,
      from: [42.7042, -73.73195],
      to: [42.70908, -73.72157],
    })).rejects.toMatchObject({
      code: "LOCAL_ROUTING_GRAPH_UNAVAILABLE",
      provider: "local",
      status: 400,
    });
  });

  test("surfaces local routing errors with user-facing copy", () => {
    expect(getRoutingErrorMessage({
      code: "LOCAL_ROUTING_OUT_OF_RANGE",
    })).toBe("Local road routing only works near the cemetery road network.");
    expect(getRoutingErrorMessage({})).toBe(
      "Unable to calculate route. The locations might be inaccessible by foot or too far apart."
    );
    expect(getRoutingErrorMessage(new Error("No route found"))).toBe("No route found");
  });
});
