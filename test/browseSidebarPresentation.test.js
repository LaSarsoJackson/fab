import { describe, expect, test } from "bun:test";

import {
  buildAutocompletePresentation,
  buildBrowseEmptyActionSpecs,
  buildBrowseResultsPanelPresentation,
  buildBrowseScopeChips,
  buildLifeDatesSummary,
  buildMobileSearchPanelTogglePresentation,
  buildSearchShellNotices,
  formatLocationNoticeLabel,
  getBrowseEmptyState,
  getLocationNoticeTone,
  getSearchPlaceholder,
  getSearchShellNoticeStyles,
} from "../src/features/browse/sidebarPresentation";

describe("browse sidebar presentation helpers", () => {
  test("builds autocomplete overlay presentation for desktop and mobile", () => {
    expect(buildAutocompletePresentation({ isMobile: false })).toEqual({
      componentsProps: {
        popper: {
          className: "left-sidebar__autocomplete-popper",
          placement: "bottom-start",
        },
        paper: {
          elevation: 8,
          className: "left-sidebar__autocomplete-paper",
        },
      },
      listboxProps: {
        sx: {
          maxHeight: 240,
        },
      },
    });

    expect(buildAutocompletePresentation({ isMobile: true })).toEqual({
      componentsProps: {
        popper: {
          className: "left-sidebar__autocomplete-popper",
          placement: "auto-start",
        },
        paper: {
          elevation: 8,
          className: "left-sidebar__autocomplete-paper",
        },
      },
      listboxProps: {
        sx: {
          maxHeight: "min(40svh, 320px)",
          py: 0.75,
        },
      },
    });
  });

  test("builds mobile search-panel toggle presentation from collapse state", () => {
    expect(buildMobileSearchPanelTogglePresentation({
      collapsedSheetState: "collapsed",
      isMobileSearchPanelCollapsedByControl: false,
      resolvedMobileSheetState: "peek",
    })).toEqual({
      iconSx: {
        transform: "rotate(0deg)",
        transition: "transform 0.2s ease",
      },
      isCollapsed: false,
      label: "Collapse",
    });

    expect(buildMobileSearchPanelTogglePresentation({
      collapsedSheetState: "collapsed",
      isMobileSearchPanelCollapsedByControl: false,
      resolvedMobileSheetState: "collapsed",
    })).toEqual({
      iconSx: {
        transform: "rotate(180deg)",
        transition: "transform 0.2s ease",
      },
      isCollapsed: true,
      label: "Search",
    });

    expect(buildMobileSearchPanelTogglePresentation({
      collapsedSheetState: "collapsed",
      isMobileSearchPanelCollapsedByControl: true,
      resolvedMobileSheetState: "peek",
    })).toMatchObject({
      isCollapsed: true,
      label: "Search",
    });
  });

  test("builds browse placeholders from the current browse scope", () => {
    expect(getSearchPlaceholder({
      browseSource: "section",
      isBurialDataLoading: false,
      sectionFilter: "12",
      selectedTour: "",
    })).toBe("Search this section");

    expect(getSearchPlaceholder({
      browseSource: "tour",
      isBurialDataLoading: false,
      sectionFilter: "",
      selectedTour: "",
    })).toBe("Select a tour to browse");
  });

  test("formats browse empty states for pinned contexts", () => {
    expect(getBrowseEmptyState({
      browseSource: "tour",
      isBurialDataLoading: false,
      isCurrentTourLoading: false,
      query: "",
      sectionFilter: "",
      selectedTour: "",
      tourLabel: "Tour",
    })).toBe("Choose a tour above.");

    expect(getBrowseEmptyState({
      browseSource: "all",
      isBurialDataLoading: false,
      isCurrentTourLoading: false,
      query: "a",
      sectionFilter: "",
      selectedTour: "",
      minBrowseQueryLength: 2,
    })).toBe("Keep typing.");
  });

  test("keeps location notices and tone mapping together", () => {
    expect(formatLocationNoticeLabel({
      status: "Location active",
      activeStatus: "Location active",
      locatingStatus: "Locating...",
    })).toBe("Using your current location for directions.");

    expect(getLocationNoticeTone({
      status: "Locating...",
      activeStatus: "Location active",
      locatingStatus: "Locating...",
    })).toBe("neutral");
  });

  test("returns the expected neutral search notice palette", () => {
    expect(getSearchShellNoticeStyles("neutral")).toEqual({
      backgroundColor: "rgba(20, 33, 43, 0.05)",
      border: "1px solid rgba(20, 33, 43, 0.08)",
      color: "var(--muted-text)",
      dotColor: "rgba(103, 115, 129, 0.6)",
    });
  });

  test("builds search shell notices in display priority order", () => {
    expect(buildSearchShellNotices({
      burialRecordCount: 100,
      defaultLocationStatus: "Location inactive",
      activeLocationStatus: "Location active",
      locatingLocationStatus: "Locating...",
      isBurialDataLoading: false,
      isInstalled: false,
      isOnline: true,
      isSearchIndexReady: true,
      loadingTourName: "",
      showIosInstallHint: true,
      status: "Location active",
    })).toEqual([
      {
        key: "location",
        tone: "success",
        label: "Using your current location for directions.",
      },
      {
        key: "install",
        tone: "neutral",
        label: "Safari: Share → Add to Home Screen",
      },
    ]);

    expect(buildSearchShellNotices({
      burialRecordCount: 100,
      defaultLocationStatus: "Location inactive",
      activeLocationStatus: "Location active",
      locatingLocationStatus: "Locating...",
      isBurialDataLoading: false,
      isInstalled: true,
      isOnline: false,
      isSearchIndexReady: true,
      loadingTourName: "Notables Tour 2020",
      showIosInstallHint: false,
      status: "Location inactive",
    })).toEqual([
      {
        key: "offline",
        tone: "warning",
        label: "Offline. Cached searches and cemetery layers may still work after a prior load; live maps, links, and GPS can be limited.",
      },
    ]);
  });

  test("suppresses fast-search setup notice once visible query results exist", () => {
    expect(buildSearchShellNotices({
      burialRecordCount: 100,
      browseResultCount: 12,
      defaultLocationStatus: "Location inactive",
      activeLocationStatus: "Location active",
      locatingLocationStatus: "Locating...",
      hasActiveBrowseQuery: true,
      isBurialDataLoading: false,
      isInstalled: true,
      isOnline: true,
      isSearchIndexReady: false,
      loadingTourName: "",
      showIosInstallHint: false,
      status: "Location inactive",
    })).toEqual([]);
  });

  test("builds browse scope chips from the active browse context", () => {
    expect(buildBrowseScopeChips({
      browseSource: "section",
      filterType: "tier",
      lotTierFilter: "4",
      sectionFilter: "12",
      selectedTour: "",
      showAllBurials: true,
    })).toEqual([
      { key: "detail", label: "Tier 4" },
      { key: "markers", label: "Markers visible" },
    ]);

    expect(buildBrowseScopeChips({
      browseSource: "tour",
      filterType: "lot",
      lotTierFilter: "",
      sectionFilter: "",
      selectedTour: "Notables Tour 2020",
      showAllBurials: false,
    })).toEqual([]);
  });

  test("builds empty-state action specs for each browse mode", () => {
    expect(buildBrowseEmptyActionSpecs({
      browseResultCount: 0,
      browseSource: "all",
      hasMinimumBrowseQuery: true,
      isCurrentTourLoading: false,
      sectionFilter: "",
      selectedTour: "",
      tourLabel: "Tour",
    })).toEqual([
      {
        key: "clear-search",
        action: "clear-search",
        label: "Clear search",
        variant: "contained",
      },
    ]);

    expect(buildBrowseEmptyActionSpecs({
      browseResultCount: 0,
      browseSource: "section",
      hasMinimumBrowseQuery: false,
      isCurrentTourLoading: false,
      sectionFilter: "8",
      selectedTour: "",
      tourLabel: "Tour",
    })).toEqual([
      {
        key: "reset-section",
        action: "reset-section",
        label: "Choose another section",
        variant: "contained",
      },
    ]);

    expect(buildBrowseEmptyActionSpecs({
      browseResultCount: 0,
      browseSource: "tour",
      hasMinimumBrowseQuery: true,
      isCurrentTourLoading: false,
      sectionFilter: "",
      selectedTour: "Artists Tour",
      tourLabel: "Route",
    })).toEqual([
      {
        key: "clear-search",
        action: "clear-search",
        label: "Clear search",
        variant: "contained",
      },
      {
        key: "change-tour",
        action: "change-tour",
        label: "Choose another route",
        variant: "text",
      },
    ]);
  });

  test("builds global search result panel presentation with pagination metadata", () => {
    const browseResults = [
      { id: "grave-1" },
      { id: "grave-2" },
      { id: "grave-3" },
    ];

    expect(buildBrowseResultsPanelPresentation({
      batchSize: 2,
      browseResults,
      browseSource: "all",
      isBurialDataLoading: false,
      isCurrentTourLoading: false,
      query: "  Ada  ",
      scopeChips: [{ key: "markers", label: "Markers visible" }],
      sectionFilter: "",
      selectedTour: "",
      visibleCount: 2,
    })).toEqual({
      canShowFewerResults: false,
      displayedResultCount: 3,
      emptyMessage: "",
      hasMoreResults: true,
      hasScopeChips: true,
      isScopedBrowse: false,
      resultSummary: "3 results",
      resultSummaryLabel: "3 results for \"Ada\".",
      resultsEyebrow: "Search",
      resultsTitle: "Search results",
      scopedSectionLabel: "",
      scopedTourLabel: "",
      shouldPageResults: true,
      shouldRenderEmptyState: false,
      trimmedQuery: "Ada",
      visibleResults: [
        { id: "grave-1" },
        { id: "grave-2" },
      ],
    });
  });

  test("keeps scoped browse results unpaged with scoped labels", () => {
    const browseResults = [
      { id: "tour-1" },
      { id: "tour-2" },
    ];

    expect(buildBrowseResultsPanelPresentation({
      batchSize: 1,
      browseResults,
      browseSource: "tour",
      isBurialDataLoading: false,
      isCurrentTourLoading: false,
      query: "",
      sectionFilter: "12",
      selectedTour: "Notables Tour 2020",
      visibleCount: 1,
    })).toMatchObject({
      canShowFewerResults: false,
      displayedResultCount: 2,
      hasMoreResults: false,
      isScopedBrowse: true,
      resultSummaryLabel: "2 results",
      resultsEyebrow: "",
      resultsTitle: "Results",
      scopedSectionLabel: "",
      scopedTourLabel: "Notables Tour 2020",
      shouldPageResults: false,
      visibleResults: browseResults,
    });
  });

  test("builds browse result panel empty-state metadata", () => {
    expect(buildBrowseResultsPanelPresentation({
      batchSize: 10,
      browseResults: [],
      browseSource: "section",
      isBurialDataLoading: false,
      isCurrentTourLoading: false,
      query: "Smith",
      sectionFilter: "8",
      selectedTour: "",
      visibleCount: 10,
    })).toMatchObject({
      displayedResultCount: 0,
      emptyMessage: "No results in Section 8 for \"Smith\".",
      hasMoreResults: false,
      resultSummaryLabel: "0 results",
      resultsEyebrow: "",
      resultsTitle: "Results",
      scopedSectionLabel: "Section 8",
      shouldRenderEmptyState: true,
      visibleResults: [],
    });
  });

  test("uses the configured tour label in browse result panel empty states", () => {
    expect(buildBrowseResultsPanelPresentation({
      browseResults: [],
      browseSource: "tour",
      isBurialDataLoading: false,
      isCurrentTourLoading: false,
      query: "",
      selectedTour: "",
      tourLabel: "Route",
    })).toMatchObject({
      emptyMessage: "Choose a route above.",
      shouldRenderEmptyState: true,
    });
  });

  test("builds a compact life-dates summary when dates exist", () => {
    expect(buildLifeDatesSummary({
      Birth: "1900",
      Death: "1980",
    })).toBe("Born 1900 • Died 1980");
  });
});
