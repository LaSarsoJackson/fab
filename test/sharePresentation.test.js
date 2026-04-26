import { describe, expect, test } from "bun:test";

import {
  buildSharedSelectionPresentation,
  formatSharedSelectionCountLabel,
} from "../src/features/deeplinks/sharePresentation";

describe("sharePresentation", () => {
  test("formats selection counts for landing and share copy", () => {
    expect(formatSharedSelectionCountLabel(1)).toBe("1 selected record");
    expect(formatSharedSelectionCountLabel(3)).toBe("3 selected records");
  });

  test("prefers the saved note for shared-link descriptions", () => {
    expect(buildSharedSelectionPresentation({
      name: "Anna Tracy",
      note: "Bring the preservation report before you visit.",
      selectedRecords: [
        {
          id: "burial:1:99:18",
          displayName: "Anna Tracy",
          Section: "99",
        },
      ],
    })).toEqual({
      title: "Anna Tracy",
      description: "Bring the preservation report before you visit.",
      countLabel: "1 selected record",
      sectionLabel: "",
      selectedTour: "",
      recordCount: 1,
    });
  });

  test("builds a clean fallback description from section and count", () => {
    expect(buildSharedSelectionPresentation({
      sectionFilter: "99",
      selectedRecords: [
        { id: "burial:1:99:18", displayName: "Anna Tracy", Section: "99" },
        { id: "burial:2:99:18", displayName: "Thomas Tracy", Section: "99" },
      ],
    })).toEqual({
      title: "Section 99",
      description: "2 selected records in Section 99.",
      countLabel: "2 selected records",
      sectionLabel: "Section 99",
      selectedTour: "",
      recordCount: 2,
    });
  });
});
