import { describe, expect, test } from "bun:test";
import { shouldIgnoreSectionBackgroundSelection } from "../src/features/map";

describe("shouldIgnoreSectionBackgroundSelection", () => {
  test("ignores background clicks on the already active section", () => {
    expect(shouldIgnoreSectionBackgroundSelection({
      clickedSection: "49",
      activeSection: 49,
    })).toBe(true);
  });

  test("allows selecting a different section", () => {
    expect(shouldIgnoreSectionBackgroundSelection({
      clickedSection: "49",
      activeSection: "75",
    })).toBe(false);
  });

  test("allows clicks when no section is active yet", () => {
    expect(shouldIgnoreSectionBackgroundSelection({
      clickedSection: "49",
      activeSection: "",
    })).toBe(false);
  });
});
