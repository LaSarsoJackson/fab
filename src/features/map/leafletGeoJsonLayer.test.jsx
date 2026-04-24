/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LeafletGeoJsonLayer, getLeafletGeoJsonDataKey } from "./leafletGeoJsonLayer";

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
  };
});

describe("LeafletGeoJsonLayer", () => {
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
