import {
  LEAFLET_ADAPTER_RUNTIME_KIND,
  MAP_RUNTIME_SENTINEL,
  MAP_RUNTIME_LEGACY_SENTINEL,
  createBasemapSpec,
  createCameraState,
  createLayerSpec,
  MAP_RUNTIME_API_VERSION,
  createPopupSpec,
  createSelectionState,
} from "./contracts";

const bindMethod = (target, methodName, fallback) => {
  if (typeof target?.[methodName] !== "function") {
    return fallback || (() => undefined);
  }

  return target[methodName].bind(target);
};

/**
 * Wrap a Leaflet map behind the standalone engine contract.
 *
 * This adapter is intentionally thin: it preserves the public contract while
 * keeping Leaflet out of upstream app code.
 */
export const createLeafletMapRuntime = (leafletMap) => ({
  [MAP_RUNTIME_SENTINEL]: true,
  [MAP_RUNTIME_LEGACY_SENTINEL]: true,
  __runtimeKind: LEAFLET_ADAPTER_RUNTIME_KIND,
  __runtimeApiVersion: MAP_RUNTIME_API_VERSION,
  rawMap: leafletMap,
  mount: () => leafletMap,
  destroy: () => undefined,
  setCamera: (cameraState) => {
    const nextCamera = createCameraState(cameraState);
    return leafletMap.setView(nextCamera.center, nextCamera.zoom, { animate: false });
  },
  fitBounds: bindMethod(leafletMap, "fitBounds"),
  setBasemap: (basemapSpec) => createBasemapSpec(basemapSpec),
  setLayers: (layerSpecs) => (Array.isArray(layerSpecs) ? layerSpecs.map(createLayerSpec) : []),
  setSelection: (selectionState) => createSelectionState(selectionState),
  openPopup: (popupSpec) => createPopupSpec(popupSpec),
  closePopup: bindMethod(leafletMap, "closePopup"),
  on: bindMethod(leafletMap, "on"),
  off: bindMethod(leafletMap, "off"),
  once: bindMethod(leafletMap, "once"),
  whenReady: bindMethod(leafletMap, "whenReady"),
  getContainer: bindMethod(leafletMap, "getContainer"),
  getZoom: bindMethod(leafletMap, "getZoom", () => 0),
  getCenter: bindMethod(leafletMap, "getCenter", () => ({ lat: 0, lng: 0 })),
  distance: bindMethod(leafletMap, "distance", () => 0),
  setView: bindMethod(leafletMap, "setView"),
  flyTo: bindMethod(leafletMap, "flyTo"),
  stop: bindMethod(leafletMap, "stop"),
  getBounds: bindMethod(leafletMap, "getBounds"),
  panInside: bindMethod(leafletMap, "panInside"),
  setMaxBounds: bindMethod(leafletMap, "setMaxBounds"),
  setMinZoom: bindMethod(leafletMap, "setMinZoom"),
  setMaxZoom: bindMethod(leafletMap, "setMaxZoom"),
  invalidateSize: bindMethod(leafletMap, "invalidateSize"),
  addLayer: bindMethod(leafletMap, "addLayer"),
  removeLayer: bindMethod(leafletMap, "removeLayer"),
  hasLayer: bindMethod(leafletMap, "hasLayer", () => false),
  removeControl: bindMethod(leafletMap, "removeControl"),
  zoomIn: bindMethod(leafletMap, "zoomIn"),
  zoomOut: bindMethod(leafletMap, "zoomOut"),
});
