import { describe, expect, test } from "bun:test";
import { getSectionBounds } from "./mapSections";

describe("section camera bounds", () => {
  test("fits all fourteen pieces of Section 49", () => {
    expect(getSectionBounds("49")).toEqual([
      [42.7094728124924, -73.73509052411812],
      [42.710237901535336, -73.73404733557098],
    ]);
  });

  test("does not invent a camera target for an unknown section", () => {
    expect(getSectionBounds("missing")).toBeNull();
    expect(getSectionBounds(18)).toEqual(getSectionBounds("18"));
  });
});
