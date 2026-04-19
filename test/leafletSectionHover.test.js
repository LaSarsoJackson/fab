import { describe, expect, test } from "bun:test";

import {
  beginLeafletSectionHover,
  clearLeafletSectionHover,
  createLeafletSectionHoverState,
  isLeafletSectionLayerHovered,
} from "../src/features/map/leafletSectionHover";

describe("leafletSectionHover", () => {
  test("clears the previously hovered layer when moving between features in the same section", () => {
    const firstLayer = { id: "first" };
    const secondLayer = { id: "second" };

    const { clearedHoverState, nextHoverState } = beginLeafletSectionHover(
      createLeafletSectionHoverState({
        sectionId: "49",
        layer: firstLayer,
      }),
      createLeafletSectionHoverState({
        sectionId: "49",
        layer: secondLayer,
      })
    );

    expect(clearedHoverState).toEqual({
      sectionId: "49",
      layer: firstLayer,
    });
    expect(nextHoverState).toEqual({
      sectionId: "49",
      layer: secondLayer,
    });
  });

  test("returns the exact hovered layer to restore when clearing hover state", () => {
    const layer = { id: "section-piece" };
    const { clearedHoverState, nextHoverState } = clearLeafletSectionHover({
      sectionId: 38,
      layer,
    });

    expect(clearedHoverState).toEqual({
      sectionId: "38",
      layer,
    });
    expect(nextHoverState).toEqual({
      sectionId: null,
      layer: null,
    });
  });

  test("tracks hovered layers by layer identity", () => {
    const layer = { id: "section-piece" };
    const otherLayer = { id: "other-piece" };
    const hoverState = createLeafletSectionHoverState({
      sectionId: "38",
      layer,
    });

    expect(isLeafletSectionLayerHovered(hoverState, layer)).toBe(true);
    expect(isLeafletSectionLayerHovered(hoverState, otherLayer)).toBe(false);
  });
});
