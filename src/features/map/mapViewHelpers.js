/**
 * Pure view helpers extracted from `Map.jsx`. These translate raw map inputs
 * (location candidates, basemap definitions, bounds, and route GeoJSON) into the
 * small derived values the map component renders from. Keeping them in their own
 * module lets the large map component stay focused on wiring while the geometry
 * and key logic stays unit-testable without a Leaflet runtime.
 */
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

import { APP_PROFILE } from "../fab/profile";
import { isLatLngBoundsExpressionValid } from "../../shared/geoJsonBounds";

const LOCATION_BUFFER_BOUNDARY = APP_PROFILE.map.locationBufferBoundary;

/**
 * Reports whether a geolocation candidate falls inside the cemetery buffer.
 * Off-site fixes are rejected so routing and recentering stay within the map.
 */
export const isLocationCandidateWithinBuffer = (candidate) => {
  if (!candidate) {
    return false;
  }

  return booleanPointInPolygon(
    point([candidate.longitude, candidate.latitude]),
    LOCATION_BUFFER_BOUNDARY
  );
};

/**
 * Accepts either a serializable bounds expression or a live Leaflet bounds
 * object, so callers can fit the map without first normalizing the shape.
 */
export const isRenderableBounds = (bounds) => (
  isLatLngBoundsExpressionValid(bounds) ||
  (typeof bounds?.isValid === "function" && bounds.isValid())
);

/**
 * Resolves the max zoom for a basemap, falling back to the caller-provided
 * default when the basemap does not pin its own ceiling.
 */
export const getMapMaxZoom = (basemap, fallbackZoom) => (
  Number.isFinite(basemap?.maxZoom) ? basemap.maxZoom : fallbackZoom
);

/**
 * Builds a stable render key from a route's coordinates so React only remounts
 * the active-route layer when the path actually changes.
 */
export const createRouteGeoJsonRenderKey = (geojson) => {
  const coordinates = geojson?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return "active-route";
  }

  return coordinates
    .map((coordinate) => (
      `${Number(coordinate?.[0]).toFixed(7)},${Number(coordinate?.[1]).toFixed(7)}`
    ))
    .join("|");
};
