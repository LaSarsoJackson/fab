import { describe, expect, test } from "bun:test";

import {
  buildMobileSheetRevealIntent,
} from "../src/features/browse/sidebarState";
import { MOBILE_SHEET_STATES } from "../src/features/browse/mobileSheetGeometry";

describe("sidebar state helpers", () => {
  test("does not reveal or scroll the mobile sheet on desktop", () => {
    expect(buildMobileSheetRevealIntent({
      activeBurialId: "grave-2",
      isMobile: false,
      previousActiveBurialId: "grave-1",
      previousSelectionSignature: "grave-1",
      resolvedMobileSheetState: MOBILE_SHEET_STATES.COLLAPSED,
      selectedBurials: [{ id: "grave-1" }, { id: "grave-2" }],
    })).toEqual({
      currentSelectionSignature: "grave-1|grave-2",
      didActiveBurialChange: true,
      didSectionChange: false,
      didSelectionChange: true,
      didTourChange: false,
      shouldExpandMobileSheet: false,
      shouldRevealBrowseContext: false,
      shouldRevealSelectedRecord: false,
      shouldScrollMobileSheetToTop: false,
    });
  });

  test("reveals a selected record from the collapsed mobile sheet", () => {
    expect(buildMobileSheetRevealIntent({
      activeBurialId: "grave-2",
      isMobile: true,
      previousActiveBurialId: "grave-1",
      previousSelectionSignature: "grave-1",
      resolvedMobileSheetState: MOBILE_SHEET_STATES.COLLAPSED,
      selectedBurials: [{ id: "grave-1" }, { id: "grave-2" }],
    })).toMatchObject({
      currentSelectionSignature: "grave-1|grave-2",
      didActiveBurialChange: true,
      didSelectionChange: true,
      shouldExpandMobileSheet: true,
      shouldRevealSelectedRecord: true,
      shouldScrollMobileSheetToTop: true,
    });
  });

  test("scrolls a mobile selection change without re-expanding an already open sheet", () => {
    expect(buildMobileSheetRevealIntent({
      activeBurialId: "grave-2",
      isMobile: true,
      previousActiveBurialId: "grave-1",
      previousSelectionSignature: "grave-1",
      resolvedMobileSheetState: MOBILE_SHEET_STATES.FULL,
      selectedBurials: [{ id: "grave-1" }, { id: "grave-2" }],
    })).toMatchObject({
      shouldExpandMobileSheet: false,
      shouldRevealSelectedRecord: true,
      shouldScrollMobileSheetToTop: true,
    });
  });

  test("reveals a new browse context when no records are selected", () => {
    expect(buildMobileSheetRevealIntent({
      isMobile: true,
      previousSectionFilter: "",
      previousSelectedTour: "",
      resolvedMobileSheetState: MOBILE_SHEET_STATES.PEEK,
      sectionFilter: "12",
      selectedBurials: [],
      selectedTour: "",
    })).toMatchObject({
      currentSelectionSignature: "",
      didSectionChange: true,
      shouldExpandMobileSheet: true,
      shouldRevealBrowseContext: true,
      shouldScrollMobileSheetToTop: true,
    });
  });

  test("keeps the full mobile sheet in place for new browse context", () => {
    expect(buildMobileSheetRevealIntent({
      isMobile: true,
      previousSelectedTour: "",
      resolvedMobileSheetState: MOBILE_SHEET_STATES.FULL,
      selectedBurials: [],
      selectedTour: "Notables Tour 2020",
    })).toMatchObject({
      didTourChange: true,
      shouldExpandMobileSheet: false,
      shouldRevealBrowseContext: true,
      shouldScrollMobileSheetToTop: true,
    });
  });
});
