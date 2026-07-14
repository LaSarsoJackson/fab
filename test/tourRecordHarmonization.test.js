import { describe, expect, test } from "bun:test";
import { buildBurialBrowseResult, buildTourBrowseResult } from "../src/features/browse/browseResults";
import AfricanAmericanTour from "../src/data/AfricanAmericanTour20.json";
import AlbanyMayorsTour from "../src/data/AlbanyMayors_fixed.json";
import CivilWarTour from "../src/data/CivilWarTour20.json";
import GeoBurials from "../src/data/Geo_Burials.json";
import IndependenceTour from "../src/data/IndependenceTour20.json";
import NotablesTour from "../src/data/NotablesTour20.json";
import {
  buildBurialLookup,
  buildTourBurialMatches,
  findMatchingBurialRecord,
  harmonizeBurialBrowseResult,
  harmonizeTourBrowseResult,
  hasKnownLifeDateConflict,
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

  test("maps Marcus T. Reynolds only to the burial with compatible life dates", () => {
    const tourFeature = NotablesTour.features.find((feature) => (
      feature.properties?.Tour_Bio === "Reynolds5"
    ));
    const marcusBurialFeatures = GeoBurials.features.filter((feature) => (
      String(feature.properties?.Last_Name || "").toLowerCase() === "reynolds" &&
      String(feature.properties?.First_Name || "").toLowerCase().startsWith("marcus")
    ));

    expect(tourFeature).toBeTruthy();
    expect(marcusBurialFeatures).toHaveLength(4);

    const tourRecord = buildTourBrowseResult(tourFeature, {
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
    });
    const burialRecords = marcusBurialFeatures.map((feature) => buildBurialBrowseResult(feature));
    const correctBurial = burialRecords.find((record) => record.Birth === "8/20/1869");
    const unrelatedBurial = burialRecords.find((record) => record.Birth === "2/17/1926");

    expect(correctBurial).toBeTruthy();
    expect(unrelatedBurial).toBeTruthy();
    expect(hasKnownLifeDateConflict(tourRecord, correctBurial)).toBe(false);
    expect(hasKnownLifeDateConflict(tourRecord, unrelatedBurial)).toBe(true);
    expect(findMatchingBurialRecord(tourRecord, buildBurialLookup(burialRecords))?.id)
      .toBe(correctBurial.id);

    const matches = buildTourBurialMatches([tourRecord], burialRecords);
    expect(Object.keys(matches)).toEqual([correctBurial.id]);

    const enrichedCorrectBurial = harmonizeBurialBrowseResult(correctBurial, matches);
    const unchangedUnrelatedBurial = harmonizeBurialBrowseResult(unrelatedBurial, matches);

    expect(enrichedCorrectBurial).toMatchObject({
      Birth: "8/20/1869",
      Death: "3/18/1937",
      Tour_Bio: "Reynolds5",
      Bio_Portra: "Reynolds5d.png",
      extraTitle: "Albany Architect",
    });
    expect(unchangedUnrelatedBurial).toEqual(unrelatedBurial);
    expect(unchangedUnrelatedBurial).not.toHaveProperty("Tour_Bio");
    expect(unchangedUnrelatedBurial).not.toHaveProperty("Bio_Portra");
    expect(unchangedUnrelatedBurial).not.toHaveProperty("portraitImageName");
    expect(unchangedUnrelatedBurial).not.toHaveProperty("biographyLink");
  });

  test("accepts only tightly bounded date transcriptions for an exact person and plot", () => {
    const expectedMatches = [
      [NotablesTour, "Arthur18", 71224],
      [NotablesTour, "Dix9", 34158],
      [NotablesTour, "Knapp55", 57991],
      [IndependenceTour, "Patterson60", 96823],
      [IndependenceTour, "Gansevoort85", 96601],
    ];

    expectedMatches.forEach(([tourDataset, tourBio, burialObjectId]) => {
      const tourFeature = tourDataset.features.find((feature) => (
        feature.properties?.Tour_Bio === tourBio
      ));
      const burialFeature = GeoBurials.features.find((feature) => (
        feature.properties?.OBJECTID === burialObjectId
      ));
      const tourContext = tourDataset === IndependenceTour
        ? { tourKey: "Indep", tourName: "Independence Tour 2020" }
        : { tourKey: "Notable", tourName: "Notables Tour 2020" };
      const tourRecord = buildTourBrowseResult(tourFeature, tourContext);
      const burialRecord = buildBurialBrowseResult(burialFeature);
      const plotBurialRecords = GeoBurials.features
        .filter((feature) => (
          String(feature.properties?.Section) === burialRecord.Section &&
          String(feature.properties?.Lot) === burialRecord.Lot
        ))
        .map((feature) => buildBurialBrowseResult(feature));

      expect(hasKnownLifeDateConflict(tourRecord, burialRecord)).toBe(true);
      expect(findMatchingBurialRecord(
        tourRecord,
        buildBurialLookup(plotBurialRecords)
      )?.id).toBe(burialRecord.id);
      expect(Object.keys(buildTourBurialMatches([tourRecord], plotBurialRecords)))
        .toEqual([burialRecord.id]);
    });

    const arthurTourFeature = NotablesTour.features.find((feature) => (
      feature.properties?.Tour_Bio === "Arthur18"
    ));
    const arthurNamesakeFeatures = GeoBurials.features.filter((feature) => (
      String(feature.properties?.Section) === "24" &&
      String(feature.properties?.Lot) === "8" &&
      feature.properties?.First_Name === "Chester Alan" &&
      feature.properties?.Last_Name === "Arthur" &&
      feature.properties?.OBJECTID !== 71224
    ));
    const arthurTour = buildTourBrowseResult(arthurTourFeature, {
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
    });
    const arthurNamesakes = arthurNamesakeFeatures.map((feature) => (
      buildBurialBrowseResult(feature)
    ));

    expect(arthurNamesakes).toHaveLength(2);
    arthurNamesakes.forEach((namesake) => {
      expect(hasKnownLifeDateConflict(arthurTour, namesake)).toBe(true);
    });
    expect(findMatchingBurialRecord(
      arthurTour,
      buildBurialLookup(arthurNamesakes)
    )).toBeNull();
    expect(buildTourBurialMatches([arthurTour], arthurNamesakes)).toEqual({});
  });

  test("rejects a nearby same-surname relative when person identity does not match", () => {
    const johnTaylorFeature = AlbanyMayorsTour.features.find((feature) => (
      feature.properties?.Full_Name === "John Taylor"
    ));
    const edumundTaylorFeature = GeoBurials.features.find((feature) => (
      feature.properties?.OBJECTID === 100341
    ));
    const johnTaylorTour = buildTourBrowseResult(johnTaylorFeature, {
      tourKey: "MayorsOfAlbany",
      tourName: "Mayors of Albany",
    });
    const edumundTaylorBurial = buildBurialBrowseResult(edumundTaylorFeature);

    expect(johnTaylorTour.displayName).toBe("John Taylor");
    expect(edumundTaylorBurial.displayName).toBe("Edumund B. Taylor");
    expect(hasKnownLifeDateConflict(johnTaylorTour, edumundTaylorBurial)).toBe(false);
    expect(findMatchingBurialRecord(
      johnTaylorTour,
      buildBurialLookup([edumundTaylorBurial])
    )).toBeNull();
    expect(buildTourBurialMatches(
      [johnTaylorTour],
      [edumundTaylorBurial]
    )).toEqual({});
  });

  test("does not treat two full first names as matching initials", () => {
    const tourRecord = buildTourBrowseResult(
      {
        properties: {
          OBJECTID: 1,
          Full_Name: "John Allen Smith",
          Section: 1,
          Lot: 1,
        },
        geometry: {
          coordinates: [-73.73, 42.7],
        },
      },
      {
        tourKey: "Notable",
        tourName: "Notables Tour 2020",
      }
    );
    const burialRecord = buildBurialBrowseResult({
      properties: {
        OBJECTID: 2,
        First_Name: "James Allen",
        Last_Name: "Smith",
        Section: 1,
        Lot: 1,
      },
      geometry: {
        coordinates: [-73.73, 42.7],
      },
    });

    expect(findMatchingBurialRecord(
      tourRecord,
      buildBurialLookup([burialRecord])
    )).toBeNull();
  });

  test("preserves bounded spelling, initial, and compound-surname matches", () => {
    const roessleTourFeature = AfricanAmericanTour.features.find((feature) => (
      feature.properties?.Tour_Bio === "Roessle172"
    ));
    const lordTourFeature = CivilWarTour.features.find((feature) => (
      feature.properties?.Tour_Bio === "Lord145"
    ));
    const tenEyckTourFeature = CivilWarTour.features.find((feature) => (
      feature.properties?.Tour_Bio === "TenEyck163"
    ));
    const roessleBurialFeature = GeoBurials.features.find((feature) => (
      feature.properties?.OBJECTID === 52937
    ));
    const lordBurialFeature = GeoBurials.features.find((feature) => (
      feature.properties?.OBJECTID === 71095
    ));
    const tenEyckBurialFeature = GeoBurials.features.find((feature) => (
      feature.properties?.OBJECTID === 57969
    ));
    const roessleTour = buildTourBrowseResult(roessleTourFeature, {
      tourKey: "AfricanAmerican",
      tourName: "African American History Tour 2020",
    });
    const lordTour = buildTourBrowseResult(lordTourFeature, {
      tourKey: "CivilWar",
      tourName: "Civil War Tour 2020",
    });
    const tenEyckTour = buildTourBrowseResult(tenEyckTourFeature, {
      tourKey: "CivilWar",
      tourName: "Civil War Tour 2020",
    });
    const roessleBurial = buildBurialBrowseResult(roessleBurialFeature);
    const lordBurial = buildBurialBrowseResult(lordBurialFeature);
    const tenEyckBurial = buildBurialBrowseResult(tenEyckBurialFeature);

    expect(findMatchingBurialRecord(
      roessleTour,
      buildBurialLookup([roessleBurial])
    )?.id).toBe(roessleBurial.id);
    expect(findMatchingBurialRecord(
      lordTour,
      buildBurialLookup([lordBurial])
    )?.id).toBe(lordBurial.id);
    expect(findMatchingBurialRecord(
      tenEyckTour,
      buildBurialLookup([tenEyckBurial])
    )?.id).toBe(tenEyckBurial.id);
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
