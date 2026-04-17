/**
 * FAB map-engine contract v1.
 *
 * Application code should talk to this runtime surface rather than importing
 * Leaflet classes, DOM nodes, or provider SDK APIs directly. That keeps the
 * custom engine swappable with compatibility adapters such as Leaflet.
 */
export const MAP_RUNTIME_API_VERSION = 1;

export const MAP_RUNTIME_EVENTS = [
  "click",
  "hover",
  "moveend",
  "movestart",
  "zoomend",
  "zoomstart",
  "popupopen",
  "popupclose",
  "popupupdate",
];

export const MAP_BASEMAP_TYPES = [
  "raster-xyz",
  "pmtiles-vector",
];

export const MAP_LAYER_KINDS = [
  "geojson",
  "points",
];

export const MAP_SOURCE_FORMATS = [
  "geojson",
  "json",
  "pmtiles-vector",
  "geoparquet",
];

export const MAP_OPTIMIZATION_ARTIFACT_ROLES = [
  "source-of-truth",
  "search-index",
  "delivery-overlay",
  "columnar-canonical",
];

export const createBasemapSpec = (spec = {}) => ({
  id: spec.id || "",
  label: spec.label || "",
  type: spec.type || "raster-xyz",
  urlTemplate: spec.urlTemplate || "",
  rasterFallbackUrlTemplate: spec.rasterFallbackUrlTemplate || "",
  minZoom: Number.isFinite(spec.minZoom) ? spec.minZoom : 0,
  maxZoom: Number.isFinite(spec.maxZoom) ? spec.maxZoom : 22,
  tileSize: Number.isFinite(spec.tileSize) ? spec.tileSize : 256,
  attribution: spec.attribution || "",
});

export const createOverlaySourceSpec = (spec = {}) => ({
  id: spec.id || "",
  label: spec.label || "",
  type: spec.type || "geojson",
  format: spec.format || spec.type || "geojson",
  sourceModuleId: spec.sourceModuleId || "",
  publicPath: spec.publicPath || "",
  dataLayer: spec.dataLayer || "",
  geometryColumn: spec.geometryColumn || "geometry",
  featureNamespace: spec.featureNamespace || "",
  buildCommand: spec.buildCommand || "",
  status: spec.status || "active",
});

export const createOptimizationArtifactSpec = (spec = {}) => ({
  id: spec.id || "",
  label: spec.label || "",
  role: spec.role || "delivery-overlay",
  format: spec.format || "json",
  sourceModuleId: spec.sourceModuleId || "",
  publicPath: spec.publicPath || "",
  filePath: spec.filePath || "",
  buildCommand: spec.buildCommand || "",
  status: spec.status || "active",
  notes: spec.notes || "",
});

export const createLayerSpec = (spec = {}) => ({
  id: spec.id || "",
  kind: spec.kind || "geojson",
  interactive: Boolean(spec.interactive),
  ...spec,
});

export const createSelectionState = (selectionState = {}) => ({
  activeId: selectionState.activeId ?? null,
  hoveredId: selectionState.hoveredId ?? null,
  ids: Array.isArray(selectionState.ids) ? selectionState.ids : [],
});

export const createCameraState = (cameraState = {}) => ({
  center: cameraState.center || [0, 0],
  zoom: Number.isFinite(cameraState.zoom) ? cameraState.zoom : 0,
});

export const createPopupSpec = (popupSpec = {}) => ({
  id: popupSpec.id || "",
  coordinates: Array.isArray(popupSpec.coordinates) ? popupSpec.coordinates : null,
  anchorOffset: popupSpec.anchorOffset || [0, 0],
  meta: popupSpec.meta || null,
});

export const isMapRuntime = (value) => Boolean(value?.__fabMapRuntime === true);

export const getMapRuntimeDescriptor = (value) => (
  isMapRuntime(value)
    ? {
        kind: value.__runtimeKind || "",
        apiVersion: value.__runtimeApiVersion || MAP_RUNTIME_API_VERSION,
      }
    : null
);
