import { describe, expect, test } from "bun:test";

import SearchBurials from "../public/data/Search_Burials.json";
import GeoBurials from "../src/data/Geo_Burials.json";
import ProjectedSec49Headstones from "../src/data/Projected_Sec49_Headstones.json";
import { buildTourBrowseResult } from "../src/features/browse/browseResults";
import { hasValidGeoJsonCoordinates } from "../src/shared/geoJsonBounds";

const getFeatureCoordinates = (feature = {}) => feature.geometry?.coordinates ?? null;

const getDecimalPrecision = (value) => {
  const [, decimals = ""] = String(value).split(".");
  return decimals.replace(/0+$/, "").length;
};

describe("data pipeline coordinate integrity", () => {
  test("ships generated search rows with exact source burial coordinates", () => {
    const searchRowsByObjectId = new Map(
      SearchBurials.map((row) => [String(row.i), row])
    );
    const missingObjectIds = [];
    const coordinateMismatches = [];

    GeoBurials.features.forEach((feature) => {
      const objectId = String(feature.properties?.OBJECTID);
      const searchRow = searchRowsByObjectId.get(objectId);

      if (!searchRow) {
        missingObjectIds.push(objectId);
        return;
      }

      if (JSON.stringify(searchRow.c) !== JSON.stringify(getFeatureCoordinates(feature))) {
        coordinateMismatches.push(objectId);
      }
    });

    expect(SearchBurials).toHaveLength(GeoBurials.features.length);
    expect(missingObjectIds).toEqual([]);
    expect(coordinateMismatches).toEqual([]);
  });

  test("preserves high-precision projected section coordinates in browse records", () => {
    const highPrecisionFeature = ProjectedSec49Headstones.features.find((feature) => (
      hasValidGeoJsonCoordinates(feature) &&
      getFeatureCoordinates(feature).some((value) => getDecimalPrecision(value) > 12)
    ));

    expect(highPrecisionFeature).toBeTruthy();

    const browseRecord = buildTourBrowseResult(highPrecisionFeature, {
      tourKey: "Sec49",
      tourName: "Section 49",
    });

    expect(browseRecord.coordinates).toEqual(getFeatureCoordinates(highPrecisionFeature));
  });
});
