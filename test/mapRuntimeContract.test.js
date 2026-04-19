import { describe, expect, test } from "bun:test";

import {
  assertMapRuntimeContract,
  MAP_BASEMAP_TYPES,
  MAP_LAYER_KINDS,
  MAP_OPTIMIZATION_ARTIFACT_ROLES,
  createMapRuntime,
  createCustomMapRuntime,
  createLeafletMapRuntime,
  CUSTOM_MAP_RUNTIME_KIND,
  MAP_SOURCE_FORMATS,
  createOptimizationArtifactSpec,
  createOverlaySourceSpec,
  getMapRuntimeDescriptor,
  getMapRuntimeContract,
  isMapRuntime,
  LEAFLET_ADAPTER_RUNTIME_KIND,
  listMissingMapRuntimeMethods,
  MAP_RUNTIME_API_VERSION,
  MAP_RUNTIME_REQUIRED_METHODS,
} from "../src/features/map/engine/standalone";

describe("map runtime contract", () => {
  test("marks custom runtimes as FAB map runtimes", () => {
    const runtime = createCustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });

    expect(isMapRuntime(runtime)).toBe(true);
    expect(typeof runtime.mount).toBe("function");
    expect(typeof runtime.setCamera).toBe("function");
    expect(typeof runtime.fitBounds).toBe("function");
    expect(typeof runtime.setLayers).toBe("function");
    expect(typeof runtime.openPopup).toBe("function");
    expect(typeof runtime.on).toBe("function");
    expect(listMissingMapRuntimeMethods(runtime)).toEqual([]);
  });

  test("wraps a Leaflet-style map instance behind the same contract", () => {
    const calls = [];
    const leafletMap = {
      setView: (...args) => calls.push(["setView", ...args]),
      fitBounds: (...args) => calls.push(["fitBounds", ...args]),
      closePopup: (...args) => calls.push(["closePopup", ...args]),
      on: (...args) => calls.push(["on", ...args]),
      off: (...args) => calls.push(["off", ...args]),
      once: (...args) => calls.push(["once", ...args]),
      whenReady: (...args) => calls.push(["whenReady", ...args]),
      getContainer: () => ({}),
      getZoom: () => 14,
      getCenter: () => ({ lat: 42.70418, lng: -73.73198 }),
      distance: () => 120,
      panInside: (...args) => calls.push(["panInside", ...args]),
      setMaxBounds: (...args) => calls.push(["setMaxBounds", ...args]),
      setMinZoom: (...args) => calls.push(["setMinZoom", ...args]),
      setMaxZoom: (...args) => calls.push(["setMaxZoom", ...args]),
      invalidateSize: (...args) => calls.push(["invalidateSize", ...args]),
      addLayer: (...args) => calls.push(["addLayer", ...args]),
      removeLayer: (...args) => calls.push(["removeLayer", ...args]),
      hasLayer: () => true,
      removeControl: (...args) => calls.push(["removeControl", ...args]),
      zoomIn: () => calls.push(["zoomIn"]),
      zoomOut: () => calls.push(["zoomOut"]),
      flyTo: (...args) => calls.push(["flyTo", ...args]),
      stop: () => calls.push(["stop"]),
      getBounds: () => ({
        isValid: () => true,
        getSouth: () => 42.7,
        getWest: () => -73.74,
        getNorth: () => 42.71,
        getEast: () => -73.72,
      }),
    };

    const runtime = createLeafletMapRuntime(leafletMap);

    expect(isMapRuntime(runtime)).toBe(true);
    runtime.setCamera({
      center: [42.70418, -73.73198],
      zoom: 14,
    });
    runtime.fitBounds([[42.7, -73.74], [42.71, -73.72]]);
    runtime.setMaxBounds([[42.7, -73.74], [42.71, -73.72]]);
    runtime.setMinZoom(13);
    runtime.setMaxZoom(25);
    runtime.invalidateSize();
    runtime.closePopup();

    expect(calls[0][0]).toBe("setView");
    expect(calls[1][0]).toBe("fitBounds");
    expect(calls[2][0]).toBe("setMaxBounds");
    expect(calls[3][0]).toBe("setMinZoom");
    expect(calls[4][0]).toBe("setMaxZoom");
    expect(calls[5][0]).toBe("invalidateSize");
    expect(calls[6][0]).toBe("closePopup");
  });

  test("exposes a stable runtime descriptor for compatibility adapters and custom runtimes", () => {
    const runtime = createCustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });

    expect(getMapRuntimeDescriptor(runtime)).toEqual({
      kind: "custom",
      apiVersion: MAP_RUNTIME_API_VERSION,
    });
  });

  test("reports the Leaflet runtime as the production compatibility adapter", () => {
    const runtime = createLeafletMapRuntime({
      setView: () => undefined,
    });

    expect(getMapRuntimeDescriptor(runtime)).toEqual({
      kind: "leaflet-adapter",
      apiVersion: MAP_RUNTIME_API_VERSION,
    });
  });

  test("publishes a standalone-friendly contract descriptor", () => {
    expect(getMapRuntimeContract()).toMatchObject({
      apiVersion: MAP_RUNTIME_API_VERSION,
      runtimeKinds: [CUSTOM_MAP_RUNTIME_KIND, LEAFLET_ADAPTER_RUNTIME_KIND],
      requiredMethods: MAP_RUNTIME_REQUIRED_METHODS,
      basemapTypes: MAP_BASEMAP_TYPES,
      layerKinds: MAP_LAYER_KINDS,
      sourceFormats: MAP_SOURCE_FORMATS,
      optimizationArtifactRoles: MAP_OPTIMIZATION_ARTIFACT_ROLES,
    });
  });

  test("can assert the runtime contract with a concrete error message", () => {
    const runtime = createCustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });

    expect(assertMapRuntimeContract(runtime)).toBe(runtime);
    expect(() => assertMapRuntimeContract({}, { label: "runtime" })).toThrow(
      "Expected runtime to expose __mapRuntimeContract === true"
    );
    expect(() => assertMapRuntimeContract({
      __mapRuntimeContract: true,
      mount: () => undefined,
    }, { label: "runtime" })).toThrow(
      "Missing: destroy, setCamera, fitBounds, setBasemap, setLayers, setSelection, openPopup, closePopup, on."
    );
  });

  test("can create runtimes by kind through the standalone factory", () => {
    const customRuntime = createMapRuntime(CUSTOM_MAP_RUNTIME_KIND, {
      center: [42.70418, -73.73198],
      zoom: 14,
    });
    expect(getMapRuntimeDescriptor(customRuntime)).toEqual({
      kind: CUSTOM_MAP_RUNTIME_KIND,
      apiVersion: MAP_RUNTIME_API_VERSION,
    });

    const adapterRuntime = createMapRuntime(LEAFLET_ADAPTER_RUNTIME_KIND, {
      leafletMap: {
        setView: () => undefined,
      },
    });
    expect(getMapRuntimeDescriptor(adapterRuntime)).toEqual({
      kind: LEAFLET_ADAPTER_RUNTIME_KIND,
      apiVersion: MAP_RUNTIME_API_VERSION,
    });
  });

  test("normalizes overlay-source and optimization-artifact specs for engine documentation", () => {
    expect(createOverlaySourceSpec({
      id: "burials",
      type: "pmtiles-vector",
      publicPath: "/data/geo_burials.pmtiles",
    })).toEqual({
      id: "burials",
      label: "",
      type: "pmtiles-vector",
      format: "pmtiles-vector",
      sourceModuleId: "",
      publicPath: "/data/geo_burials.pmtiles",
      dataLayer: "",
      geometryColumn: "geometry",
      featureNamespace: "",
      buildCommand: "",
      status: "active",
    });

    expect(createOptimizationArtifactSpec({
      id: "burials-geoparquet",
      format: "geoparquet",
      role: "columnar-canonical",
      filePath: "src/data/Geo_Burials.parquet",
    })).toEqual({
      id: "burials-geoparquet",
      label: "",
      role: "columnar-canonical",
      format: "geoparquet",
      sourceModuleId: "",
      publicPath: "",
      filePath: "src/data/Geo_Burials.parquet",
      buildCommand: "",
      status: "active",
      notes: "",
    });
  });
});
