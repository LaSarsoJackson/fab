import { getGeoJsonBounds } from "../../shared/geo/geoJsonBounds";
import {
  buildOfflineValhallaWalkingRouteUrl,
  buildValhallaWalkingRouteUrl,
  DEFAULT_ROUTING_PROVIDER,
  isLatLngTuple,
  ROUTING_PROVIDERS,
} from "../../shared/routing";

//=============================================================================
// Module Boundary
//=============================================================================

/**
 * This module keeps map routing logic in one place.
 *
 * It owns:
 * - the bundled cemetery road graph
 * - point snapping onto that graph
 * - client-side shortest-path routing on local roads
 * - external Valhalla request construction and response normalization
 * - provider fallback rules shared by the map shell
 *
 * It does not own UI state, React effects, or map rendering.
 */

//=============================================================================
// Shared Routing Constants
//=============================================================================

const EARTH_RADIUS_METERS = 6371008.8;
const WALKING_SPEED_METERS_PER_SECOND = 1.4;
const DEFAULT_NEARBY_NODE_CONNECTION_TOLERANCE_METERS = 1;

export const DEFAULT_MAX_SNAP_DISTANCE_METERS = 250;

const createRoutingError = (message, { code = "", provider = "api", status = 0 } = {}) => {
  const error = new Error(message);
  error.code = code;
  error.provider = provider;
  error.status = status;
  return error;
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const isCoordinatePairValid = (value) => (
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]))
);

const normalizeRouteCoordinates = (coordinates) => (
  Array.isArray(coordinates)
    ? coordinates
      .filter((coordinate) => (
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        Number.isFinite(Number(coordinate[0])) &&
        Number.isFinite(Number(coordinate[1]))
      ))
      .map(([lng, lat]) => [Number(lng), Number(lat)])
    : []
);

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const areCoordinatesEquivalent = (left, right) => (
  Number(left?.[0]) === Number(right?.[0]) &&
  Number(left?.[1]) === Number(right?.[1])
);

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

const prependRouteCoordinate = (coordinates, coordinate) => (
  coordinate && !areCoordinatesEquivalent(coordinate, coordinates[0])
    ? [coordinate, ...coordinates]
    : coordinates
);

const appendRouteCoordinate = (coordinates, coordinate) => (
  coordinate && !areCoordinatesEquivalent(coordinate, coordinates[coordinates.length - 1])
    ? [...coordinates, coordinate]
    : coordinates
);

const prependCoordinate = (coordinates, coordinate) => dedupeAdjacentCoordinates([
  coordinate,
  ...(Array.isArray(coordinates) ? coordinates : []),
]);

const appendCoordinate = (coordinates, coordinate) => dedupeAdjacentCoordinates([
  ...(Array.isArray(coordinates) ? coordinates : []),
  coordinate,
]);

const latLngTupleToCoordinate = (value) => (
  isLatLngTuple(value)
    ? [Number(value[1]), Number(value[0])]
    : null
);

//=============================================================================
// Local Road Graph
//=============================================================================

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

const buildCoordinateMap = (nodes) => {
  const coordinates = new Map();

  nodes.forEach((node, key) => {
    coordinates.set(key, [Number(node.lng), Number(node.lat)]);
  });

  return coordinates;
};

const connectNearbyRoadNodes = (
  nodes,
  { connectionToleranceMeters = DEFAULT_NEARBY_NODE_CONNECTION_TOLERANCE_METERS } = {}
) => {
  if (!nodes?.size || !Number.isFinite(connectionToleranceMeters) || connectionToleranceMeters <= 0) {
    return;
  }

  const nodeEntries = Array.from(nodes.entries());

  for (let leftIndex = 0; leftIndex < nodeEntries.length; leftIndex += 1) {
    const [leftKey, leftNode] = nodeEntries[leftIndex];

    for (let rightIndex = leftIndex + 1; rightIndex < nodeEntries.length; rightIndex += 1) {
      const [rightKey, rightNode] = nodeEntries[rightIndex];
      const distanceMeters = haversineDistanceMeters(
        [leftNode.lng, leftNode.lat],
        [rightNode.lng, rightNode.lat]
      );

      if (distanceMeters <= connectionToleranceMeters) {
        connectRoadGraphNodes(nodes, leftKey, rightKey, distanceMeters);
      }
    }
  }
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

  connectNearbyRoadNodes(nodes);

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

const calculateClientSideWalkingRoute = ({
  from,
  roadGraph,
  to,
  maxSnapDistanceMeters = DEFAULT_MAX_SNAP_DISTANCE_METERS,
} = {}) => {
  if (!Array.isArray(from) || !Array.isArray(to)) {
    throw createRoutingError("Directions unavailable for this burial.", {
      code: "LOCAL_ROUTING_MISSING_COORDINATES",
      provider: "local",
      status: 400,
    });
  }

  if (!roadGraph?.nodes?.size || !roadGraph?.segments?.length) {
    throw createRoutingError("Local road routing is unavailable in this build.", {
      code: "LOCAL_ROUTING_GRAPH_UNAVAILABLE",
      provider: "local",
      status: 400,
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
      provider: "local",
      status: 400,
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
      provider: "local",
      status: 400,
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
      provider: "local",
      status: 400,
    });
  }

  const rawFromCoordinate = [Number(from[1]), Number(from[0])];
  const rawToCoordinate = [Number(to[1]), Number(to[0])];
  const routeCoordinates = appendCoordinate(
    prependCoordinate(coordinates, rawFromCoordinate),
    rawToCoordinate
  );
  const geojson = createRouteFeatureCollection(routeCoordinates);

  return {
    provider: "local",
    distance: distanceMeters,
    time: (distanceMeters / WALKING_SPEED_METERS_PER_SECOND) * 1000,
    geojson,
    bounds: getGeoJsonBounds(geojson),
  };
};

//=============================================================================
// External Routing Providers
//=============================================================================

const getRouteMessageFromPayload = (payload, fallbackMessage) => {
  if (typeof payload?.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload?.status_message === "string" && payload.status_message.trim()) {
    return payload.status_message.trim();
  }

  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }

  return fallbackMessage;
};

