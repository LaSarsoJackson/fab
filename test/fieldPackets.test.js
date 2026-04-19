import { describe, expect, test } from "bun:test";

import {
  buildFieldPacketShareUrl,
  buildFieldPacketState,
  parseFieldPacketValue,
} from "../src/features/deeplinks";

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
      currentUrl: "https://example.com/app?view=tours&tour=notables&packet=legacy",
    });
    const parsedShareUrl = new URL(shareUrl);
    const parsedPacket = parseFieldPacketValue(parsedShareUrl.searchParams.get("share"));

    expect(parsedShareUrl.searchParams.get("view")).toBeNull();
    expect(parsedShareUrl.searchParams.get("tour")).toBeNull();
    expect(parsedShareUrl.searchParams.get("packet")).toBeNull();
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
});
