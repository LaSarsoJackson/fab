import { getGeoJsonBounds } from "../../shared/geo";

const EARTH_RADIUS_METERS = 6371008.8;
const WALKING_SPEED_METERS_PER_SECOND = 1.4;
const DEFAULT_MAX_SNAP_DISTANCE_METERS = 250;

const createRoutingError = (message, { code = "", provider = "local", status = 400 } = {}) => {
  const error = new Error(message);
  error.code = code;
  error.provider = provider;
  error.status = status;
  return error;
};

const isCoordinatePairValid = (value) => (
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]))
);

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const haversineDistanceMeters = (from, to) => {
  if (!isCoordinatePairValid(from) || !isCoordinatePairValid(to)) {
    return Number.POSITIVE_INFINITY;
  }

  const [fromLng, fromLat] = from.map(Number);
  const [toLng, toLat] = to.map(Number);
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const fromLatRadians = toRadians(fromLat);
  const toLatRadians = toRadians(toLat);
  const haversine = (
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLatRadians) *
    Math.cos(toLatRadians) *
    Math.sin(deltaLng / 2) ** 2
  );

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
};

const createNodeKey = ([lng, lat]) => (
  `${Number(lng).toFixed(6)},${Number(lat).toFixed(6)}`
);

const ensureNode = (nodes, coordinate) => {
  const key = createNodeKey(coordinate);
  if (!nodes.has(key)) {
    nodes.set(key, {
      key,
      lng: Number(coordinate[0]),
      lat: Number(coordinate[1]),
      edges: new Map(),
    });
  }

  return key;
};

const setShortestNodeEdge = (nodes, fromKey, toKey, distanceMeters) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || fromKey === toKey) {
    return;
  }

  const fromNode = nodes.get(fromKey);
  if (!fromNode) {
    return;
  }

  const nextDistance = Math.min(
    distanceMeters,
    fromNode.edges.get(toKey) ?? Number.POSITIVE_INFINITY
  );

  fromNode.edges.set(toKey, nextDistance);
};

const connectRoadGraphNodes = (nodes, fromKey, toKey, distanceMeters) => {
  setShortestNodeEdge(nodes, fromKey, toKey, distanceMeters);
  setShortestNodeEdge(nodes, toKey, fromKey, distanceMeters);
};

const setShortestEdge = (edges, fromKey, toKey, distanceMeters) => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || fromKey === toKey) {
    return;
  }

  const nextDistance = Math.min(
    distanceMeters,
    edges.get(fromKey)?.get(toKey) ?? Number.POSITIVE_INFINITY
  );

  if (!edges.has(fromKey)) {
    edges.set(fromKey, new Map());
  }

  edges.get(fromKey).set(toKey, nextDistance);
};

const cloneEdgeMap = (nodes) => {
  const edges = new Map();

  nodes.forEach((node, key) => {
    edges.set(key, new Map(node.edges));
  });

  return edges;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const projectCoordinateToMeters = ([lng, lat], referenceLat) => ({
  x: toRadians(lng) * EARTH_RADIUS_METERS * Math.cos(toRadians(referenceLat)),
  y: toRadians(lat) * EARTH_RADIUS_METERS,
});

const interpolateCoordinate = (start, end, ratio) => ([
  Number(start[0]) + ((Number(end[0]) - Number(start[0])) * ratio),
  Number(start[1]) + ((Number(end[1]) - Number(start[1])) * ratio),
]);

const findNearestSegmentSnap = (coordinate, roadGraph) => {
  if (!isCoordinatePairValid(coordinate) || !roadGraph?.segments?.length) {
    return null;
  }

  let closestSnap = null;

  roadGraph.segments.forEach((segment) => {
    const referenceLat = (
      Number(coordinate[1]) +
      Number(segment.start[1]) +
      Number(segment.end[1])
    ) / 3;
    const projectedPoint = projectCoordinateToMeters(coordinate, referenceLat);
    const projectedStart = projectCoordinateToMeters(segment.start, referenceLat);
    const projectedEnd = projectCoordinateToMeters(segment.end, referenceLat);
    const deltaX = projectedEnd.x - projectedStart.x;
    const deltaY = projectedEnd.y - projectedStart.y;
    const segmentLengthSquared = (deltaX ** 2) + (deltaY ** 2);
    const ratio = segmentLengthSquared > 0
      ? clamp(
        (
          ((projectedPoint.x - projectedStart.x) * deltaX) +
          ((projectedPoint.y - projectedStart.y) * deltaY)
        ) / segmentLengthSquared,
        0,
        1
      )
      : 0;
    const snappedCoordinate = interpolateCoordinate(segment.start, segment.end, ratio);
    const distanceMeters = haversineDistanceMeters(coordinate, snappedCoordinate);

    if (!closestSnap || distanceMeters < closestSnap.distanceMeters) {
      closestSnap = {
        coordinate: snappedCoordinate,
        distanceMeters,
        lat: snappedCoordinate[1],
        lng: snappedCoordinate[0],
        ratio,
        segment,
      };
    }
  });

  return closestSnap;
};

const addBidirectionalEdge = (edges, fromKey, toKey, distanceMeters) => {
  setShortestEdge(edges, fromKey, toKey, distanceMeters);
  setShortestEdge(edges, toKey, fromKey, distanceMeters);
};

const addVirtualSnapNode = (nodes, edges, snap, virtualKey) => {
  nodes.set(virtualKey, [
    Number(snap.coordinate[0]),
    Number(snap.coordinate[1]),
  ]);

  addBidirectionalEdge(
    edges,
    virtualKey,
    snap.segment.startKey,
    haversineDistanceMeters(snap.coordinate, snap.segment.start)
  );
  addBidirectionalEdge(
    edges,
    virtualKey,
    snap.segment.endKey,
    haversineDistanceMeters(snap.coordinate, snap.segment.end)
  );
};

const createRouteFeatureCollection = (coordinates) => ({
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
        coordinates,
      },
    },
  ],
});

