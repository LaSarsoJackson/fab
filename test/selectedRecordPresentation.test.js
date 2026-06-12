import {
  buildSelectedPlaceInitials,
  getSelectedPlaceDetailRows,
  getSelectedPlaceTypeLabel,
  hasFieldPacketContent,
} from "../src/features/browse/selectedRecordPresentation";

describe("selected record presentation helpers", () => {
  test("builds compact fallback initials from cleaned selected-place headings", () => {
    expect(buildSelectedPlaceInitials("  Ada   Lovelace  Byron  ")).toBe("AL");
    expect(buildSelectedPlaceInitials("rural cemetery")).toBe("RC");
    expect(buildSelectedPlaceInitials("   ")).toBe("AR");
    expect(buildSelectedPlaceInitials(null)).toBe("AR");
  });

  test("labels tour-derived selected records separately from graves", () => {
    expect(getSelectedPlaceTypeLabel({ source: "tour" })).toBe("Tour stop");
    expect(getSelectedPlaceTypeLabel({ tourName: "Civil War Tour" })).toBe("Tour stop");
    expect(getSelectedPlaceTypeLabel({ source: "burial", tourName: "   " })).toBe("Grave");
  });

  test("keeps selected-place detail rows while hiding fields already summarized elsewhere", () => {
    const rows = [
      { label: "Location", value: "Section 10" },
      { label: "Born", value: "1815" },
      { label: "Died", value: "1852" },
      { label: "Section", value: "10" },
      { label: "Lot", value: "4" },
      { label: "Notes", value: "Founder" },
    ];

    expect(getSelectedPlaceDetailRows(rows)).toEqual([
      { label: "Section", value: "10" },
      { label: "Lot", value: "4" },
      { label: "Notes", value: "Founder" },
    ]);
  });

  test("detects whether a field packet has shareable visible content", () => {
    expect(hasFieldPacketContent(null)).toBe(false);
    expect(hasFieldPacketContent({ name: "   ", note: "" })).toBe(false);
    expect(hasFieldPacketContent({ selectedRecords: [{ id: "1" }] })).toBe(true);
    expect(hasFieldPacketContent({ name: "Founders walk" })).toBe(true);
    expect(hasFieldPacketContent({ note: "Check before tour" })).toBe(true);
    expect(hasFieldPacketContent({ sectionFilter: "49" })).toBe(true);
    expect(hasFieldPacketContent({ selectedTour: "Notable Women" })).toBe(true);
    expect(hasFieldPacketContent({ mapBounds: [[42.7, -73.8], [42.8, -73.7]] })).toBe(true);
  });
});
