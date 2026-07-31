import { buildBrowseResultCardPresentation } from "../src/features/browse/browseResultPresentation";

describe("browse result presentation helpers", () => {
  test("builds scoped section result card copy without repeating the active section", () => {
    expect(buildBrowseResultCardPresentation({
      result: {
        displayName: "Ada Lovelace",
        Section: "49",
        Lot: "12",
        Tier: "A",
        Grave: "5",
        Birth: "1815",
        Death: "1852",
        secondaryText: "Fallback copy",
      },
      scopedSectionLabel: "Section 49",
    })).toEqual({
      displayName: "Ada Lovelace",
      lifeSummary: "Born 1815 \u2022 Died 1852",
      locationSummary: "Lot 12 \u00b7 Tier A \u00b7 Grave 5",
      secondarySummary: "",
      tourChipLabel: "",
    });
  });

  test("builds one complete location line for a global burial result", () => {
    expect(buildBrowseResultCardPresentation({
      result: {
        displayName: "Ada Lovelace",
        Section: "49",
        Lot: "12",
        Tier: "A",
        Grave: "5",
        Birth: "1815",
        Death: "1852",
      },
    })).toEqual({
      displayName: "Ada Lovelace",
      lifeSummary: "Born 1815 \u2022 Died 1852",
      locationSummary: "Section 49 \u00b7 Lot 12 \u00b7 Tier A \u00b7 Grave 5",
      secondarySummary: "",
      tourChipLabel: "",
    });
  });

  test("falls back to secondary text and suppresses the active tour chip", () => {
    expect(buildBrowseResultCardPresentation({
      result: {
        displayName: "Tour Marker",
        secondaryText: "Memorial path entrance",
        tourName: "Founders Tour",
      },
      scopedTourLabel: "Founders Tour",
      tourStyleName: "Profile Tour Label",
    })).toEqual({
      displayName: "Tour Marker",
      lifeSummary: "",
      locationSummary: "",
      secondarySummary: "Memorial path entrance",
      tourChipLabel: "",
    });
  });

  test("uses tour metadata as the chip label outside the active tour scope", () => {
    expect(buildBrowseResultCardPresentation({
      result: {
        First_Name: "Anna",
        Last_Name: "Tracy",
        tourKey: "notable-women",
      },
      scopedTourLabel: "Civil War Tour",
      tourStyleName: "Notable Women",
    })).toMatchObject({
      displayName: "Anna Tracy",
      tourChipLabel: "Notable Women",
    });
  });
});
