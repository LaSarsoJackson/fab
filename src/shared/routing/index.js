import routingDefaults from "./routingDefaults.json";

const freezeArray = (values = []) => Object.freeze([...values]);

export const ROUTING_QUERY_PARAMS = Object.freeze({
  search: "q",
  section: "section",
  sharedSelection: "share",
  tour: "tour",
  view: "view",
});

export const ROUTING_PROVIDERS = Object.freeze({
  api: "api",
  local: "local",
  valhalla: "valhalla",
});

export const DEFAULT_ROUTING_PROVIDER = ROUTING_PROVIDERS.api;
export const VALID_ROUTING_PROVIDERS = freezeArray(Object.values(ROUTING_PROVIDERS));

export const DEFAULT_VALHALLA_API_URL = routingDefaults.defaultValhallaApiUrl;
export const DEFAULT_LOCAL_VALHALLA_PROXY_PATH = routingDefaults.defaultLocalValhallaProxyPath;
export const DEFAULT_LOCAL_VALHALLA_PROXY_TARGET = routingDefaults.defaultLocalValhallaProxyTarget;

const VALID_ROUTING_PROVIDER_SET = new Set(VALID_ROUTING_PROVIDERS);

const isValidCoordinate = (value, min, max) => (
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
);

const formatLatLng = (latitude, longitude) => `${latitude},${longitude}`;

export const isLatLngTuple = (value) => (
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]))
);

export const normalizeRoutingProvider = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return VALID_ROUTING_PROVIDER_SET.has(normalizedValue) ? normalizedValue : "";
};

export const buildValhallaRouteEndpoint = ({
  apiUrl,
  defaultBaseUrl = DEFAULT_VALHALLA_API_URL,
} = {}) => {
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

export const buildValhallaWalkingPayload = ({ from, to } = {}) => ({
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

export const appendJsonQuery = (endpoint, payload) => {
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

export const buildValhallaWalkingRouteUrl = ({
  apiUrl,
  from,
  to,
} = {}) => {
  if (!isLatLngTuple(from) || !isLatLngTuple(to)) {
    return "";
  }

  const endpoint = buildValhallaRouteEndpoint({
    apiUrl,
    defaultBaseUrl: DEFAULT_VALHALLA_API_URL,
  });

  return appendJsonQuery(endpoint, buildValhallaWalkingPayload({ from, to }));
};

export const buildOfflineValhallaWalkingRouteUrl = ({
  from,
  proxyPath,
  to,
} = {}) => {
  if (!isLatLngTuple(from) || !isLatLngTuple(to)) {
    return "";
  }

  const endpoint = buildValhallaRouteEndpoint({
    apiUrl: proxyPath,
    defaultBaseUrl: DEFAULT_LOCAL_VALHALLA_PROXY_PATH,
  });

  return appendJsonQuery(endpoint, buildValhallaWalkingPayload({ from, to }));
};

export const buildDirectionsLink = ({
  latitude,
  longitude,
  label = "",
  originLatitude,
  originLongitude,
  userAgent = "",
} = {}) => {
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return null;
  }

  const formattedLatLng = formatLatLng(latitude, longitude);
  const hasOrigin = isValidCoordinate(originLatitude, -90, 90) &&
    isValidCoordinate(originLongitude, -180, 180);
  const formattedOriginLatLng = hasOrigin
    ? formatLatLng(originLatitude, originLongitude)
    : "";
  const normalizedUserAgent = userAgent.toLowerCase();
  const cleanedLabel = String(label || "").trim();

  if (
    /iphone|ipad|ipod|macintosh/.test(normalizedUserAgent) ||
    /mac os x/.test(normalizedUserAgent)
  ) {
    const params = new URLSearchParams({
      daddr: formattedLatLng,
      dirflg: "w",
    });

    if (hasOrigin) {
      params.set("saddr", formattedOriginLatLng);
    }

    if (cleanedLabel) {
      params.set("q", cleanedLabel);
    }

    return {
      href: `https://maps.apple.com/?${params.toString()}`,
      platform: "apple",
      target: "self",
    };
  }

  const googleMapsDirectionsParams = new URLSearchParams({
    api: "1",
    destination: formattedLatLng,
    travelmode: "walking",
  });

  if (hasOrigin) {
    googleMapsDirectionsParams.set("origin", formattedOriginLatLng);
  }

  if (/android/.test(normalizedUserAgent)) {
    return {
      href: `https://www.google.com/maps/dir/?${googleMapsDirectionsParams.toString()}`,
      platform: "android",
      target: "self",
    };
  }

  return {
    href: `https://www.google.com/maps/dir/?${googleMapsDirectionsParams.toString()}`,
    platform: "web",
    target: "_blank",
  };
};