const dedupeAdjacentCoordinates = (coordinates) => coordinates.filter((coordinate, index) => {
  if (index === 0) {
    return true;
  }

  const previousCoordinate = coordinates[index - 1];
  return (
    Number(previousCoordinate?.[0]) !== Number(coordinate?.[0]) ||
    Number(previousCoordinate?.[1]) !== Number(coordinate?.[1])
  );
});

const buildCoordinateMap = (nodes) => {
  const coordinates = new Map();

  nodes.forEach((node, key) => {
    coordinates.set(key, [Number(node.lng), Number(node.lat)]);
  });

  return coordinates;
};

const reconstructShortestPath = ({ previous, startKey, endKey }) => {
  if (startKey === endKey) {
    return [startKey];
  }

  if (!previous.has(endKey)) {
    return [];
  }

  const path = [endKey];
  let currentKey = endKey;

  while (currentKey !== startKey) {
    currentKey = previous.get(currentKey);
    if (!currentKey) {
      return [];
    }
    path.push(currentKey);
  }

  return path.reverse();
};

const calculateShortestPath = ({ edges, startKey, endKey }) => {
  const distances = new Map([[startKey, 0]]);
  const previous = new Map();
  const visited = new Set();

  while (visited.size < edges.size) {
    let currentKey = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    distances.forEach((candidateDistance, candidateKey) => {
      if (visited.has(candidateKey)) {
        return;
      }

      if (candidateDistance < currentDistance) {
        currentKey = candidateKey;
        currentDistance = candidateDistance;
      }
    });

    if (!currentKey) {
      break;
    }

    if (currentKey === endKey) {
      break;
    }

    visited.add(currentKey);
    const neighbors = edges.get(currentKey) || new Map();

    neighbors.forEach((weight, neighborKey) => {
      if (visited.has(neighborKey)) {
        return;
      }

      const nextDistance = currentDistance + weight;
      if (nextDistance < (distances.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighborKey, nextDistance);
        previous.set(neighborKey, currentKey);
      }
    });
  }

  return {
    distanceMeters: distances.get(endKey) ?? Number.POSITIVE_INFINITY,
    path: reconstructShortestPath({ previous, startKey, endKey }),
  };
};

