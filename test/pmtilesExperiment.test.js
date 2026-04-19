import { describe, expect, test } from "bun:test";

import {
  getPmtilesExperimentGlyphOffset,
  getPmtilesExperimentGlyphSize,
  hasIndexedBurialPlacement,
} from "../src/features/map";

describe("pmtiles experiment helpers", () => {
  test("detects indexed burial placement from grave or tier metadata", () => {
    expect(hasIndexedBurialPlacement({ Grave: 2 })).toBe(true);
    expect(hasIndexedBurialPlacement({ Tier: 3 })).toBe(true);
    expect(hasIndexedBurialPlacement({ Grave: "0", Tier: "0" })).toBe(false);
    expect(hasIndexedBurialPlacement({ Grave: "not-a-number" })).toBe(false);
  });

  test("keeps glyph offsets deterministic for the same burial record", () => {
    const burialRecord = {
      OBJECTID: 42,
      Section: "107",
      Lot: "3",
      Grave: 4,
      Tier: 2,
      First_Name: "Anna",
      Last_Name: "Tracy",
    };

    expect(getPmtilesExperimentGlyphOffset(20, burialRecord, true)).toEqual(
      getPmtilesExperimentGlyphOffset(20, burialRecord, true)
    );
    expect(getPmtilesExperimentGlyphOffset(18, burialRecord, false)).toEqual(
      getPmtilesExperimentGlyphOffset(18, burialRecord, false)
    );
  });

  test("increases glyph size as zoom increases and favors indexed records", () => {
    expect(getPmtilesExperimentGlyphSize(18, false)).toBeLessThan(
      getPmtilesExperimentGlyphSize(18, true)
    );
    expect(getPmtilesExperimentGlyphSize(18, true)).toBeLessThan(
      getPmtilesExperimentGlyphSize(22, true)
    );
  });
});
