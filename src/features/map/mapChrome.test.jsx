/** @jest-environment jsdom */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MapLayerControl, MapZoomControl, RouteStatusOverlay } from "./mapChrome";

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
});
