import { getGeoJsonBounds } from "../../shared/geo";
import { calculateClientSideWalkingRoute } from "./roadRouting";

const DEFAULT_VALHALLA_API_URL = "https://valhalla1.openstreetmap.de";
const DEFAULT_LOCAL_VALHALLA_PROXY_PATH = "/__valhalla";

const createRoutingError = (message, { code = "", provider = "api", status = 0 } = {}) => {
  const error = new Error(message);
  error.code = code;
  error.provider = provider;
  error.status = status;
  return error;
};

const isLatLngTuple = (value) => (
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

const getValhallaEndpoint = ({
  apiUrl,
  defaultBaseUrl,
}) => {
  const normalizedBaseUrl = String(apiUrl || defaultBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  if (!normalizedBaseUrl) {
    return "";
  }

  return normalizedBaseUrl.endsWith("/route")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/route`;
};

const buildValhallaPayload = ({ from, to }) => ({
  locations: [
    { lat: Number(from[0]), lon: Number(from[1]) },
    { lat: Number(to[0]), lon: Number(to[1]) },
  ],
  costing: "pedestrian",
  directions_type: "none",
  format: "osrm",
  shape_format: "geojson",
  units: "kilometers",
});

const appendJsonQuery = (endpoint, payload) => {
  if (!endpoint) {
    return "";
  }

  if (/^https?:\/\//i.test(endpoint)) {
    const url = new URL(endpoint);
    url.searchParams.set("json", JSON.stringify(payload));
    return url.toString();
  }

  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}json=${encodeURIComponent(JSON.stringify(payload))}`;
};

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
  if (!isLatLngTuple(from) || !isLatLngTuple(to)) {
    return "";
  }

  const endpoint = getValhallaEndpoint({
    apiUrl,
    defaultBaseUrl: DEFAULT_VALHALLA_API_URL,
  });

  return appendJsonQuery(endpoint, buildValhallaPayload({ from, to }));
};

export const buildOfflineWalkingRouteUrl = ({ from, to, proxyPath } = {}) => {
  if (!isLatLngTuple(from) || !isLatLngTuple(to)) {
    return "";
  }

  const endpoint = getValhallaEndpoint({
    apiUrl: proxyPath || process.env.REACT_APP_VALHALLA_PROXY_PATH,
    defaultBaseUrl: DEFAULT_LOCAL_VALHALLA_PROXY_PATH,
  });

  return appendJsonQuery(endpoint, buildValhallaPayload({ from, to }));
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
  provider: "api",
  requestUrl: buildWalkingRouteUrl({ from, to, apiUrl }),
});

export const fetchOfflineWalkingRoute = async ({
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
  provider: "valhalla",
  requestUrl: buildOfflineWalkingRouteUrl({ from, to, proxyPath }),
});

export const calculateWalkingRoute = async ({
  provider = "api",
  roadGraph,
  ...options
} = {}) => {
  if (provider === "local") {
    return calculateClientSideWalkingRoute({
      ...options,
      roadGraph,
    });
  }

  if (provider === "valhalla") {
    return fetchOfflineWalkingRoute(options);
  }

  return fetchWalkingRoute(options);
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
