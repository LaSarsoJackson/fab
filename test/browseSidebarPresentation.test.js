import { describe, expect, test } from "bun:test";

import {
  buildBrowseEmptyActionSpecs,
  buildBrowseScopeChips,
  buildLifeDatesSummary,
  buildSearchShellNotices,
  formatLocationNoticeLabel,
  getBrowseEmptyState,
  getLocationNoticeTone,
  getSearchPlaceholder,
  getSearchShellNoticeStyles,
} from "../src/features/browse";

describe("browse sidebar presentation helpers", () => {
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
    })).toBe("Type at least 2 characters to search.");
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
        label: "Offline. Search stays available, but live links may be limited.",
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
      expect.objectContaining({ key: "scope", label: "Section 12" }),
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
    })).toEqual([
      expect.objectContaining({ key: "scope", label: "Notables Tour 2020" }),
    ]);
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

  test("builds a compact life-dates summary when dates exist", () => {
    expect(buildLifeDatesSummary({
      Birth: "1900",
      Death: "1980",
    })).toBe("Born 1900 • Died 1980");
  });
});
