/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  LeafletBasemapLayer,
  LeafletGeoJsonLayer,
  MapLayerControl,
  MapZoomControl,
  RouteStatusOverlay,
  getLeafletGeoJsonDataKey,
  isLeafletRasterBasemap,
} from "./mapChrome";

jest.mock("react-leaflet", () => {
  const React = require("react");

  return {
    GeoJSON: ({ data }) => {
      const mountedDataRef = React.useRef(data);

      return (
        <div
          data-testid="geojson-layer"
          data-feature-count={mountedDataRef.current?.features?.length || 0}
        />
      );
    },
    TileLayer: ({ url }) => {
      const mountedUrlRef = React.useRef(url);

      return <div data-testid="tile-layer" data-url={mountedUrlRef.current} />;
    },
    useMap: () => ({}),
  };
});

describe("mapChrome", () => {
  test("routes layer panel clicks to the matching callbacks", () => {
    const onBasemapChange = jest.fn();
    const onOpenChange = jest.fn();
    const onToggleOverlay = jest.fn();

    render(
      <MapLayerControl
        basemapOptions={[
          { id: "imagery", label: "Imagery" },
          { id: "streets", label: "Streets" },
        ]}
        activeBasemapId="imagery"
        isOpen
        onBasemapChange={onBasemapChange}
        onOpenChange={onOpenChange}
        overlayOptions={[
          { id: "roads", label: "Roads" },
        ]}
        overlayVisibility={{ roads: false }}
        onToggleOverlay={onToggleOverlay}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Streets" }));
    fireEvent.click(screen.getByRole("button", { name: "Roads" }));
    fireEvent.click(screen.getByRole("button", { name: "Close map layers" }));

    expect(onBasemapChange).toHaveBeenCalledWith("streets");
    expect(onToggleOverlay).toHaveBeenCalledWith("roads");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("hides desktop zoom buttons on mobile and wires click handlers on desktop", () => {
    const onZoomIn = jest.fn();
    const onZoomOut = jest.fn();
    const { rerender } = render(
      <MapZoomControl isMobile onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
    );

    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();

    rerender(
      <MapZoomControl isMobile={false} onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));

    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  test("reports route progress and route errors", () => {
    const { rerender } = render(
      <RouteStatusOverlay isCalculating routingError="" />
    );

    expect(screen.getByText("Calculating route...")).toBeInTheDocument();

    rerender(
      <RouteStatusOverlay isCalculating={false} routingError="Route unavailable" />
    );

    expect(screen.getByText("Route unavailable")).toBeInTheDocument();
  });

  test("identifies profile raster basemaps", () => {
    expect(isLeafletRasterBasemap({
      id: "imagery",
      type: "raster-xyz",
      urlTemplate: "https://tiles.example.com/{z}/{x}/{y}.png",
    })).toBe(true);

    expect(isLeafletRasterBasemap({
      id: "vector-detail",
      type: "vector",
      urlTemplate: "/data/vector-detail.bin",
    })).toBe(false);
  });

  test("remounts the tile layer when the selected basemap changes", () => {
    const { rerender } = render(
      <LeafletBasemapLayer
        basemap={{
          id: "imagery",
          type: "raster-xyz",
          urlTemplate: "https://imagery.example.com/{z}/{y}/{x}",
          minZoom: 0,
          maxZoom: 19,
          tileSize: 256,
        }}
      />
    );

    expect(screen.getByTestId("tile-layer")).toHaveAttribute(
      "data-url",
      "https://imagery.example.com/{z}/{y}/{x}"
    );

    rerender(
      <LeafletBasemapLayer
        basemap={{
          id: "streets",
          type: "raster-xyz",
          urlTemplate: "https://streets.example.com/{z}/{x}/{y}",
          minZoom: 0,
          maxZoom: 19,
          tileSize: 256,
        }}
      />
    );

    expect(screen.getByTestId("tile-layer")).toHaveAttribute(
      "data-url",
      "https://streets.example.com/{z}/{x}/{y}"
    );
  });

  test("skips non-raster basemap specs", () => {
    render(
      <LeafletBasemapLayer
        basemap={{
          id: "vector-detail",
          type: "vector",
          urlTemplate: "/data/vector-detail.bin",
        }}
      />
    );

    expect(screen.queryByTestId("tile-layer")).not.toBeInTheDocument();
  });

  test("returns a stable key for the same feature collection object", () => {
    const data = {
      type: "FeatureCollection",
      features: [],
    };

    expect(getLeafletGeoJsonDataKey(data)).toBe(getLeafletGeoJsonDataKey(data));
  });

  test("remounts GeoJSON when async-loaded data replaces the initial empty collection", () => {
    const emptyData = {
      type: "FeatureCollection",
      features: [],
    };
    const loadedData = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { id: "boundary" },
          geometry: {
            type: "Polygon",
            coordinates: [[[-73.74, 42.7], [-73.73, 42.7], [-73.73, 42.71], [-73.74, 42.7]]],
          },
        },
      ],
    };

    const { rerender } = render(
      <LeafletGeoJsonLayer
        layerId="boundary"
        data={emptyData}
      />
    );

    expect(screen.getByTestId("geojson-layer")).toHaveAttribute("data-feature-count", "0");

    rerender(
      <LeafletGeoJsonLayer
        layerId="boundary"
        data={loadedData}
      />
    );

    expect(screen.getByTestId("geojson-layer")).toHaveAttribute("data-feature-count", "1");
  });
});
