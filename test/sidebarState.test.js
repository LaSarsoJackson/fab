import { describe, expect, test } from "bun:test";

import {
  buildBrowseSourceChangeIntent,
  buildClearAllBrowseStateIntent,
  buildClearTourSelectionIntent,
  buildBrowseResultSelectIntent,
  buildMobileSearchPanelCollapseResetIntent,
  buildMobileSearchPanelToggleIntent,
  buildMobileSheetRevealIntent,
  buildSectionSelectionIntent,
  buildTourSelectionIntent,
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

  test("builds browse-source intent for returning to all results", () => {
    expect(buildBrowseSourceChangeIntent({
      hasSectionFilters: true,
      hasTourSelection: true,
      nextSource: "all",
    })).toEqual({
      browseSourceToSet: "all",
      shouldClearSectionFilters: true,
      shouldClearTourSelection: true,
      shouldExpandMobileSheet: true,
      shouldMaximizeMobileSheet: false,
      shouldRequestBurialDataLoad: true,
    });
  });

  test("builds browse-source intent for unavailable tour browse", () => {
    expect(buildBrowseSourceChangeIntent({
      hasTourBrowse: false,
      nextSource: "tour",
    })).toEqual({
      browseSourceToSet: "",
      shouldClearSectionFilters: false,
      shouldClearTourSelection: false,
      shouldExpandMobileSheet: true,
      shouldMaximizeMobileSheet: false,
      shouldRequestBurialDataLoad: true,
    });
  });

  test("toggles an empty active scoped browse source back to all", () => {
    expect(buildBrowseSourceChangeIntent({
      browseSource: "section",
      hasSectionFilters: false,
      nextSource: "section",
    })).toEqual({
      browseSourceToSet: "all",
      shouldClearSectionFilters: false,
      shouldClearTourSelection: false,
      shouldExpandMobileSheet: true,
      shouldMaximizeMobileSheet: false,
      shouldRequestBurialDataLoad: true,
    });

    expect(buildBrowseSourceChangeIntent({
      browseSource: "tour",
      hasTourBrowse: true,
      hasTourSelection: false,
      nextSource: "tour",
    })).toMatchObject({
      browseSourceToSet: "all",
      shouldExpandMobileSheet: true,
      shouldMaximizeMobileSheet: false,
    });
  });

  test("builds browse-source intent for entering section and tour scopes", () => {
    expect(buildBrowseSourceChangeIntent({
      hasTourSelection: true,
      nextSource: "section",
    })).toEqual({
      browseSourceToSet: "section",
      shouldClearSectionFilters: false,
      shouldClearTourSelection: true,
      shouldExpandMobileSheet: false,
      shouldMaximizeMobileSheet: true,
      shouldRequestBurialDataLoad: true,
    });

    expect(buildBrowseSourceChangeIntent({
      hasSectionFilters: true,
      hasTourBrowse: true,
      nextSource: "tour",
    })).toEqual({
      browseSourceToSet: "tour",
      shouldClearSectionFilters: true,
      shouldClearTourSelection: false,
      shouldExpandMobileSheet: false,
      shouldMaximizeMobileSheet: true,
      shouldRequestBurialDataLoad: true,
    });
  });

  test("builds clear-all intent with section reset taking precedence over lot-tier reset", () => {
    expect(buildClearAllBrowseStateIntent({
      lotTierFilter: "A",
      sectionFilter: "12",
      selectedTour: "Notables Tour 2020",
    })).toEqual({
      browseQueryToSet: "",
      browseSourceToSet: "all",
      isSelectedSummaryExpandedToSet: false,
      lotTierFilterToSet: "",
      selectedTourToSet: null,
      shouldClearSectionFilters: true,
      shouldClearSelectedBurials: true,
      shouldClearTourSelection: true,
      shouldClearLotTierFilter: false,
      shouldExpandMobileSheet: true,
    });
  });

  test("builds clear-all intent that clears lot-tier directly when no section is active", () => {
    expect(buildClearAllBrowseStateIntent({
      lotTierFilter: "B",
      sectionFilter: "",
      selectedTour: "",
    })).toMatchObject({
      lotTierFilterToSet: "",
      selectedTourToSet: null,
      shouldClearSectionFilters: false,
      shouldClearLotTierFilter: true,
      shouldClearTourSelection: false,
    });
  });

  test("builds clear-all intent for an already idle browse state", () => {
    expect(buildClearAllBrowseStateIntent()).toEqual({
      browseQueryToSet: "",
      browseSourceToSet: "all",
      isSelectedSummaryExpandedToSet: false,
      lotTierFilterToSet: "",
      selectedTourToSet: null,
      shouldClearSectionFilters: false,
      shouldClearSelectedBurials: true,
      shouldClearTourSelection: false,
      shouldClearLotTierFilter: false,
      shouldExpandMobileSheet: true,
    });
  });

  test("builds mobile search-panel toggle intent as a desktop no-op", () => {
    expect(buildMobileSearchPanelToggleIntent({
      canRequestHideChrome: true,
      isMobile: false,
      isMobileSearchPanelCollapsedByControl: false,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.PEEK,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: null,
      shouldCollapseMobileSheet: false,
      shouldExpandMobileSheet: false,
      shouldRequestHideChrome: false,
      shouldSetMobileSearchPanelCollapsedByControl: false,
    });
  });

  test("builds mobile search-panel toggle intent to reopen a collapsed panel", () => {
    expect(buildMobileSearchPanelToggleIntent({
      canRequestHideChrome: true,
      isMobile: true,
      isMobileSearchPanelCollapsedByControl: true,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.PEEK,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: false,
      shouldCollapseMobileSheet: false,
      shouldExpandMobileSheet: true,
      shouldRequestHideChrome: false,
      shouldSetMobileSearchPanelCollapsedByControl: true,
    });

    expect(buildMobileSearchPanelToggleIntent({
      canRequestHideChrome: false,
      isMobile: true,
      isMobileSearchPanelCollapsedByControl: false,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.COLLAPSED,
    })).toMatchObject({
      isMobileSearchPanelCollapsedByControlToSet: false,
      shouldExpandMobileSheet: true,
      shouldSetMobileSearchPanelCollapsedByControl: true,
    });
  });

  test("builds mobile search-panel toggle intent to request external chrome hiding first", () => {
    expect(buildMobileSearchPanelToggleIntent({
      canRequestHideChrome: true,
      isMobile: true,
      isMobileSearchPanelCollapsedByControl: false,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.PEEK,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: null,
      shouldCollapseMobileSheet: false,
      shouldExpandMobileSheet: false,
      shouldRequestHideChrome: true,
      shouldSetMobileSearchPanelCollapsedByControl: false,
    });
  });

  test("builds mobile search-panel toggle intent to locally collapse when chrome cannot hide", () => {
    expect(buildMobileSearchPanelToggleIntent({
      canRequestHideChrome: false,
      isMobile: true,
      isMobileSearchPanelCollapsedByControl: false,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.FULL,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: true,
      shouldCollapseMobileSheet: true,
      shouldExpandMobileSheet: false,
      shouldRequestHideChrome: false,
      shouldSetMobileSearchPanelCollapsedByControl: true,
    });
  });

  test("builds mobile search-panel collapse reset intent outside the collapsed mobile state", () => {
    expect(buildMobileSearchPanelCollapseResetIntent({
      isMobile: false,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.COLLAPSED,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: false,
      shouldSetMobileSearchPanelCollapsedByControl: true,
    });

    expect(buildMobileSearchPanelCollapseResetIntent({
      isMobile: true,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.PEEK,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: false,
      shouldSetMobileSearchPanelCollapsedByControl: true,
    });

    expect(buildMobileSearchPanelCollapseResetIntent({
      isMobile: true,
      resolvedMobileSheetState: MOBILE_SHEET_STATES.COLLAPSED,
    })).toEqual({
      isMobileSearchPanelCollapsedByControlToSet: null,
      shouldSetMobileSearchPanelCollapsedByControl: false,
    });
  });

  test("builds browse-result select intent to reveal an empty mobile selection summary", () => {
    expect(buildBrowseResultSelectIntent({
      isMobile: true,
      selectedBurialsLength: 0,
    })).toEqual({
      isSelectedSummaryExpandedToSet: true,
      shouldSetSelectedSummaryExpanded: true,
    });
  });

  test("does not expand selected summary for desktop or existing mobile selections", () => {
    expect(buildBrowseResultSelectIntent({
      isMobile: false,
      selectedBurialsLength: 0,
    })).toEqual({
      isSelectedSummaryExpandedToSet: null,
      shouldSetSelectedSummaryExpanded: false,
    });

    expect(buildBrowseResultSelectIntent({
      isMobile: true,
      selectedBurialsLength: 2,
    })).toEqual({
      isSelectedSummaryExpandedToSet: null,
      shouldSetSelectedSummaryExpanded: false,
    });
  });

  test("builds tour-selection intent only when tour browse is available", () => {
    expect(buildTourSelectionIntent({
      hasTourBrowse: false,
      tourName: "Notables Tour 2020",
    })).toEqual({
      browseSourceToSet: "",
      selectedTourToSet: null,
      shouldMaximizeMobileSheet: false,
      shouldSetBrowseSource: false,
      shouldSetTourSelection: false,
    });

    expect(buildTourSelectionIntent({
      hasTourBrowse: true,
      tourName: "Notables Tour 2020",
    })).toEqual({
      browseSourceToSet: "tour",
      selectedTourToSet: "Notables Tour 2020",
      shouldMaximizeMobileSheet: true,
      shouldSetBrowseSource: true,
      shouldSetTourSelection: true,
    });
  });

  test("builds clear-tour-selection intent that keeps tour browse active", () => {
    expect(buildClearTourSelectionIntent()).toEqual({
      browseSourceToSet: "tour",
      selectedTourToSet: null,
      shouldMaximizeMobileSheet: true,
      shouldSetBrowseSource: true,
      shouldSetTourSelection: true,
    });
  });

  test("builds section-selection intent with normalized empty section values", () => {
    expect(buildSectionSelectionIntent({ nextSection: "12" })).toEqual({
      browseSourceToSet: "section",
      sectionFilterToSet: "12",
      shouldMaximizeMobileSheet: true,
      shouldRequestBurialDataLoad: true,
      shouldSetBrowseSource: true,
      shouldSetSectionFilter: true,
    });

    expect(buildSectionSelectionIntent({ nextSection: null })).toMatchObject({
      browseSourceToSet: "section",
      sectionFilterToSet: "",
      shouldRequestBurialDataLoad: true,
    });
  });
});
