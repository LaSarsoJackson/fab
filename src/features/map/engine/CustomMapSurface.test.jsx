/** @jest-environment jsdom */

import React from "react";
import { act, render } from "@testing-library/react";

import { CustomMapSurface } from "./CustomMapSurface";
import { MAP_PRESENTATION_POLICY } from "../mapDomain";

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
  onPopupClose: jest.fn(),
  onPopupOpen: jest.fn(),
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
  showRoads: false,
  showSections: true,
  tourFeatureLayersRef: { current: new Map() },
  tourStyles: {},
};

describe("CustomMapSurface", () => {
  let runtime;
  let runtimeListeners;

  beforeEach(() => {
    runtimeListeners = new Map();
    runtime = {
      mount: jest.fn(),
      fitBounds: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn((eventName, handler) => {
        runtimeListeners.set(eventName, handler);
      }),
      off: jest.fn((eventName, handler) => {
        if (runtimeListeners.get(eventName) === handler) {
          runtimeListeners.delete(eventName);
        }
      }),
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

  test("reports popup open and close transitions with the focused record", () => {
    const onPopupOpen = jest.fn();
    const onPopupClose = jest.fn();

    render(
      <CustomMapSurface
        {...baseProps}
        onPopupClose={onPopupClose}
        onPopupOpen={onPopupOpen}
        shouldUseMapPopups
      />
    );

    const popupRecord = {
      id: "anna-tracy",
      coordinates: [-73.73198, 42.70418],
    };

    runtime.getPopupState.mockReturnValue({
      coordinates: popupRecord.coordinates,
      meta: { record: popupRecord },
    });
    runtime.getPopupScreenPoint.mockReturnValue({ x: 200, y: 180 });

    act(() => {
      runtimeListeners.get("popupopen")?.({ popup: runtime.popupHandle });
    });

    expect(onPopupOpen).toHaveBeenCalledWith(popupRecord);
    expect(onPopupClose).not.toHaveBeenCalled();

    runtime.getPopupState.mockReturnValue(null);
    runtime.getPopupScreenPoint.mockReturnValue(null);

    act(() => {
      runtimeListeners.get("popupclose")?.({ popup: runtime.popupHandle });
    });

    expect(onPopupClose).toHaveBeenCalledWith(popupRecord);
  });

  test("configures section burials to uncluster at terminal zoom without offsetting markers", () => {
    const sectionBurial = {
      id: "grave-a",
      Section: "107",
      Grave: 3,
      Tier: 2,
      coordinates: [-73.73198, 42.70418],
    };

    render(
      <CustomMapSurface
        {...baseProps}
        maxZoom={19}
        showAllBurials
        sectionFilter="107"
        sectionBurials={[sectionBurial]}
      />
    );

    const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    const sectionBurialsLayer = layerSpecs.find((layer) => layer.id === "section-burials");

    expect(sectionBurialsLayer).toBeDefined();
    expect(sectionBurialsLayer.clusterRadius).toBe(MAP_PRESENTATION_POLICY.sectionBurialClusterRadius);
    expect(sectionBurialsLayer.disableClusteringAtZoom).toBe(19);

    const pointStyle = sectionBurialsLayer.pointStyle(
      { id: sectionBurial.id, record: sectionBurial },
      { getZoom: () => 19 }
    );

    expect(pointStyle.offsetX).toBeUndefined();
    expect(pointStyle.offsetY).toBeUndefined();
    expect(pointStyle.guideColor).toBeUndefined();
  });

  test("expands section burial clusters to the individual marker zoom", () => {
    const sectionBurials = [
      {
        id: "grave-a",
        Section: "107",
        coordinates: [-73.73198, 42.70418],
      },
      {
        id: "grave-b",
        Section: "107",
        coordinates: [-73.73196, 42.7042],
      },
    ];

    render(
      <CustomMapSurface
        {...baseProps}
        maxZoom={19}
        showAllBurials
        sectionFilter="107"
        sectionBurials={sectionBurials}
      />
    );

    const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    const sectionBurialsLayer = layerSpecs.find((layer) => layer.id === "section-burials");
    const fitBounds = jest.fn();
    const setView = jest.fn();

    sectionBurialsLayer.onClusterClick({
      target: {
        pointEntry: {
          members: sectionBurials.map((record) => ({
            coordinates: record.coordinates,
            record,
          })),
        },
      },
      runtime: {
        fitBounds,
        getZoom: () => 17,
        setView,
      },
    });

    expect(setView).toHaveBeenCalledWith(expect.objectContaining({
      lat: expect.any(Number),
      lng: expect.any(Number),
    }), 19);
    expect(fitBounds).not.toHaveBeenCalled();
  });

  test("gives hovered burial markers stronger hit targets and visual emphasis", () => {
    const sectionBurial = {
      id: "grave-a",
      Section: "107",
      Grave: 3,
      Tier: 2,
      coordinates: [-73.73198, 42.70418],
    };

    render(
      <CustomMapSurface
        {...baseProps}
        hoveredBurialId="grave-a"
        showAllBurials
        sectionFilter="107"
        sectionBurials={[sectionBurial]}
      />
    );

    const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    const sectionBurialsLayer = layerSpecs.find((layer) => layer.id === "section-burials");
    const basePointStyle = sectionBurialsLayer.pointStyle(
      { id: sectionBurial.id, record: sectionBurial },
      {
        getZoom: () => 18,
        selectionState: {
          activeId: null,
          hoveredId: null,
        },
      }
    );
    const pointStyle = sectionBurialsLayer.pointStyle(
      { id: sectionBurial.id, record: sectionBurial },
      {
        getZoom: () => 18,
        selectionState: {
          activeId: null,
          hoveredId: "grave-a",
        },
      }
    );

    expect(pointStyle.radius).toBeGreaterThan(basePointStyle.radius);
    expect(pointStyle.hitRadius).toBeGreaterThan(basePointStyle.hitRadius);
    expect(pointStyle.fillOpacity).toBeGreaterThan(basePointStyle.fillOpacity);
  });

  test("keeps roads hidden unless explicitly enabled", () => {
    render(
      <CustomMapSurface
        {...baseProps}
        showRoads={undefined}
      />
    );

    const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    expect(layerSpecs.some((layer) => layer.id === "roads")).toBe(false);
  });

  test("shows section affordance markers before a section is selected", () => {
    const affordanceMarker = {
      id: "section-affordance:107",
      sectionValue: "107",
      lat: 42.70418,
      lng: -73.73198,
      bounds: [[42.7038, -73.7323], [42.7045, -73.7316]],
    };

    render(
      <CustomMapSurface
        {...baseProps}
        sectionAffordanceMarkers={[affordanceMarker]}
        showSectionAffordanceMarkers
      />
    );

    const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    const sectionAffordanceLayer = layerSpecs.find((layer) => layer.id === "section-affordances");

    expect(sectionAffordanceLayer).toBeDefined();
    expect(sectionAffordanceLayer.points).toHaveLength(1);
    expect(sectionAffordanceLayer.pointStyle.variant).toBe("grave-affordance");
  });

  test("does not treat hovered clusters as hovered burials", () => {
    const onHoverBurialChange = jest.fn();

    render(
      <CustomMapSurface
        {...baseProps}
        onHoverBurialChange={onHoverBurialChange}
      />
    );

    act(() => {
      runtimeListeners.get("hover")?.({
        target: {
          kind: "cluster",
          layerId: "section-burials",
          pointEntry: {
            id: "cluster:section-burials:1",
          },
        },
      });
    });

    expect(onHoverBurialChange).toHaveBeenCalledWith(null);
  });

  test("shows burial counts in section overview labels once the marker is visible or hovered", () => {
    render(
      <CustomMapSurface
        {...baseProps}
        sectionOverviewMarkers={[
          {
            id: "section-overview:49",
            sectionValue: "49",
            count: 1284,
            lat: 42.70418,
            lng: -73.73198,
            bounds: [
              [42.7038, -73.7324],
              [42.7045, -73.7315],
            ],
          },
        ]}
        showSectionOverviewMarkers
      />
    );

    let layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    let overviewLayer = layerSpecs.find((layer) => layer.id === "section-overview");
    expect(overviewLayer).toBeDefined();
    expect(
      overviewLayer.pointStyle(overviewLayer.points[0], { getZoom: () => 16 }).labelText
    ).toBe("Section 49 • 1,284 burials");

    act(() => {
      runtimeListeners.get("hover")?.({
        target: {
          layerId: "section-overview",
          pointEntry: {
            record: {
              sectionValue: "49",
            },
          },
        },
      });
    });

    layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    overviewLayer = layerSpecs.find((layer) => layer.id === "section-overview");
    expect(
      overviewLayer.pointStyle(overviewLayer.points[0], { getZoom: () => 15 }).labelText
    ).toBe("Section 49 • 1,284 burials");

    act(() => {
      runtimeListeners.get("hover")?.({ target: null });
    });

    layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    overviewLayer = layerSpecs.find((layer) => layer.id === "section-overview");
    expect(
      overviewLayer.pointStyle(overviewLayer.points[0], { getZoom: () => 15 }).labelText
    ).toBe("");
  });

  test("adds the site twin surface and clustered monument candidates when enabled", () => {
    const siteTwinManifest = {
      status: "ready",
      terrainImage: {
        url: "/data/site_twin/terrain_surface.png",
        bounds: [
          [42.69418, -73.74198],
          [42.71418, -73.72198],
        ],
        opacity: 0.9,
      },
      graveCandidates: {
        url: "/data/site_twin/grave_candidates.geojson",
        count: 2,
      },
    };
    const siteTwinCandidates = {
      type: "FeatureCollection",
      features: [
        {
          id: "known-headstone-1",
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-73.73198, 42.70418],
          },
          properties: {
            knownHeadstone: true,
            heightMeters: 0.84,
            confidence: 0.96,
          },
        },
        {
          id: "grave-candidate-2",
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-73.73148, 42.70448],
          },
          properties: {
            knownHeadstone: false,
            heightMeters: 0.48,
            confidence: 0.51,
          },
        },
      ],
    };

    render(
      <CustomMapSurface
        {...baseProps}
        showSiteTwin
        showSiteTwinSurface
        showSiteTwinMonuments
        siteTwinManifest={siteTwinManifest}
        siteTwinCandidates={siteTwinCandidates}
        siteTwinSurfaceOpacity={0.57}
        siteTwinMonumentHeightScale={1.75}
      />
    );

    const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
    const siteTwinSurfaceLayer = layerSpecs.find((layer) => layer.id === "site-twin-surface");
    const siteTwinMonumentsLayer = layerSpecs.find((layer) => layer.id === "site-twin-monuments");

    expect(siteTwinSurfaceLayer).toMatchObject({
      id: "site-twin-surface",
      kind: "image",
      url: "/data/site_twin/terrain_surface.png",
      bounds: [
        [42.69418, -73.74198],
        [42.71418, -73.72198],
      ],
      opacity: 0.57,
    });
    expect(siteTwinMonumentsLayer).toMatchObject({
      id: "site-twin-monuments",
      kind: "points",
      clustered: true,
      clusterRadius: 28,
      disableClusteringAtZoom: 18,
    });
    expect(siteTwinMonumentsLayer.points).toHaveLength(2);

    const pointStyle = siteTwinMonumentsLayer.pointStyle(siteTwinMonumentsLayer.points[0], {
      getZoom: () => 19,
    });
    expect(pointStyle.variant).toBe("monument");
    expect(pointStyle.baseWidthMeters).toBeGreaterThan(1);
    expect(pointStyle.heightMeters).toBe(0.84);
    expect(pointStyle.heightScale).toBe(1.75);
  });

  test("prefixes site twin surface assets with the configured public url", () => {
    const originalPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "/fab";

    try {
      render(
        <CustomMapSurface
          {...baseProps}
          showSiteTwin
          showSiteTwinSurface
          siteTwinManifest={{
            status: "ready",
            terrainImage: {
              url: "/data/site_twin/terrain_surface.png",
              bounds: [
                [42.69418, -73.74198],
                [42.71418, -73.72198],
              ],
              opacity: 0.9,
            },
          }}
          siteTwinCandidates={{ type: "FeatureCollection", features: [] }}
        />
      );

      const layerSpecs = runtime.setLayers.mock.calls.at(-1)?.[0] || [];
      const siteTwinSurfaceLayer = layerSpecs.find((layer) => layer.id === "site-twin-surface");

      expect(siteTwinSurfaceLayer?.url).toBe("/fab/data/site_twin/terrain_surface.png");
    } finally {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  });
});
