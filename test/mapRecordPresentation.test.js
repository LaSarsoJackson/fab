import { describe, expect, test } from "bun:test";

import SearchBurials from "../public/data/Search_Burials.json";
import AlbanyMayors from "../src/data/AlbanyMayors_fixed.json";
import GAR from "../src/data/GAR_fixed.json";
import { buildBurialBrowseResult, buildTourBrowseResult } from "../src/features/browse/browseResults";
import { APP_PROFILE } from "../src/features/fab/profile";
import { FAB_TOUR_DEFINITIONS } from "../src/features/fab/tours";
import { buildPopupViewModel } from "../src/features/map/mapRecordPresentation";
import {
  buildBurialLookup,
  harmonizeBurialBrowseResult,
  harmonizeTourBrowseResult,
} from "../src/features/tours/tourRecordHarmonization";
import { resolvePortraitImageName } from "../src/features/tours/tourDerivedData";
import TourMatches from "../src/data/TourMatches.json";

const FAB_NO_IMAGE_URL = APP_PROFILE.features.recordPresentation.noImageUrl;

const getTourRecord = (dataset, matcher, tourKey, tourName) => {
  const feature = dataset.features.find((candidate) => matcher(candidate.properties || {}));
  expect(feature).toBeTruthy();

  return buildTourBrowseResult(feature, { tourKey, tourName });
};

const SEARCH_BURIAL_FEATURES = SearchBurials.map((item) => ({
  id: item.i,
  properties: {
    OBJECTID: item.i,
    First_Name: item.f,
    Last_Name: item.l,
    Section: item.s,
    Lot: item.lo,
    Grave: item.g,
    Tier: item.t,
    Birth: item.b,
    Death: item.d,
    tourKey: item.tk,
    title: item.tk,
    fullNameNormalized: item.n,
    searchableLabelLower: item.sl,
    nameVariantsNormalized: item.nv,
  },
  geometry: item.c ? { type: "Point", coordinates: item.c } : null,
}));

const buildNormalizedBurialRecords = () => SEARCH_BURIAL_FEATURES.map((feature) => (
  harmonizeBurialBrowseResult(buildBurialBrowseResult(feature), TourMatches)
));

const collectPopupMediaViolations = (records = [], sourceGroup = "") => records.flatMap((record) => {
  const popup = buildPopupViewModel(record);
  const hasPortrait = Boolean(resolvePortraitImageName(record));
  const hasLink = Boolean(popup.imageLinkUrl);
  const key = `${sourceGroup}:${record.id}`;
  const violations = [];

  if (!hasPortrait && !hasLink && popup.imageUrl) {
    violations.push(`${key} rendered media without a portrait or biography link.`);
  }

  if (!hasPortrait && !hasLink && popup.imageHint) {
    violations.push(`${key} rendered image hint text without a portrait or biography link.`);
  }

  if (!hasPortrait && hasLink && popup.imageUrl !== FAB_NO_IMAGE_URL) {
    violations.push(`${key} did not use the shared placeholder for a link-only record.`);
  }

  if (popup.imageUrl === FAB_NO_IMAGE_URL && !hasLink) {
    violations.push(`${key} rendered the shared placeholder without a biography link.`);
  }

  if (popup.imageHint && !hasLink) {
    violations.push(`${key} rendered image hint text without a biography link.`);
  }

  if (popup.imageFallbackUrl && !hasLink) {
    violations.push(`${key} exposed an image fallback without a biography link.`);
  }

  if (popup.imageFallbackUrl && popup.imageFallbackUrl !== FAB_NO_IMAGE_URL) {
    violations.push(`${key} exposed an unexpected image fallback URL.`);
  }

  if (!popup.imageUrl && hasLink) {
    violations.push(`${key} exposed a biography link without any renderable media.`);
  }

  return violations;
});