const getRouteFetchImpl = (fetchImpl, provider) => {
  const fetchRoute = typeof fetchImpl === "function"
    ? fetchImpl
    : (typeof fetch === "function" ? fetch : null);

  if (typeof fetchRoute === "function") {
    return fetchRoute;
  }

  throw createRoutingError("Routing is unavailable in this environment.", {
    code: "ROUTING_FETCH_UNAVAILABLE",
    provider,
    status: 500,
  });
};

const assertValidRouteRequest = ({ from, to, requestUrl, provider }) => {
  if (!isLatLngTuple(from) || !isLatLngTuple(to)) {
    throw createRoutingError("Directions unavailable for this burial.", {
      code: "ROUTING_INVALID_COORDINATES",
      provider,
      status: 400,
    });
  }

  if (requestUrl) {
    return;
  }

  throw createRoutingError("Directions unavailable for this burial.", {
    code: "ROUTING_MISSING_ENDPOINT",
    provider,
    status: 400,
  });
};

const createRouteNetworkError = (provider) => {
  if (provider === "valhalla") {
    return createRoutingError("Offline routing service unavailable. Start local Valhalla and try again.", {
      code: "OFFLINE_ROUTING_UNAVAILABLE",
      provider,
      status: 503,
    });
  }

  return createRoutingError("Network error: Please check your internet connection.", {
    code: "ROUTING_NETWORK_ERROR",
    provider,
    status: 0,
  });
};

