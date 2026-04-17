import { describe, expect, test } from "bun:test";
import { buildBurialBrowseResult, buildTourBrowseResult } from "../src/features/browse";
import { harmonizeBurialBrowseResult } from "../src/features/tours";

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
