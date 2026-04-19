import { describe, expect, test } from "bun:test";

import { getStackedBurialMarkerOffset } from "../src/features/map/engine/burialMarkerOffsets";

describe("burial marker offsets", () => {
  test("keeps burial markers unshifted below the terminal cluster zoom", () => {
    expect(
      getStackedBurialMarkerOffset(20, {
        id: "anna-tracy",
        Grave: 3,
        Tier: 2,
      })
    ).toEqual({ dx: 0, dy: 0 });
  });

  test("returns a stable non-zero offset once stacked markers are de-clustered", () => {
    const firstOffset = getStackedBurialMarkerOffset(21, {
      id: "anna-tracy",
      Grave: 3,
      Tier: 2,
    });
    const secondOffset = getStackedBurialMarkerOffset(21, {
      id: "anna-tracy",
      Grave: 3,
      Tier: 2,
    });

    expect(firstOffset).toEqual(secondOffset);
    expect(firstOffset.dx || firstOffset.dy).not.toBe(0);
  });
});