const requestRouteResponse = async ({
  fetchRoute,
  provider,
  requestUrl,
  signal,
}) => {
  try {
    return await fetchRoute(requestUrl, {
      method: "GET",
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw createRouteNetworkError(provider);
  }
};

const readRoutePayload = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const assertRouteResponseOk = ({ payload, provider, response }) => {
  if (!response.ok) {
    throw createRoutingError(
      getRouteMessageFromPayload(payload, `Routing request failed with status ${response.status}.`),
      {
        code: "ROUTING_HTTP_ERROR",
        provider,
        status: response.status,
      }
    );
  }

  if (payload && Object.prototype.hasOwnProperty.call(payload, "code") && payload.code !== "Ok") {
    throw createRoutingError(
      getRouteMessageFromPayload(payload, "Unable to calculate route."),
      {
        code: "ROUTING_APPLICATION_ERROR",
        provider,
        status: response.status || 400,
      }
    );
  }
};

const buildRouteResult = ({ payload, provider, status }) => {
  const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
  const coordinates = normalizeRouteCoordinates(route?.geometry?.coordinates);

  if (coordinates.length < 2) {
    throw createRoutingError("Unable to calculate route. The route geometry was incomplete.", {
      code: "ROUTING_INCOMPLETE_GEOMETRY",
      provider,
      status: status || 400,
    });
  }

  const geojson = createRouteFeatureCollection(coordinates);
  return {
    provider,
    distance: Number(route?.distance) || 0,
    time: (Number(route?.duration) || 0) * 1000,
    geojson,
    bounds: getGeoJsonBounds(geojson),
  };
};

const addRouteEndpointCoordinates = (routeResult, { from, to } = {}) => {
  const coordinates = normalizeRouteCoordinates(
    routeResult?.geojson?.features?.[0]?.geometry?.coordinates
  );

  if (coordinates.length < 2) {
    return routeResult;
  }

  const nextCoordinates = appendRouteCoordinate(
    prependRouteCoordinate(coordinates, latLngTupleToCoordinate(from)),
    latLngTupleToCoordinate(to)
  );
  const geojson = createRouteFeatureCollection(nextCoordinates);

  return {
    ...routeResult,
    geojson,
    bounds: getGeoJsonBounds(geojson),
  };
};

const buildSnappedLatLngTuple = (latLng, roadGraph, maxSnapDistanceMeters) => {
  const resolvedMaxSnapDistanceMeters = Number.isFinite(maxSnapDistanceMeters)
    ? Number(maxSnapDistanceMeters)
    : DEFAULT_MAX_SNAP_DISTANCE_METERS;
  const snap = isLatLngTuple(latLng)
    ? snapPointToRoadNetwork(latLng[0], latLng[1], roadGraph, {
      maxSnapDistanceMeters: resolvedMaxSnapDistanceMeters,
    })
    : null;

  return snap
    ? [snap.lat, snap.lng]
    : null;
};

const fetchValhallaRoute = async ({
  from,
  to,
  signal,
  fetchImpl,
  provider = "api",
  requestUrl,
} = {}) => {
  assertValidRouteRequest({ from, to, requestUrl, provider });

  const response = await requestRouteResponse({
    fetchRoute: getRouteFetchImpl(fetchImpl, provider),
    provider,
    requestUrl,
    signal,
  });
  const payload = await readRoutePayload(response);

  assertRouteResponseOk({ payload, provider, response });

  return buildRouteResult({
    payload,
    provider,
    status: response.status,
  });
};

export const buildWalkingRouteUrl = ({ from, to, apiUrl } = {}) => {
  return buildValhallaWalkingRouteUrl({ apiUrl, from, to });
};

export const buildOfflineWalkingRouteUrl = ({ from, to, proxyPath } = {}) => {
  return buildOfflineValhallaWalkingRouteUrl({
    from,
    proxyPath: proxyPath || process.env.REACT_APP_VALHALLA_PROXY_PATH,
    to,
  });
};

export const fetchWalkingRoute = async ({
  apiUrl,
  fetchImpl,
  from,
  signal,
  to,
} = {}) => fetchValhallaRoute({
  from,
  to,
  signal,
  fetchImpl,
  provider: ROUTING_PROVIDERS.api,
  requestUrl: buildWalkingRouteUrl({
    from,
    to,
    apiUrl: apiUrl || process.env.REACT_APP_VALHALLA_API_URL,
  }),
});

const fetchOfflineWalkingRoute = async ({
  fetchImpl,
  from,
  proxyPath,
  signal,
  to,
} = {}) => fetchValhallaRoute({
  from,
  to,
  signal,
  fetchImpl,
  provider: ROUTING_PROVIDERS.valhalla,
  requestUrl: buildOfflineWalkingRouteUrl({ from, to, proxyPath }),
});

export const calculateWalkingRoute = async ({
  provider = DEFAULT_ROUTING_PROVIDER,
  roadGraph,
  maxSnapDistanceMeters,
  ...options
} = {}) => {
  if (provider === ROUTING_PROVIDERS.local) {
    return calculateClientSideWalkingRoute({
      ...options,
      maxSnapDistanceMeters,
      roadGraph,
    });
  }

  const snappedFrom = buildSnappedLatLngTuple(options.from, roadGraph, maxSnapDistanceMeters);
  const snappedTo = buildSnappedLatLngTuple(options.to, roadGraph, maxSnapDistanceMeters);
  const canRouteLocally = Boolean(snappedFrom && snappedTo);

  if (canRouteLocally) {
    try {
      return calculateClientSideWalkingRoute({
        ...options,
        maxSnapDistanceMeters,
        roadGraph,
      });
    } catch (_error) {
      // Fall back to the selected external provider when the bundled road graph cannot connect the path.
    }
  }

  if (provider === ROUTING_PROVIDERS.valhalla) {
    const routeResult = await fetchOfflineWalkingRoute({
      ...options,
      from: snappedFrom || options.from,
      to: snappedTo || options.to,
    });

    return addRouteEndpointCoordinates(routeResult, options);
  }

  const routeResult = await fetchWalkingRoute({
    ...options,
    from: snappedFrom || options.from,
    to: snappedTo || options.to,
  });

  return addRouteEndpointCoordinates(routeResult, options);
};

export const getRoutingErrorMessage = (error) => {
  if (error?.name === "AbortError") {
    return "";
  }

  if (
    error?.provider === "valhalla" &&
    [0, 502, 503, 504].includes(Number(error?.status))
  ) {
    return "Offline routing service unavailable. Start local Valhalla and try again.";
  }

  if (error?.status === 0) {
    return "Network error: Please check your internet connection.";
  }

  if (error?.status === 429) {
    return "Too many requests: Rate limit exceeded.";
  }

  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "Unable to calculate route. The locations might be inaccessible by foot or too far apart.";
};
