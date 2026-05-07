import { describe, expect, test } from "bun:test";
import ProjectedSec75Headstones from "../src/data/Projected_Sec75_Headstones.json";
import ProjectedSec49Headstones from "../src/data/Projected_Sec49_Headstones.json";
import NotablesTour20 from "../src/data/NotablesTour20.json";
import IndependenceTour20 from "../src/data/IndependenceTour20.json";
import AfricanAmericanTour20 from "../src/data/AfricanAmericanTour20.json";
import ArtistTour20 from "../src/data/ArtistTour20.json";
import AssociationsTour20 from "../src/data/AssociationsTour20.json";
import AuthorsPublishersTour20 from "../src/data/AuthorsPublishersTour20.json";
import BusinessFinanceTour20 from "../src/data/BusinessFinanceTour20.json";
import CivilWarTour20 from "../src/data/CivilWarTour20.json";
import SocietyPillarsTour20 from "../src/data/SocietyPillarsTour20.json";
import AlbanyMayors from "../src/data/AlbanyMayors_fixed.json";
import GAR from "../src/data/GAR_fixed.json";
import { buildTourBrowseResult, formatBrowseResultName } from "../src/features/browse/browseResults";
import { TOUR_DEFINITIONS, TOUR_STYLES } from "../src/features/fab/profile";
import { hasValidGeoJsonCoordinates } from "../src/shared/geoJsonBounds";

const TOUR_DATASETS_BY_KEY = {
  Lot7: ProjectedSec75Headstones,
  Sec49: ProjectedSec49Headstones,
  Notable: NotablesTour20,
  Indep: IndependenceTour20,
  Afr: AfricanAmericanTour20,
  Art: ArtistTour20,
  Groups: AssociationsTour20,
  AuthPub: AuthorsPublishersTour20,
  Business: BusinessFinanceTour20,
  CivilWar: CivilWarTour20,
  Pillars: SocietyPillarsTour20,
  MayorsOfAlbany: AlbanyMayors,
  GAR,
};

const getFirstValidFeature = (dataset) => dataset.features.find((feature) => hasValidGeoJsonCoordinates(feature));

describe("tour definitions", () => {
  test("every bundled tour definition has a matching style entry", () => {
    TOUR_DEFINITIONS.forEach((definition) => {
      expect(TOUR_STYLES[definition.key]).toMatchObject({
        name: definition.name,
      });
      expect(TOUR_STYLES[definition.key].color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  test("every bundled tour dataset normalizes into the shared browse-result shape", () => {
    TOUR_DEFINITIONS.forEach((definition) => {
      const dataset = TOUR_DATASETS_BY_KEY[definition.key];
      expect(dataset).toBeTruthy();

      const feature = getFirstValidFeature(dataset);
      expect(feature).toBeTruthy();

      const record = buildTourBrowseResult(feature, {
        tourKey: definition.key,
        tourName: definition.name,
      });

      expect(record.id.startsWith(`tour:${definition.key}:`)).toBe(true);
      expect(record.source).toBe("tour");
      expect(record.tourKey).toBe(definition.key);
      expect(record.tourName).toBe(definition.name);
      expect(formatBrowseResultName(record).length).toBeGreaterThan(0);
      expect(record.searchableLabelLower).toContain(definition.name.toLowerCase());
      expect(Array.isArray(record.coordinates)).toBe(true);
      expect(record.coordinates).toHaveLength(2);
    });
  });

  test("normalizes fixed-format non-2020 tours without depending on legacy tour fields", () => {
    const mayorsRecord = buildTourBrowseResult(getFirstValidFeature(AlbanyMayors), {
      tourKey: "MayorsOfAlbany",
      tourName: "Mayors of Albany",
    });
    const garRecord = buildTourBrowseResult(getFirstValidFeature(GAR), {
      tourKey: "GAR",
      tourName: "Grand Army of the Republic",
    });

    expect(mayorsRecord).toMatchObject({
      tourKey: "MayorsOfAlbany",
      tourName: "Mayors of Albany",
      displayName: "Pieter Schuyler",
      Section: "29",
      Lot: "66",
      portraitImageName: "Schuyler70a.jpg",
      biographyLink: "Schuyler70",
    });

    expect(garRecord.tourKey).toBe("GAR");
    expect(garRecord.tourName).toBe("Grand Army of the Republic");
    expect(formatBrowseResultName(garRecord).length).toBeGreaterThan(0);
    expect(garRecord.secondaryText).toContain("Died");
  });

  test("recovers biography slugs for fixed-format tours from canonical aliases", () => {
    const abeelFeature = AlbanyMayors.features.find(
      (feature) => feature.properties?.Full_Name === "Johannes Abeel"
    );
    expect(abeelFeature).toBeTruthy();

    const abeelRecord = buildTourBrowseResult(abeelFeature, {
      tourKey: "MayorsOfAlbany",
      tourName: "Mayors of Albany",
    });

    expect(abeelRecord.biographyLink).toBe("Abeel75");
    expect(abeelRecord.portraitImageName).toBe("");
  });
});
