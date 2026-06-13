/**
 * Builds a stable React render key for an active walking-route GeoJSON.
 *
 * The map memoizes the rendered route layer on this key so it only re-renders
 * when the underlying route coordinates actually change. Returns a constant
 * fallback when the GeoJSON carries no usable coordinates.
 *
 * This module owns the pure render-key derivation only; it does not own route
 * calculation (see mapRouting.js), map rendering, or React state.
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
