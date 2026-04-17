/** @jest-environment jsdom */

import React from "react";
import { render } from "@testing-library/react";

import { CustomMapSurface } from "./CustomMapSurface";

const mockCreateCustomMapRuntime = jest.fn();

jest.mock("./customRuntime", () => ({
  createCustomMapRuntime: (...args) => mockCreateCustomMapRuntime(...args),
}));

const sectionsData = {
  type: "FeatureCollection",
  features: [],
};

const baseProps = {
  activeBurialId: null,
  basemap: {
    id: "osm",
    type: "raster-xyz",
    urlTemplate: "https://tiles.test/{z}/{x}/{y}.png",
  },
  boundaryData: sectionsData,
  defaultCenter: [42.70418, -73.73198],
  defaultZoom: 14,
  hoveredBurialId: null,
  lat: null,
  lng: null,
  mapRef: { current: null },
  markerColors: ["#e41a1c"],
  maxBounds: null,
  onActivateSectionBrowse: jest.fn(),
  onHoverBurialChange: jest.fn(),
  onOpenDirectionsMenu: jest.fn(),
  onRemoveSelectedBurial: jest.fn(),
  onSelectBurial: jest.fn(),
  onZoomChange: jest.fn(),
  roadsData: sectionsData,
  schedulePopupLayout: jest.fn(),
  sectionBurials: [],
  sectionFilter: "",
  sectionsData,
  selectedBurials: [
    {
      id: "anna-tracy",
      coordinates: [-73.73198, 42.70418],
    },
  ],
  selectedMarkerLayersRef: { current: new Map() },
  selectedTourResults: [],
  shouldUseMapPopups: false,
  showAllBurials: false,
  showBoundary: true,
  showRoads: true,
  showSections: true,
  tourFeatureLayersRef: { current: new Map() },
  tourStyles: {},
};

describe("CustomMapSurface", () => {
  let runtime;

  beforeEach(() => {
    runtime = {
      mount: jest.fn(),
      fitBounds: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      setBasemap: jest.fn(),
      setLayers: jest.fn(),
      setSelection: jest.fn(),
      getPopupState: jest.fn(() => null),
      getPopupScreenPoint: jest.fn(() => null),
      popupHandle: { close: jest.fn(), update: jest.fn() },
      selectionState: {
        activeId: null,
        hoveredId: null,
        ids: [],
      },
    };
    mockCreateCustomMapRuntime.mockReset();
    mockCreateCustomMapRuntime.mockImplementation(() => runtime);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("updates hover through selection state without rebuilding layers", () => {
    const { rerender, unmount } = render(<CustomMapSurface {...baseProps} />);

    expect(runtime.setLayers).toHaveBeenCalledTimes(1);
    expect(runtime.setSelection).toHaveBeenCalledWith({
      activeId: null,
      hoveredId: null,
      ids: ["anna-tracy"],
    });

    rerender(
      <CustomMapSurface
        {...baseProps}
        hoveredBurialId="anna-tracy"
      />
    );

    expect(runtime.setLayers).toHaveBeenCalledTimes(1);
    expect(runtime.setSelection).toHaveBeenLastCalledWith({
      activeId: null,
      hoveredId: "anna-tracy",
      ids: ["anna-tracy"],
    });

    unmount();
    expect(runtime.destroy).toHaveBeenCalledTimes(1);
  });
});