describe("buildPopupViewModel", () => {
  test("renders mayors through the shared popup row model", () => {
    const mayorRecord = getTourRecord(
      AlbanyMayors,
      (properties) => properties.Full_Name === "Pieter Schuyler",
      "MayorsOfAlbany",
      "Mayors of Albany"
    );

    const popup = buildPopupViewModel(mayorRecord);

    expect(popup.subtitle).toBe("");
    expect(popup.paragraphs).toEqual([]);
    expect(popup.imageLinkUrl).toBe("https://www.albany.edu/arce/Schuyler70.html");
    expect(popup.imageHint).toBe("Tap the image to open the ARCE biography.");
    expect(popup.rows).toEqual([
      { label: "Initial term", value: "1686-1684" },
      { label: "Location", value: "Section 29, Lot 66" },
      { label: "Died", value: "2/19/1754" },
    ]);
  });

  test("does not fall back to portrait-only links when no biography exists", () => {
    const mayorRecord = getTourRecord(
      AlbanyMayors,
      (properties) => properties.Full_Name === "John Townsend",
      "MayorsOfAlbany",
      "Mayors of Albany"
    );

    const popup = buildPopupViewModel(mayorRecord);

    expect(mayorRecord.biographyLink).toBe("");
    expect(popup.imageUrl).toContain("TownsendMOA18a.jpg");
    expect(popup.imageLinkUrl).toBe("");
    expect(popup.imageHint).toBe("");
  });

  test("uses the shared no-image placeholder when a biography exists but no portrait does", () => {
    const popup = buildPopupViewModel({
      source: "tour",
      displayName: "William Dalton",
      Section: "21",
      Lot: "34",
      Tour_Bio: "Dalton17",
    });

    expect(popup.imageUrl).toBe("https://www.albany.edu/arce/images/no-image.jpg");
    expect(popup.imageLinkUrl).toBe("https://www.albany.edu/arce/Dalton17.html");
    expect(popup.imageHint).toBe("Tap the image to open the ARCE biography.");
  });

  test("does not render media when a record has neither portrait metadata nor a biography", () => {
    const popup = buildPopupViewModel({
      source: "burial",
      displayName: "Thomas E LaMont",
      Section: "215",
      Lot: "30",
      Tier: "0",
      Grave: "0",
      Birth: "7/21/1951",
      Death: "1/26/2011",
    });

    expect(popup.imageUrl).toBe("");
    expect(popup.imageLinkUrl).toBe("");
    expect(popup.imageHint).toBe("");
  });

  test("uses the same shared rows for GAR markers", () => {
    const garRecord = getTourRecord(
      GAR,
      (properties) => properties.Full_Name === "Henry  Hallenbeck",
      "GAR",
      "Grand Army of the Republic"
    );

    const popup = buildPopupViewModel(garRecord);

    expect(popup.subtitle).toBe("");
    expect(popup.paragraphs).toEqual([]);
    expect(popup.rows).toEqual([
      { label: "Rank", value: "Corporal" },
      { label: "Unit", value: "7th NY Heavy Artillery “Seymour Guard”     (Albany Regiment)" },
      { label: "Died", value: "6/1/1918" },
      { label: "Headstone", value: "Headstone 26" },
    ]);
  });

  test("keeps popup media rules consistent across normalized burial and tour records", async () => {
    const burialRecords = buildNormalizedBurialRecords();
    const burialLookup = buildBurialLookup(burialRecords);
    const loadedTourDatasets = await Promise.all(
      FAB_TOUR_DEFINITIONS.map(async (definition) => {
        const module = await definition.load();
        return {
          definition,
          dataset: module.default || module,
        };
      })
    );
    const tourRecords = loadedTourDatasets.flatMap(({ definition, dataset }) => (
      dataset.features.map((feature) => (
        harmonizeTourBrowseResult(
          buildTourBrowseResult(feature, {
            tourKey: definition.key,
            tourName: definition.name,
          }),
          burialLookup
        )
      ))
    ));

    const violations = [
      ...collectPopupMediaViolations(burialRecords, "burial"),
      ...collectPopupMediaViolations(tourRecords, "tour"),
    ];

    expect(violations).toEqual([]);
  });
});
