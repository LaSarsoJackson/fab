import { describe, expect, test } from "bun:test";
import { buildSearchIndex } from "../src/lib/burialSearch";
import {
  buildBrowseResults,
  buildBurialBrowseResult,
  buildTourBrowseResult,
  filterBurialRecordsBySection,
  formatBrowseResultName,
  getBrowseSourceMode,
} from "../src/lib/browseResults";

const getTourName = (record) => {
  if (record.title === "Notable") return "Notables Tour 2020";
  return "";
};

const burialFeatures = [
  {
    properties: {
      OBJECTID: 1,
      First_Name: "Anna",
      Last_Name: "Tracy",
      Section: "99",
      Lot: "18",
      Tier: "0",
      Grave: "0",
      Birth: "12/2/1858",
      Death: "1/28/1945",
      title: "Notable",
    },
    geometry: {
      coordinates: [-73.733659, 42.711919],
    },
  },
  {
    properties: {
      OBJECTID: 2,
      First_Name: "Thomas",
      Last_Name: "Tracy",
      Section: "99",
      Lot: "18",
      Tier: "0",
      Grave: "1",
      Birth: "7/12/1855",
      Death: "4/23/1926",
    },
    geometry: {
      coordinates: [-73.73366, 42.71192],
    },
  },
  {
    properties: {
      OBJECTID: 3,
      First_Name: "James",
      Last_Name: "Hall",
      Section: "18",
      Lot: "93",
      Tier: "2",
      Grave: "4",
      Birth: "1811/09/12",
      Death: "1898/08/07",
    },
    geometry: {
      coordinates: [-73.73, 42.71],
    },
  },
];

const burialRecords = burialFeatures.map((feature) => (
  buildBurialBrowseResult(feature, { getTourName })
));

const searchIndex = buildSearchIndex(burialRecords, { getTourName });

describe("buildBurialBrowseResult", () => {
  test("normalizes a burial feature into the browse-result shape", () => {
    expect(burialRecords[0]).toMatchObject({
      id: "burial:1:99:18:0",
      source: "burial",
      displayName: "Anna Tracy",
      secondaryText: "Section 99, Lot 18 • Born 12/2/1858 • Died 1/28/1945",
      tourName: "Notables Tour 2020",
    });
  });
});

describe("buildTourBrowseResult", () => {
  test("supports named tour stops", () => {
    const tourRecord = buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 1,
          Full_Name: "James Hall",
          Last_Name: "Hall",
          ARC_Secton: 18,
          ARC_Lot: 93,
          Birth: "1811/09/12",
          Death: "1898/08/07",
          Titles: "Founder NYS Museum",
        },
        geometry: {
          coordinates: [-73.73, 42.71],
        },
      },
      {
        tourKey: "Notable",
        tourName: "Notables Tour 2020",
      }
    );

    expect(tourRecord).toMatchObject({
      source: "tour",
      displayName: "James Hall",
      Section: "18",
      Lot: "93",
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
    });
  });

  test("falls back to a location label for unnamed headstone tours", () => {
    const tourRecord = buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 9,
          Section: 49,
          Lot: 1,
          Row: 1,
          Position: 1,
        },
        geometry: {
          coordinates: [-73.72, 42.72],
        },
      },
      {
        tourKey: "Sec49",
        tourName: "Section 49",
      }
    );

    expect(formatBrowseResultName(tourRecord)).toBe("Section 49 • Lot 1 • Row 1 • Position 1");
    expect(tourRecord.secondaryText).toBe("Section 49, Lot 1");
  });
});

describe("browse source helpers", () => {
  test("detects the active browse source mode", () => {
    expect(getBrowseSourceMode({})).toBe("all");
    expect(getBrowseSourceMode({ browseSource: "tour" })).toBe("tour");
    expect(getBrowseSourceMode({ sectionFilter: "99" })).toBe("section");
    expect(getBrowseSourceMode({ selectedTour: "Notables Tour 2020" })).toBe("tour");
  });

  test("filters burial records by section and lot/tier", () => {
    expect(
      filterBurialRecordsBySection(burialRecords, { sectionFilter: "99" }).map((item) => item.id)
    ).toEqual([burialRecords[0].id, burialRecords[1].id]);

    expect(
      filterBurialRecordsBySection(burialRecords, {
        sectionFilter: "18",
        lotTierFilter: "2",
        filterType: "tier",
      }).map((item) => item.id)
    ).toEqual([burialRecords[2].id]);
  });
});

describe("buildBrowseResults", () => {
  const tourResults = [
    buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 1,
          Full_Name: "James Hall",
          Last_Name: "Hall",
          ARC_Secton: 18,
          ARC_Lot: 93,
          Birth: "1811/09/12",
          Death: "1898/08/07",
        },
        geometry: {
          coordinates: [-73.73, 42.71],
        },
      },
      {
        tourKey: "Notable",
        tourName: "Notables Tour 2020",
      }
    ),
  ];

  test("searches across all burial records when no section or tour is active", () => {
    const { activeSource, results } = buildBrowseResults({
      query: "tracy",
      burialRecords,
      searchIndex,
      getTourName,
    });

    expect(activeSource).toBe("all");
    expect(results.map((item) => item.displayName)).toEqual(["Anna Tracy", "Thomas Tracy"]);
  });

  test("returns the current section results when the section source is active", () => {
    const { activeSource, results } = buildBrowseResults({
      browseSource: "section",
      burialRecords,
      sectionFilter: "99",
    });

    expect(activeSource).toBe("section");
    expect(results.map((item) => item.displayName)).toEqual(["Anna Tracy", "Thomas Tracy"]);
  });

  test("narrows section results with the shared query logic", () => {
    const { results } = buildBrowseResults({
      browseSource: "section",
      query: "anna",
      burialRecords,
      sectionFilter: "99",
      getTourName,
    });

    expect(results.map((item) => item.displayName)).toEqual(["Anna Tracy"]);
  });

  test("returns the active tour results and narrows them with the same query input", () => {
    const initial = buildBrowseResults({
      browseSource: "tour",
      burialRecords,
      selectedTour: "Notables Tour 2020",
      tourResults,
      getTourName,
    });

    expect(initial.activeSource).toBe("tour");
    expect(initial.results.map((item) => item.displayName)).toEqual(["James Hall"]);

    const narrowed = buildBrowseResults({
      browseSource: "tour",
      query: "hall",
      burialRecords,
      selectedTour: "Notables Tour 2020",
      tourResults,
      getTourName,
    });

    expect(narrowed.results.map((item) => item.displayName)).toEqual(["James Hall"]);
  });

  test("prefers the selected tour browse source when section and tour are both present", () => {
    const { activeSource, results } = buildBrowseResults({
      burialRecords,
      sectionFilter: "99",
      selectedTour: "Notables Tour 2020",
      tourResults,
      getTourName,
    });

    expect(activeSource).toBe("tour");
    expect(results.map((item) => item.displayName)).toEqual(["James Hall"]);
  });

  test("keeps section mode empty until a section is chosen", () => {
    const { activeSource, results } = buildBrowseResults({
      browseSource: "section",
      burialRecords,
    });

    expect(activeSource).toBe("section");
    expect(results).toEqual([]);
  });

  test("keeps tour mode empty until a tour is chosen", () => {
    const { activeSource, results } = buildBrowseResults({
      browseSource: "tour",
      burialRecords,
      tourResults,
    });

    expect(activeSource).toBe("tour");
    expect(results).toEqual([]);
  });
});
