import { describe, expect, test } from "bun:test";

import {
  buildSharedSelectionPresentation,
  buildFieldPacketShareUrl,
  buildFieldPacketState,
  encodeFieldPacket,
  formatSharedSelectionCountLabel,
  parseDeepLinkState,
  parseFieldPacketValue,
} from "../src/features/deeplinks/fieldPackets";

const selectedRecords = [
  {
    id: "burial:1:99:18",
    source: "burial",
    displayName: "Anna Tracy",
    Section: "99",
    Lot: "18",
    Birth: "12/2/1858",
    Death: "1/28/1945",
    coordinates: [-73.733659, 42.711919],
  },
  {
    id: "tour:Notable:1:99:18",
    source: "tour",
    displayName: "Anna Tracy",
    Section: "99",
    Lot: "18",
    coordinates: [-73.733659, 42.711919],
    tourKey: "Notable",
    tourName: "Notables Tour 2020",
  },
];

describe("fieldPackets", () => {
  test("normalizes a packet into share-safe state", () => {
    expect(buildFieldPacketState({
      note: " Verify section markers ",
      selectedRecords,
      activeBurialId: "tour:Notable:1:99:18",
      sectionFilter: "99",
      mapBounds: [
        [42.70, -73.74],
        [42.71, -73.73],
      ],
    })).toEqual({
      version: 1,
      name: "Section 99",
      note: "Verify section markers",
      activeBurialId: "tour:Notable:1:99:18",
      selectedBurialIds: [
        "burial:1:99:18",
        "tour:Notable:1:99:18",
      ],
      selectedRecords: [
        {
          id: "burial:1:99:18",
          source: "burial",
          displayName: "Anna Tracy",
          label: "Anna Tracy",
          fullName: "Anna Tracy",
          Section: "99",
          Lot: "18",
          Birth: "12/2/1858",
          Death: "1/28/1945",
          coordinates: [-73.733659, 42.711919],
        },
        {
          id: "tour:Notable:1:99:18",
          source: "tour",
          displayName: "Anna Tracy",
          label: "Anna Tracy",
          fullName: "Anna Tracy",
          Section: "99",
          Lot: "18",
          tourKey: "Notable",
          tourName: "Notables Tour 2020",
          coordinates: [-73.733659, 42.711919],
        },
      ],
      sectionFilter: "99",
      selectedTour: "",
      mapBounds: [
        [42.7, -73.74],
        [42.71, -73.73],
      ],
    });
  });

  test("builds a packet share URL and parses it back", () => {
    const packet = buildFieldPacketState({
      name: "Notables route",
      note: "Bring the preservation report.",
      selectedRecords: [selectedRecords[0]],
      activeBurialId: selectedRecords[0].id,
      selectedTour: "Notables Tour 2020",
    });
    const shareUrl = buildFieldPacketShareUrl({
      packet,
      currentUrl: "https://example.com/app?view=tours&tour=notables",
    });
    const parsedShareUrl = new URL(shareUrl);
    const parsedPacket = parseFieldPacketValue(parsedShareUrl.searchParams.get("share"));

    expect(parsedShareUrl.searchParams.get("view")).toBeNull();
    expect(parsedShareUrl.searchParams.get("tour")).toBeNull();
    expect(parsedPacket).toEqual(packet);
  });

  test("preserves a cleared active burial when selected records remain pinned", () => {
    expect(buildFieldPacketState({
      selectedRecords,
      activeBurialId: "",
      sectionFilter: "99",
    })).toMatchObject({
      activeBurialId: "",
      selectedBurialIds: [
        "burial:1:99:18",
        "tour:Notable:1:99:18",
      ],
      sectionFilter: "99",
    });
  });

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

  test("parses view, query, and section", () => {
    const state = parseDeepLinkState("?view=burials&q=John%20Doe&section=12");

    expect(state.view).toBe("burials");
    expect(state.showBurialsView).toBe(true);
    expect(state.section).toBe("12");
    expect(state.query).toBe("John Doe");
  });

  test("matches a tour by partial name", () => {
    const state = parseDeepLinkState("?tour=civil%20war", [
      "Notables Tour 2020",
      "Civil War Tour 2020",
    ]);

    expect(state.selectedTourName).toBe("Civil War Tour 2020");
    expect(state.rawTour).toBe("civil war");
  });

  test("handles missing deep-link values safely", () => {
    const state = parseDeepLinkState("");

    expect(state.section).toBe("");
    expect(state.query).toBe("");
    expect(state.selectedTourName).toBeNull();
    expect(state.showBurialsView).toBe(false);
    expect(state.showToursView).toBe(false);
    expect(state.fieldPacket).toBeNull();
  });

  test("parses a shared link from the URL", () => {
    const encodedPacket = encodeFieldPacket({
      name: "Section 99",
      note: "Verify the headstones near the lane.",
      activeBurialId: "burial:1:99:18",
      selectedRecords: [
        {
          id: "burial:1:99:18",
          source: "burial",
          displayName: "Anna Tracy",
          Section: "99",
          Lot: "18",
          coordinates: [-73.733659, 42.711919],
        },
      ],
      sectionFilter: "99",
    });

    const state = parseDeepLinkState(`?share=${encodedPacket}`);

    expect(state.fieldPacket).toEqual({
      version: 1,
      name: "Section 99",
      note: "Verify the headstones near the lane.",
      activeBurialId: "burial:1:99:18",
      selectedBurialIds: ["burial:1:99:18"],
      selectedRecords: [
        {
          id: "burial:1:99:18",
          source: "burial",
          displayName: "Anna Tracy",
          label: "Anna Tracy",
          fullName: "Anna Tracy",
          Section: "99",
          Lot: "18",
          coordinates: [-73.733659, 42.711919],
        },
      ],
      sectionFilter: "99",
      selectedTour: "",
      mapBounds: null,
    });
  });

  test("keeps a shared link selection unfocused when no active burial id is encoded", () => {
    const encodedPacket = encodeFieldPacket({
      selectedRecords: [
        {
          id: "burial:1:99:18",
          source: "burial",
          displayName: "Anna Tracy",
          Section: "99",
          Lot: "18",
        },
      ],
      activeBurialId: "",
    });

    const state = parseDeepLinkState(`?share=${encodedPacket}`);

    expect(state.fieldPacket?.activeBurialId).toBe("");
    expect(state.fieldPacket?.selectedBurialIds).toEqual(["burial:1:99:18"]);
  });

  test("builds public share links with the share query param", () => {
    const shareUrl = buildFieldPacketShareUrl({
      packet: {
        selectedRecords: [
          {
            id: "burial:1:99:18",
            source: "burial",
            displayName: "Anna Tracy",
            Section: "99",
            Lot: "18",
          },
        ],
      },
      currentUrl: "https://example.com/fab?view=burials&q=anna",
    });
    const parsedShareUrl = new URL(shareUrl);

    expect(parsedShareUrl.searchParams.get("share")).toBeTruthy();
    expect(parsedShareUrl.searchParams.get("view")).toBeNull();
    expect(parsedShareUrl.searchParams.get("q")).toBeNull();
  });
});
