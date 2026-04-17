import { describe, expect, test } from "bun:test";

import {
  createCustomMapRuntime,
  createLeafletMapRuntime,
  createOptimizationArtifactSpec,
  createOverlaySourceSpec,
  getMapRuntimeDescriptor,
  isMapRuntime,
  MAP_RUNTIME_API_VERSION,
} from "../src/features/map/engine";

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
    runtime.closePopup();

    expect(calls[0][0]).toBe("setView");
    expect(calls[1][0]).toBe("fitBounds");
    expect(calls[2][0]).toBe("closePopup");
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
