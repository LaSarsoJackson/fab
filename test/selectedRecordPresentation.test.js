import {
  buildSelectedBurialLookup,
  buildSelectedLocationLabel,
  buildSelectedPlaceDetailPresentation,
  buildSelectedSummaryPresentation,
  buildSelectedPlaceInitials,
  getSelectedPlaceDetailRows,
  getSelectedPlaceTypeLabel,
  hasFieldPacketContent,
} from "../src/features/browse/selectedRecordPresentation";

describe("selected record presentation helpers", () => {
  test("builds selected-burial lookup metadata for result rows", () => {
    const firstRecord = { id: "grave-a", displayName: "First Grave" };
    const secondRecord = { id: "grave-b", displayName: "Second Grave" };

    const lookup = buildSelectedBurialLookup({
      selectedBurials: [firstRecord, { displayName: "Missing id" }, secondRecord],
    });

    expect(lookup.selectedBurialCount).toBe(3);
    expect(Array.from(lookup.selectedBurialIds.values())).toEqual(["grave-a", "grave-b"]);
    expect(Array.from(lookup.selectedBurialOrderById.entries())).toEqual([
      ["grave-a", 0],
      ["grave-b", 2],
    ]);
  });

  test("builds compact selected-place detail presentation with hidden row count", () => {
    const rows = [
      { label: "Location", value: "Section 10" },
      { label: "Born", value: "1815" },
      { label: "Died", value: "1852" },
      { label: "Section", value: "10" },
      { label: "Lot", value: "4" },
      { label: "Tier", value: "A" },
      { label: "Grave", value: "8" },
      { label: "Notes", value: "Founder" },
    ];

    expect(buildSelectedPlaceDetailPresentation({
      detailLinkUrl: " https://example.test/details ",
      isExpanded: false,
      rows,
      visibleRowLimit: 3,
    })).toEqual({
      allDetailRows: [
        { label: "Section", value: "10" },
        { label: "Lot", value: "4" },
        { label: "Tier", value: "A" },
        { label: "Grave", value: "8" },
        { label: "Notes", value: "Founder" },
      ],
      detailLinkUrl: "https://example.test/details",
      hasDetailsContent: true,
      hasMoreRows: true,
      hiddenCount: 2,
      visibleRows: [
        { label: "Section", value: "10" },
        { label: "Lot", value: "4" },
        { label: "Tier", value: "A" },
      ],
    });
  });

  test("returns every selected-place detail row when expanded", () => {
    const rows = [
      { label: "Section", value: "10" },
      { label: "Lot", value: "4" },
      { label: "Tier", value: "A" },
      { label: "Grave", value: "8" },
    ];

    const presentation = buildSelectedPlaceDetailPresentation({
      isExpanded: true,
      rows,
      visibleRowLimit: 2,
    });

    expect(presentation.visibleRows).toEqual(rows);
    expect(presentation.hiddenCount).toBe(2);
    expect(presentation.hasMoreRows).toBe(true);
  });

  test("treats a details link as content even when no detail rows remain", () => {
    expect(buildSelectedPlaceDetailPresentation({
      detailLinkUrl: "https://example.test/profile",
      rows: [
        { label: "Location", value: "Section 10" },
        { label: "Born", value: "1815" },
      ],
    })).toMatchObject({
      allDetailRows: [],
      detailLinkUrl: "https://example.test/profile",
      hasDetailsContent: true,
      hasMoreRows: false,
      hiddenCount: 0,
      visibleRows: [],
    });
  });

  test("returns no selected-summary presentation when there is no lead record", () => {
    expect(buildSelectedSummaryPresentation({
      activeBurialId: "missing",
      selectedBurials: [],
    })).toBeNull();
  });

  test("builds mobile selected-summary metadata for a same-marker stack", () => {
    const firstRecord = { id: "grave-a", displayName: "First Grave", tourKey: "tour-a" };
    const secondRecord = { id: "grave-b", displayName: "Second Grave", tourKey: "tour-b" };
    const presentation = buildSelectedSummaryPresentation({
      activeBurialId: "grave-b",
      activeRouteBurialId: "grave-b",
      isMobile: true,
      selectedBurialCoordinateGroups: [
        {
          recordIds: ["grave-a", "grave-b"],
          records: [firstRecord, secondRecord],
        },
      ],
      selectedBurials: [firstRecord, secondRecord],
    });

    expect(presentation).toMatchObject({
      hasMultipleSelectedBurials: true,
      isLeadBurialActive: true,
      isRouteActive: true,
      leadBurial: secondRecord,
      leadBurialIndex: 1,
      mobileSelectionSummaryTitle: "2 people at this plot",
      selectionSummaryLabel: "2 burial records share this mapped cemetery location.",
      selectionSummaryTitle: "People at this plot",
      shouldShowSecondarySelections: false,
      secondarySelectedBurials: [firstRecord],
    });
    expect(Array.from(presentation.selectedBurialOrderById.entries())).toEqual([
      ["grave-a", 0],
      ["grave-b", 1],
    ]);
    expect(presentation.leadStackList).toEqual({
      activeRecordId: "grave-b",
      description: "2 burial records at this marker",
      records: [firstRecord, secondRecord],
    });
  });

  test("builds desktop selected-summary metadata with secondary records visible", () => {
    const firstRecord = { id: "grave-a", displayName: "First Grave" };
    const secondRecord = { id: "grave-b", displayName: "Second Grave" };

    expect(buildSelectedSummaryPresentation({
      activeBurialId: "",
      activeRouteBurialId: "",
      isMobile: false,
      selectedBurials: [firstRecord, secondRecord],
    })).toMatchObject({
      isLeadBurialActive: false,
      isRouteActive: false,
      leadBurial: firstRecord,
      leadBurialIndex: 0,
      leadStackList: null,
      mobileSelectionSummaryTitle: "2 people at this plot",
      selectionSummaryTitle: "People at this plot",
      shouldShowSecondarySelections: true,
      secondarySelectedBurials: [secondRecord],
    });
  });

  test("builds a useful plot label without placeholder zero values", () => {
    expect(buildSelectedLocationLabel({
      Section: "17",
      Lot: "1",
      Tier: 0,
      Grave: "0",
    })).toBe("Section 17 · Lot 1");
    expect(buildSelectedLocationLabel({ section: "", lot: null })).toBe("");
  });

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
