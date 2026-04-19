/**
 * Map runtime contract v1.
 *
 * This module is intentionally standalone-oriented: the symbols here describe
 * the public engine surface, not FAB-specific React wiring. FAB consumes this
 * contract, but other callers can do the same.
 *
 * Clean-room note:
 * - public method names intentionally line up with stable Leaflet concepts
 * - the contract is specified from public behavior, not copied internals
 * - FAB-specific manifests and profile registries live outside this module
 */
export const MAP_RUNTIME_API_VERSION = 1;
export const MAP_RUNTIME_SENTINEL = "__mapRuntimeContract";
export const MAP_RUNTIME_LEGACY_SENTINEL = "__fabMapRuntime";

export const CUSTOM_MAP_RUNTIME_KIND = "custom";
export const LEAFLET_ADAPTER_RUNTIME_KIND = "leaflet-adapter";

export const MAP_RUNTIME_KINDS = [
  CUSTOM_MAP_RUNTIME_KIND,
  LEAFLET_ADAPTER_RUNTIME_KIND,
];

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

export const MAP_RUNTIME_REQUIRED_METHODS = [
  "mount",
  "destroy",
  "setCamera",
  "fitBounds",
  "setBasemap",
  "setLayers",
  "setSelection",
  "openPopup",
  "closePopup",
  "on",
];

export const MAP_RUNTIME_OPTIONAL_METHODS = [
  "off",
  "once",
  "whenReady",
  "getContainer",
  "getZoom",
  "getCenter",
  "distance",
  "setView",
  "flyTo",
  "stop",
  "getBounds",
  "panInside",
  "setMaxBounds",
  "setMinZoom",
  "setMaxZoom",
  "invalidateSize",
  "addLayer",
  "removeLayer",
  "hasLayer",
  "removeControl",
  "zoomIn",
  "zoomOut",
];

export const MAP_BASEMAP_TYPES = [
  "raster-xyz",
  "pmtiles-vector",
];

export const MAP_LAYER_KINDS = [
  "geojson",
  "image",
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

/**
 * Return the versioned standalone contract descriptor.
 *
 * This is the highest-signal runtime introspection helper for callers that
 * want to inspect the engine surface without importing individual constants.
 */
export const getMapRuntimeContract = () => ({
  apiVersion: MAP_RUNTIME_API_VERSION,
  sentinel: MAP_RUNTIME_SENTINEL,
  legacySentinel: MAP_RUNTIME_LEGACY_SENTINEL,
  runtimeKinds: [...MAP_RUNTIME_KINDS],
  requiredMethods: [...MAP_RUNTIME_REQUIRED_METHODS],
  optionalMethods: [...MAP_RUNTIME_OPTIONAL_METHODS],
  events: [...MAP_RUNTIME_EVENTS],
  basemapTypes: [...MAP_BASEMAP_TYPES],
  layerKinds: [...MAP_LAYER_KINDS],
  sourceFormats: [...MAP_SOURCE_FORMATS],
  optimizationArtifactRoles: [...MAP_OPTIMIZATION_ARTIFACT_ROLES],
});

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

export const listMissingMapRuntimeMethods = (
  value,
  { includeOptional = false } = {}
) => {
  const methodsToCheck = includeOptional
    ? [...MAP_RUNTIME_REQUIRED_METHODS, ...MAP_RUNTIME_OPTIONAL_METHODS]
    : MAP_RUNTIME_REQUIRED_METHODS;

  return methodsToCheck.filter((methodName) => typeof value?.[methodName] !== "function");
};

export const isMapRuntime = (value) => Boolean(
  value?.[MAP_RUNTIME_SENTINEL] === true ||
  value?.[MAP_RUNTIME_LEGACY_SENTINEL] === true
);

/**
 * Assert that a value satisfies the exported map runtime contract.
 */
export const assertMapRuntimeContract = (
  value,
  { includeOptional = false, label = "value" } = {}
) => {
  if (!isMapRuntime(value)) {
    throw new Error(
      `Expected ${label} to expose ${MAP_RUNTIME_SENTINEL} === true (or legacy ${MAP_RUNTIME_LEGACY_SENTINEL} === true).`
    );
  }

  const missingMethods = listMissingMapRuntimeMethods(value, { includeOptional });
  if (!missingMethods.length) {
    return value;
  }

  const methodGroupLabel = includeOptional
    ? "required and optional"
    : "required";

  throw new Error(
    `Expected ${label} to implement all ${methodGroupLabel} map runtime methods. Missing: ${missingMethods.join(", ")}.`
  );
};

export const getMapRuntimeDescriptor = (value) => (
  isMapRuntime(value)
    ? {
        kind: value.__runtimeKind || "",
        apiVersion: value.__runtimeApiVersion || MAP_RUNTIME_API_VERSION,
      }
    : null
);
