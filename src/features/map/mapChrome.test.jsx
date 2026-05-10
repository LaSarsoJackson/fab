/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  LeafletBasemapLayer,
  LeafletGeoJsonLayer,
  MapLayerControl,
  MapSectionAffordanceMarkers,
  MapSectionClusterMarkers,
  SidebarToggleControl,
  MapZoomControl,
  RouteStatusOverlay,
  createCemeteryClusterIcon,
  getLeafletGeoJsonDataKey,
  isLeafletImageBasemap,
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
    ImageOverlay: ({
      attribution,
      bounds,
      className,
      url,
    }) => (
      <div
        data-testid="image-overlay"
        data-attribution={attribution}
        data-bounds={JSON.stringify(bounds)}
        data-class-name={className}
        data-url={url}
      />
    ),
    TileLayer: ({
      className,
      keepBuffer,
      maxNativeZoom,
      maxZoom,
      updateWhenIdle,
      updateWhenZooming,
      url,
    }) => {
      const mountedUrlRef = React.useRef(url);

      return (
        <div
          data-testid="tile-layer"
          data-url={mountedUrlRef.current}
          data-class-name={className}
          data-keep-buffer={String(keepBuffer)}
          data-max-native-zoom={String(maxNativeZoom)}
          data-max-zoom={String(maxZoom)}
          data-update-when-idle={String(updateWhenIdle)}
          data-update-when-zooming={String(updateWhenZooming)}
        />
      );
    },
    Marker: ({ children, icon, position }) => (
      <div
        data-testid="leaflet-marker"
        data-icon-html={icon?.options?.html || ""}
        data-position={JSON.stringify(position)}
      >
        {children}
      </div>
    ),
    Tooltip: ({ children }) => <span>{children}</span>,
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
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("data-placement", "desktop-bottom");

    rerender(
      <RouteStatusOverlay isCalculating={false} isMobile routingError="Route unavailable" />
    );

    const status = screen.getByRole("status");
    expect(screen.getByText("Route unavailable")).toBeInTheDocument();
    expect(status).toHaveAttribute("aria-live", "assertive");
    expect(status).toHaveAttribute("data-placement", "mobile-top");
    expect(status).toHaveClass("route-status-overlay--mobile");
  });

  test("toggles the search panel with explicit accessible labels", () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <SidebarToggleControl isSearchPanelVisible onToggle={onToggle} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide search panel" }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <SidebarToggleControl isSearchPanelVisible={false} onToggle={onToggle} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show search panel" }));
    expect(onToggle).toHaveBeenCalledTimes(2);
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

  test("identifies static image basemaps", () => {
    expect(isLeafletImageBasemap({
      id: "imagery",
      type: "image-overlay",
      imageUrl: "/basemaps/cemetery.jpg",
      bounds: [[42.69, -73.74], [42.72, -73.72]],
    })).toBe(true);

    expect(isLeafletImageBasemap({
      id: "imagery",
      type: "image-overlay",
      imageOverlays: [{
        imageUrl: "/basemaps/overview.jpg",
        bounds: [[42.66, -73.82], [42.75, -73.64]],
      }],
    })).toBe(true);

    expect(isLeafletImageBasemap({
      id: "imagery",
      type: "image-overlay",
      imageUrl: "/basemaps/cemetery.jpg",
    })).toBe(false);
  });

  test("renders static ortho imagery without a tile grid", () => {
    render(
      <LeafletBasemapLayer
        basemap={{
          id: "imagery",
          type: "image-overlay",
          imageUrl: "/basemaps/cemetery.jpg",
          bounds: [[42.69418, -73.74198], [42.71418, -73.72198]],
          attribution: "NYS ITS Geospatial Services",
        }}
      />
    );

    expect(screen.getByTestId("image-overlay")).toHaveAttribute(
      "data-url",
      "/basemaps/cemetery.jpg"
    );
    expect(screen.getByTestId("image-overlay")).toHaveAttribute(
      "data-class-name",
      "leaflet-basemap-image"
    );
    expect(screen.queryByTestId("tile-layer")).not.toBeInTheDocument();
  });

  test("renders static ortho stacks above a raster imagery fallback", () => {
    render(
      <LeafletBasemapLayer
        basemap={{
          id: "imagery",
          type: "image-overlay",
          fallbackRaster: {
            id: "imagery-fallback",
            type: "raster-xyz",
            urlTemplate: "https://imagery.example.com/{z}/{y}/{x}",
            minZoom: 0,
            maxNativeZoom: 19,
            maxZoom: 20,
            tileSize: 256,
          },
          imageOverlays: [
            {
              id: "overview",
              imageUrl: "/basemaps/overview.jpg",
              bounds: [[42.66, -73.82], [42.75, -73.64]],
            },
            {
              id: "detail",
              imageUrl: "/basemaps/detail.jpg",
              bounds: [[42.6878, -73.7527], [42.7245, -73.7119]],
            },
          ],
          attribution: "NYS ITS Geospatial Services",
        }}
      />
    );

    expect(screen.getByTestId("tile-layer")).toHaveAttribute(
      "data-url",
      "https://imagery.example.com/{z}/{y}/{x}"
    );
    expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-max-native-zoom", "19");
    const overlays = screen.getAllByTestId("image-overlay");
    expect(overlays).toHaveLength(2);
    expect(overlays[0]).toHaveAttribute("data-url", "/basemaps/overview.jpg");
    expect(overlays[1]).toHaveAttribute("data-url", "/basemaps/detail.jpg");
  });

  test("remounts the tile layer when the selected basemap changes", () => {
    const { rerender } = render(
      <LeafletBasemapLayer
        basemap={{
          id: "imagery",
          type: "raster-xyz",
          urlTemplate: "https://imagery.example.com/{z}/{y}/{x}",
          minZoom: 0,
          maxNativeZoom: 19,
          maxZoom: 20,
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

  test("keeps a larger basemap buffer during map movement", () => {
    render(
      <LeafletBasemapLayer
        basemap={{
          id: "imagery",
          type: "raster-xyz",
          urlTemplate: "https://imagery.example.com/{z}/{y}/{x}",
          minZoom: 0,
          maxNativeZoom: 19,
          maxZoom: 20,
          tileSize: 256,
        }}
      />
    );

    expect(screen.getByTestId("tile-layer")).toHaveAttribute(
      "data-class-name",
      "leaflet-basemap-tile"
    );
    expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-keep-buffer", "4");
    expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-max-native-zoom", "19");
    expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-max-zoom", "20");
    expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-update-when-idle", "false");
    expect(screen.getByTestId("tile-layer")).toHaveAttribute("data-update-when-zooming", "false");
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

  test("uses the shared neutral section marker glyph for affordance and cluster icons", () => {
    render(
      <>
        <MapSectionAffordanceMarkers
          markers={[{
            id: "section-affordance:4",
            sectionValue: "4",
            count: 25,
            size: 28,
            lat: 42.7055,
            lng: -73.7335,
            bounds: [[42.704, -73.735], [42.707, -73.732]],
          }]}
        />
        <MapSectionClusterMarkers
          markers={[{
            id: "section-overview:7",
            sectionValue: "7",
            count: 1284,
            lat: 42.7085,
            lng: -73.7305,
            bounds: [[42.708, -73.731], [42.709, -73.73]],
          }]}
        />
      </>
    );

    const [affordanceMarker, clusterMarker] = screen.getAllByTestId("leaflet-marker");
    const affordanceHtml = affordanceMarker.getAttribute("data-icon-html");
    const clusterHtml = clusterMarker.getAttribute("data-icon-html");

    expect(affordanceHtml).toContain("section-marker-glyph");
    expect(clusterHtml).toContain("section-marker-glyph");
    expect(clusterHtml).toContain("section-cluster");
    expect(clusterHtml).toContain("cemetery-cluster--massive");
    expect(clusterHtml).not.toContain("cemetery-cluster--burial");
    expect(clusterHtml).toContain("cemetery-cluster__count");
    expect(clusterHtml).toContain("1.3k");
    expect(`${affordanceHtml}${clusterHtml}`).not.toContain("M13.2 12.2H19.8");
    expect(`${affordanceHtml}${clusterHtml}`).not.toContain("M16.5 9.4V15");
  });

  test("keeps exact cemetery burial cluster counts on the foreground cluster icon", () => {
    const icon = createCemeteryClusterIcon({ count: 42 });

    expect(icon.options.html).toContain("section-marker-glyph");
    expect(icon.options.html).toContain("cemetery-cluster--burial");
    expect(icon.options.html).toContain("cemetery-cluster--dense");
    expect(icon.options.html).toContain('data-density-label="20 to 49 records"');
    expect(icon.options.html).toContain("cemetery-cluster__count");
    expect(icon.options.html).toContain(">42<");
    expect(icon.options.iconSize).toEqual([37, 37]);
    expect(icon.options.html).not.toContain("M13.2 12.2H19.8");
    expect(icon.options.html).not.toContain("M16.5 9.4V15");
  });

  test("scales burial cluster icons by close-range density", () => {
    expect(createCemeteryClusterIcon({ count: 4 }).options).toMatchObject({
      iconSize: [31, 31],
      iconAnchor: [15.5, 15.5],
    });
    expect(createCemeteryClusterIcon({ count: 7 }).options).toMatchObject({
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    expect(createCemeteryClusterIcon({ count: 12 }).options).toMatchObject({
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    expect(createCemeteryClusterIcon({ count: 23 }).options.html).toContain(
      "cemetery-cluster--dense"
    );
    expect(createCemeteryClusterIcon({ count: 52 }).options).toMatchObject({
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
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
