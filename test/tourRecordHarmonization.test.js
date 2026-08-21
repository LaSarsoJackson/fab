import { describe, expect, test } from "bun:test";
import AfricanAmericanTour from "../src/data/AfricanAmericanTour20.json";
import AlbanyMayorsTour from "../src/data/AlbanyMayors_fixed.json";
import CivilWarTour from "../src/data/CivilWarTour20.json";
import GeoBurials from "../src/data/Geo_Burials.json";
import IndependenceTour from "../src/data/IndependenceTour20.json";
import NotablesTour from "../src/data/NotablesTour20.json";
import { buildBurialRecord } from "../src/features/locator/burialRecords";
import { buildTourRecord } from "../src/features/tours/tourRecords";
import {
  buildBurialLookup,
  buildTourBurialMatches,
  findMatchingBurialRecord,
  hasKnownLifeDateConflict,
} from "../src/features/tours/tourRecordHarmonization";

const burialByObjectId = (objectId) => buildBurialRecord(
  GeoBurials.features.find((feature) => feature.properties?.OBJECTID === objectId)
);

const tourByBiography = (dataset, biography, context) => buildTourRecord(
  dataset.features.find((feature) => feature.properties?.Tour_Bio === biography),
  context
);

const burialsInPlot = (record) => GeoBurials.features
  .filter((feature) => (
    String(feature.properties?.Section) === record.Section &&
    String(feature.properties?.Lot) === record.Lot
  ))
  .map(buildBurialRecord);

