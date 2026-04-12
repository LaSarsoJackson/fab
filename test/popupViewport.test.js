import { describe, expect, test } from "bun:test";
import { getPopupViewportPadding } from "../src/lib/popupViewport";

describe("getPopupViewportPadding", () => {
  test("keeps popups clear of a full-height desktop sidebar", () => {
    const result = getPopupViewportPadding({
      containerRect: { left: 0, top: 0, right: 1280, bottom: 800 },
      overlayRect: { left: 0, top: 0, right: 390, bottom: 800 },
    });

    expect(result).toEqual({
      topLeft: [406, 16],
      bottomRight: [16, 16],
    });
  });

  test("keeps popups above a mobile bottom sheet", () => {
    const result = getPopupViewportPadding({
      containerRect: { left: 0, top: 0, right: 390, bottom: 844 },
      overlayRect: { left: 0, top: 544, right: 390, bottom: 844 },
    });

    expect(result).toEqual({
      topLeft: [16, 16],
      bottomRight: [16, 316],
    });
  });

  test("falls back to the base padding when there is no overlap", () => {
    const result = getPopupViewportPadding({
      containerRect: { left: 0, top: 0, right: 1280, bottom: 800 },
      overlayRect: { left: 1320, top: 0, right: 1520, bottom: 800 },
    });

    expect(result).toEqual({
      topLeft: [16, 16],
      bottomRight: [16, 16],
    });
  });
});
