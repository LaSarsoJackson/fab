import {
  buildSectionBoundsById,
  buildSectionOverviewMarkers,
  formatSectionOverviewMarkerLabel,
  resolveSectionOverlayVisibility,
} from "./sectionOverviewMarkers";

describe("sectionOverviewMarkers", () => {
  const sectionsGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { Section: "4" },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-73.735, 42.704],
            [-73.734, 42.704],
            [-73.734, 42.705],
            [-73.735, 42.705],
            [-73.735, 42.704],
          ]],
        },
      },
      {
        type: "Feature",
        properties: { Section: "4" },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-73.733, 42.706],
            [-73.732, 42.706],
            [-73.732, 42.707],
            [-73.733, 42.707],
            [-73.733, 42.706],
          ]],
        },
      },
      {
        type: "Feature",
        properties: { Section: "7" },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [-73.731, 42.708],
            [-73.73, 42.708],
            [-73.73, 42.709],
            [-73.731, 42.709],
            [-73.731, 42.708],
          ]],
        },
      },
    ],
  };

  test("dedupes repeated section ids when building overview markers", () => {
    const markers = buildSectionOverviewMarkers(sectionsGeoJson, new Map([
      ["4", 484],
      ["7", 485],
    ]));

    expect(markers).toHaveLength(2);
    expect(markers.map((marker) => marker.id)).toEqual([
      "section-overview:4",
      "section-overview:7",
    ]);
    expect(markers[0].bounds).toEqual([
      [42.704, -73.735],
      [42.707, -73.732],
    ]);
  });

  test("builds grouped section bounds for sidebar and map focus", () => {
    const boundsById = buildSectionBoundsById(sectionsGeoJson);

    expect(boundsById.get("4")).toEqual([
      [42.704, -73.735],
      [42.707, -73.732],
    ]);
    expect(boundsById.get("7")).toEqual([
      [42.708, -73.731],
      [42.709, -73.73],
    ]);
  });

  test("formats overview marker labels with burial counts", () => {
    expect(formatSectionOverviewMarkerLabel({
      sectionValue: "49",
      count: 1284,
    })).toBe("Section 49 • 1,284 burials");
  });

  test("keeps the widest zoom overview free of section details", () => {
    expect(resolveSectionOverlayVisibility({
      currentZoom: 14,
    })).toEqual({
      showSectionOverviewMarkers: false,
      showSections: false,
    });
  });

  test("shows section overview markers before section polygons", () => {
    expect(resolveSectionOverlayVisibility({
      currentZoom: 15,
    })).toEqual({
      showSectionOverviewMarkers: true,
      showSections: false,
    });

    expect(resolveSectionOverlayVisibility({
      currentZoom: 16,
    })).toEqual({
      showSectionOverviewMarkers: false,
      showSections: true,
    });
  });

  test("keeps section polygons visible for an active section context", () => {
    expect(resolveSectionOverlayVisibility({
      currentZoom: 14,
      sectionFilter: "4",
    })).toEqual({
      showSectionOverviewMarkers: false,
      showSections: true,
    });
  });
});
