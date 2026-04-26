import { describe, expect, test } from "bun:test";

import tourBiographyAliases from "../src/data/TourBiographyAliases.json";
import { TOUR_DEFINITIONS } from "../src/features/fab/profile";
import { buildTourBiographyAliases } from "../src/features/tours/tourDerivedData";

describe("tour derived data", () => {
  test("checked-in biography aliases stay in sync with the bundled tour datasets", async () => {
    const records = [];

    for (const definition of TOUR_DEFINITIONS) {
      const module = await definition.load();
      const features = module.default?.features || module.features || [];
      records.push(...features.map((feature) => feature.properties || {}));
    }

    expect(buildTourBiographyAliases(records)).toEqual(tourBiographyAliases);
  });
});