describe("tour-to-burial matching", () => {
  test("indexes burial records by section and lot", () => {
    const burial = buildBurialRecord({
      properties: {
        OBJECTID: 1,
        First_Name: "Ada",
        Last_Name: "Lovelace",
        Section: 12,
        Lot: 4,
      },
      geometry: { coordinates: [-73.73, 42.7] },
    });

    expect(buildBurialLookup([burial]).bySectionLot.get("12::4")).toEqual([burial]);
  });

  test("maps Marcus T. Reynolds only to the burial with compatible life dates", () => {
    const tour = tourByBiography(NotablesTour, "Reynolds5", {
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
    });
    const burials = GeoBurials.features
      .filter((feature) => (
        String(feature.properties?.Last_Name || "").toLowerCase() === "reynolds" &&
        String(feature.properties?.First_Name || "").toLowerCase().startsWith("marcus")
      ))
      .map(buildBurialRecord);
    const correct = burials.find((record) => record.Birth === "8/20/1869");
    const unrelated = burials.find((record) => record.Birth === "2/17/1926");

    expect(burials).toHaveLength(4);
    expect(hasKnownLifeDateConflict(tour, correct)).toBe(false);
    expect(hasKnownLifeDateConflict(tour, unrelated)).toBe(true);
    expect(findMatchingBurialRecord(tour, buildBurialLookup(burials))?.id).toBe(correct.id);

    const matches = buildTourBurialMatches([tour], burials);
    expect(Object.keys(matches)).toEqual([correct.id]);
    expect(matches[correct.id]).toMatchObject({
      Tour_Bio: "Reynolds5",
      portraitImageName: "Reynolds5d.png",
      extraTitle: "Albany Architect",
    });
  });

  test("accepts only bounded date transcriptions for an exact person and plot", () => {
    const expectedMatches = [
      [NotablesTour, "Arthur18", 71224, { tourKey: "Notable", tourName: "Notables Tour 2020" }],
      [NotablesTour, "Dix9", 34158, { tourKey: "Notable", tourName: "Notables Tour 2020" }],
      [NotablesTour, "Knapp55", 57991, { tourKey: "Notable", tourName: "Notables Tour 2020" }],
      [IndependenceTour, "Patterson60", 96823, { tourKey: "Indep", tourName: "Independence Tour 2020" }],
      [IndependenceTour, "Gansevoort85", 96601, { tourKey: "Indep", tourName: "Independence Tour 2020" }],
    ];

    expectedMatches.forEach(([dataset, biography, objectId, context]) => {
      const tour = tourByBiography(dataset, biography, context);
      const burial = burialByObjectId(objectId);
      const plotBurials = burialsInPlot(burial);

      expect(hasKnownLifeDateConflict(tour, burial)).toBe(true);
      expect(findMatchingBurialRecord(tour, buildBurialLookup(plotBurials))?.id).toBe(burial.id);
      expect(Object.keys(buildTourBurialMatches([tour], plotBurials))).toEqual([burial.id]);
    });

    const arthurTour = tourByBiography(NotablesTour, "Arthur18", {
      tourKey: "Notable",
      tourName: "Notables Tour 2020",
    });
    const arthurNamesakes = GeoBurials.features
      .filter((feature) => (
        String(feature.properties?.Section) === "24" &&
        String(feature.properties?.Lot) === "8" &&
        feature.properties?.First_Name === "Chester Alan" &&
        feature.properties?.Last_Name === "Arthur" &&
        feature.properties?.OBJECTID !== 71224
      ))
      .map(buildBurialRecord);

    expect(arthurNamesakes).toHaveLength(2);
    expect(findMatchingBurialRecord(arthurTour, buildBurialLookup(arthurNamesakes))).toBeNull();
  });

  test("rejects nearby relatives and different full first names", () => {
    const johnTaylor = buildTourRecord(
      AlbanyMayorsTour.features.find((feature) => feature.properties?.Full_Name === "John Taylor"),
      { tourKey: "MayorsOfAlbany", tourName: "Mayors of Albany" }
    );
    const edumundTaylor = burialByObjectId(100341);

    expect(findMatchingBurialRecord(
      johnTaylor,
      buildBurialLookup([edumundTaylor])
    )).toBeNull();

    const tour = buildTourRecord({
      properties: { OBJECTID: 1, Full_Name: "John Allen Smith", Section: 1, Lot: 1 },
      geometry: { coordinates: [-73.73, 42.7] },
    }, { tourKey: "Notable", tourName: "Notables Tour 2020" });
    const burial = buildBurialRecord({
      properties: { OBJECTID: 2, First_Name: "James Allen", Last_Name: "Smith", Section: 1, Lot: 1 },
      geometry: { coordinates: [-73.73, 42.7] },
    });

    expect(findMatchingBurialRecord(tour, buildBurialLookup([burial]))).toBeNull();
  });

  test("preserves bounded spelling, initial, and compound-surname matches", () => {
    const cases = [
      [AfricanAmericanTour, "Roessle172", 52937, { tourKey: "Afr", tourName: "African American Tour 2020" }],
      [CivilWarTour, "Lord145", 71095, { tourKey: "CivilWar", tourName: "Civil War Tour 2020" }],
      [CivilWarTour, "TenEyck163", 57969, { tourKey: "CivilWar", tourName: "Civil War Tour 2020" }],
    ];

    cases.forEach(([dataset, biography, objectId, context]) => {
      const tour = tourByBiography(dataset, biography, context);
      const burial = burialByObjectId(objectId);
      expect(findMatchingBurialRecord(tour, buildBurialLookup([burial]))?.id).toBe(burial.id);
    });
  });

  test("leaves weak candidates unmatched", () => {
    const burial = buildBurialRecord({
      properties: { OBJECTID: 99, First_Name: "Ada", Last_Name: "Lovelace", Section: 1, Lot: 1 },
      geometry: { coordinates: [-73.73, 42.7] },
    });
    const tour = buildTourRecord({
      properties: { OBJECTID: 7, Full_Name: "Completely Different Person", Section: 1, Lot: 1 },
      geometry: { coordinates: [-73.71, 42.72] },
    }, { tourKey: "Notable", tourName: "Notables Tour 2020" });

    expect(findMatchingBurialRecord(tour, buildBurialLookup([burial]))).toBeNull();
  });
});