export const buildRoadRoutingGraph = (roadsFeatureCollection) => {
  const nodes = new Map();
  const segments = [];

  (roadsFeatureCollection?.features || []).forEach((feature, featureIndex) => {
    const geometry = feature?.geometry;
    const lineGroups = geometry?.type === "MultiLineString"
      ? geometry.coordinates
      : (geometry?.type === "LineString" ? [geometry.coordinates] : []);

    lineGroups.forEach((lineCoordinates, lineIndex) => {
      if (!Array.isArray(lineCoordinates) || lineCoordinates.length < 2) {
        return;
      }

      for (let coordinateIndex = 1; coordinateIndex < lineCoordinates.length; coordinateIndex += 1) {
        const startCoordinate = lineCoordinates[coordinateIndex - 1];
        const endCoordinate = lineCoordinates[coordinateIndex];

        if (!isCoordinatePairValid(startCoordinate) || !isCoordinatePairValid(endCoordinate)) {
          continue;
        }

        const startKey = ensureNode(nodes, startCoordinate);
        const endKey = ensureNode(nodes, endCoordinate);
        const distanceMeters = haversineDistanceMeters(startCoordinate, endCoordinate);

        connectRoadGraphNodes(nodes, startKey, endKey, distanceMeters);
        segments.push({
          id: `${featureIndex}:${lineIndex}:${coordinateIndex}`,
          start: [Number(startCoordinate[0]), Number(startCoordinate[1])],
          end: [Number(endCoordinate[0]), Number(endCoordinate[1])],
          startKey,
          endKey,
        });
      }
    });
  });

  return {
    nodes,
    segments,
  };
};

export const snapPointToRoadNetwork = (lat, lng, roadGraph, options = {}) => {
  const coordinate = [Number(lng), Number(lat)];
  if (!isCoordinatePairValid(coordinate)) {
    return null;
  }

  const snap = findNearestSegmentSnap(coordinate, roadGraph);
  if (!snap) {
    return null;
  }

  const maxSnapDistanceMeters = Number.isFinite(options.maxSnapDistanceMeters)
    ? Number(options.maxSnapDistanceMeters)
    : Number.POSITIVE_INFINITY;

  if (snap.distanceMeters > maxSnapDistanceMeters) {
    return null;
  }

  return snap;
};

export const calculateClientSideWalkingRoute = ({
  from,
  roadGraph,
  to,
  maxSnapDistanceMeters = DEFAULT_MAX_SNAP_DISTANCE_METERS,
} = {}) => {
  if (!Array.isArray(from) || !Array.isArray(to)) {
    throw createRoutingError("Directions unavailable for this burial.", {
      code: "LOCAL_ROUTING_MISSING_COORDINATES",
    });
  }

  if (!roadGraph?.nodes?.size || !roadGraph?.segments?.length) {
    throw createRoutingError("Local road routing is unavailable in this build.", {
      code: "LOCAL_ROUTING_GRAPH_UNAVAILABLE",
    });
  }

  const startSnap = snapPointToRoadNetwork(from[0], from[1], roadGraph, {
    maxSnapDistanceMeters,
  });
  const endSnap = snapPointToRoadNetwork(to[0], to[1], roadGraph, {
    maxSnapDistanceMeters,
  });

  if (!startSnap || !endSnap) {
    throw createRoutingError("Local road routing only works near the cemetery road network.", {
      code: "LOCAL_ROUTING_OUT_OF_RANGE",
    });
  }

  const nodes = buildCoordinateMap(roadGraph.nodes);
  const edges = cloneEdgeMap(roadGraph.nodes);
  const startKey = "__route:start";
  const endKey = "__route:end";

  addVirtualSnapNode(nodes, edges, startSnap, startKey);
  addVirtualSnapNode(nodes, edges, endSnap, endKey);

  if (startSnap.segment.id === endSnap.segment.id) {
    addBidirectionalEdge(
      edges,
      startKey,
      endKey,
      haversineDistanceMeters(startSnap.coordinate, endSnap.coordinate)
    );
  }

  const { distanceMeters, path } = calculateShortestPath({
    edges,
    startKey,
    endKey,
  });

  if (!path.length || !Number.isFinite(distanceMeters)) {
    throw createRoutingError("Unable to calculate a route on the bundled cemetery roads.", {
      code: "LOCAL_ROUTING_NO_PATH",
    });
  }

  const coordinates = dedupeAdjacentCoordinates(
    path
      .map((key) => nodes.get(key))
      .filter(isCoordinatePairValid)
  );

  if (coordinates.length < 2) {
    throw createRoutingError("Unable to calculate a route on the bundled cemetery roads.", {
      code: "LOCAL_ROUTING_INCOMPLETE_GEOMETRY",
    });
  }

  const geojson = createRouteFeatureCollection(coordinates);

  return {
    provider: "local",
    distance: distanceMeters,
    time: (distanceMeters / WALKING_SPEED_METERS_PER_SECOND) * 1000,
    geojson,
    bounds: getGeoJsonBounds(geojson),
  };
};
