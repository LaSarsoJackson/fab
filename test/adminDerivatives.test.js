import { describe, expect, test } from "bun:test";

import { buildGeneratedArtifacts } from "../src/admin/derivatives";

const burials = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        OBJECTID: 1,
        First_Name: "James",
        Last_Name: "Hall",
        Section: 18,
        Lot: 93,
        Tier: 2,
        Grave: 4,
        Birth: "1811/09/12",
        Death: "1898/08/07",
      },
      geometry: {
        type: "Point",
        coordinates: [-73.73, 42.71],
      },
    },
  ],
};

const notablesTour = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        OBJECTID: 99,
        Full_Name: "James Hall",
        ARC_Secton: 18,
        ARC_Lot: 93,
        Tier: 2,
        Grave: 4,
        Titles: "Founder NYS Museum",
      },
      geometry: {
        type: "Point",
        coordinates: [-73.73, 42.71],
      },
    },
  ],
};

const boundary = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        OBJECTID: 1,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-73.74, 42.70],
          [-73.72, 42.70],
          [-73.72, 42.72],
          [-73.74, 42.72],
          [-73.74, 42.70],
        ]],
      },
    },
  ],
};

describe("admin derived artifacts", () => {
  test("rebuilds search, tour matches, and boundary constants from serialized source modules", () => {
    const artifacts = buildGeneratedArtifacts({
      burials,
      boundary,
      "tour:Notable": notablesTour,
    });

    const searchArtifact = artifacts.find((artifact) => artifact.path === "public/data/Search_Burials.json");
    const matchesArtifact = artifacts.find((artifact) => artifact.path === "src/data/TourMatches.json");
    const constantsArtifact = artifacts.find((artifact) => artifact.path === "src/features/map/generatedBounds.js");

    expect(searchArtifact).toBeTruthy();
    expect(matchesArtifact).toBeTruthy();
    expect(constantsArtifact).toBeTruthy();

    const searchRows = JSON.parse(searchArtifact.contents);
    const matches = JSON.parse(matchesArtifact.contents);

    expect(searchRows).toHaveLength(1);
    expect(searchRows[0].tk).toBe("Notable");
    expect(Object.keys(matches)).toEqual(["burial:1:18:93:4"]);
    expect(constantsArtifact.contents).toContain("export const BOUNDARY_BBOX");
  });
});
