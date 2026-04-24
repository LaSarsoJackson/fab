/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LeafletBasemapLayer, isLeafletRasterBasemap } from "./leafletBasemapLayer";

jest.mock("react-leaflet", () => {
  const React = require("react");

  return {
    TileLayer: ({ url }) => {
      const mountedUrlRef = React.useRef(url);

      return <div data-testid="tile-layer" data-url={mountedUrlRef.current} />;
    },
  };
});

describe("LeafletBasemapLayer", () => {
  test("identifies profile raster basemaps", () => {
    expect(isLeafletRasterBasemap({
      id: "imagery",
      type: "raster-xyz",
      urlTemplate: "https://tiles.example.com/{z}/{x}/{y}.png",
    })).toBe(true);

    expect(isLeafletRasterBasemap({
      id: "burials-pmtiles",
      type: "pmtiles-vector",
      urlTemplate: "/data/geo_burials.pmtiles",
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
          id: "burials-pmtiles",
          type: "pmtiles-vector",
          urlTemplate: "/data/geo_burials.pmtiles",
        }}
      />
    );

    expect(screen.queryByTestId("tile-layer")).not.toBeInTheDocument();
  });
});

