import { describe, expect, test } from "bun:test";
import { buildBurialBrowseResult, buildTourBrowseResult } from "../src/features/browse/browseResults";
import {
  buildBurialLookup,
  harmonizeBurialBrowseResult,
  harmonizeTourBrowseResult,
} from "../src/features/tours/tourRecordHarmonization";

describe("buildBurialLookup", () => {
  test("indexes burial records by section and lot", () => {
    const burial = buildBurialBrowseResult({
      properties: {
        OBJECTID: 1,
        First_Name: "Ada",
        Last_Name: "Lovelace",
        Section: 12,
        Lot: 4,
      },
      geometry: {
        coordinates: [-73.73, 42.7],
      },
    });

    const lookup = buildBurialLookup([burial]);

    expect(lookup.bySectionLot.get("12::4")).toEqual([burial]);
  });
});

describe("harmonizeBurialBrowseResult", () => {
  test("enriches search records with matching tour metadata", () => {
    const burialRecord = buildBurialBrowseResult({
      properties: {
        OBJECTID: 34291,
        First_Name: "Mary Margaretta Fryer",
        Last_Name: "Manning",
        Section: 27,
        Lot: 5,
        Tier: 0,
        Grave: 0,
        Birth: "6/22/1845",
        Death: "7/19/1928",
      },
      geometry: {
        coordinates: [-73.734568, 42.704873],
      },
    });

    const tourRecord = buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 15,
          First_name: "Mary",
          Last_Name: "Manning",
          Full_Name: "Mary Margaretta Fryer Manning",
          Section: 27,
          Lot: 5,
          Tier: 0,
          Grave: 0,
          Birth: "1845/06/22",
          Death: "1928/07/19",
          Titles: "President General, Daughters of the American Rev.",
          Tour_Bio: "Manning107",
          Bio_Portra: "Manning107a.jpg",
        },
        geometry: {
          coordinates: [-73.734568, 42.704873],
        },
      },
      {
        tourKey: "Pillars",
        tourName: "Pillars of Society Tour 2020",
      }
    );

    const result = harmonizeBurialBrowseResult(
      burialRecord,
      { [burialRecord.id]: tourRecord }
    );

    expect(result).toMatchObject({
      source: "burial",
      displayName: "Mary Margaretta Fryer Manning",
      tourKey: "Pillars",
      tourName: "Pillars of Society Tour 2020",
      Tour_Bio: "Manning107",
      Bio_Portra: "Manning107a.jpg",
      extraTitle: "President General, Daughters of the American Rev.",
    });
  });

  test("keeps unmatched search records unchanged", () => {
    const burialRecord = buildBurialBrowseResult({
      properties: {
        OBJECTID: 1,
        First_Name: "Ada",
        Last_Name: "Lovelace",
        Section: 1,
        Lot: 2,
        Tier: 0,
        Grave: 0,
      },
      geometry: {
        coordinates: [-73.7, 42.7],
      },
    });

    const result = harmonizeBurialBrowseResult(
      burialRecord,
      {}
    );

    expect(result).toEqual(burialRecord);
  });
});

describe("harmonizeTourBrowseResult", () => {
  test("uses the canonical burial record when a strong tour match exists", () => {
    const burial = buildBurialBrowseResult({
      properties: {
        OBJECTID: 34291,
        First_Name: "Mary Margaretta Fryer",
        Last_Name: "Manning",
        Section: 27,
        Lot: 5,
        Tier: 0,
        Grave: 0,
        Birth: "6/22/1845",
        Death: "7/19/1928",
      },
      geometry: {
        coordinates: [-73.734568, 42.704873],
      },
    });

    const tour = buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 15,
          First_name: "Mary",
          Last_Name: "Manning",
          Full_Name: "Mary Manning",
          Section: 27,
          Lot: 5,
          Tier: 0,
          Grave: 0,
          Birth: "1845/06/22",
          Death: "1928/07/19",
        },
        geometry: {
          coordinates: [-73.734568, 42.704873],
        },
      },
      {
        tourKey: "Pillars",
        tourName: "Pillars of Society Tour 2020",
      }
    );

    const result = harmonizeTourBrowseResult(tour, buildBurialLookup([burial]));

    expect(result).toMatchObject({
      matchedBurialId: burial.id,
      matchedBurialName: "Mary Margaretta Fryer Manning",
      displayName: "Mary Margaretta Fryer Manning",
      displayAlias: "Mary Manning",
      Birth: "6/22/1845",
      Death: "7/19/1928",
    });
  });

  test("leaves weak candidates unmatched", () => {
    const burial = buildBurialBrowseResult({
      properties: {
        OBJECTID: 99,
        First_Name: "Ada",
        Last_Name: "Lovelace",
        Section: 1,
        Lot: 1,
      },
      geometry: {
        coordinates: [-73.73, 42.7],
      },
    });

    const unrelatedTour = buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 7,
          Full_Name: "Completely Different Person",
          Section: 1,
          Lot: 1,
        },
        geometry: {
          coordinates: [-73.71, 42.72],
        },
      },
      {
        tourKey: "Notable",
        tourName: "Notables Tour 2020",
      }
    );

    const result = harmonizeTourBrowseResult(unrelatedTour, buildBurialLookup([burial]));

    expect(result.matchedBurialId).toBeUndefined();
    expect(result.displayName).toBe("Completely Different Person");
    expect(result.displayAlias).toBeUndefined();
  });
});
