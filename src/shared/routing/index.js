/**
 * Public URL contract for FAB links. Keep query-key names and external
 * directions-link builders here so web links, PWA links, and FABFG hosted URLs
 * do not drift apart.
 */
export const ROUTING_QUERY_PARAMS = Object.freeze({
  search: "q",
  section: "section",
  sharedSelection: "share",
  tour: "tour",
  view: "view",
});

const isValidCoordinate = (value, min, max) => (
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
);

const formatLatLng = (latitude, longitude) => `${latitude},${longitude}`;

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

  // Apple Maps gives the best same-device handoff on iOS/macOS; other clients
  // use Google Maps URLs so desktop browsers open a normal tab.
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
