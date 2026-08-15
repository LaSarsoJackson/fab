import { describe, expect, test } from "bun:test";

import { buildSidebarBrowseFlags } from "../src/features/browse/sidebarState";

describe("sidebar browse flags", () => {
  test("derives active search, section, tour, and loading state", () => {
    expect(buildSidebarBrowseFlags({
      browseQuery: "  ada  ",
      browseSource: "section",
      hasTourBrowse: true,
      loadingTourName: "Women of ARC",
      lotTierFilter: "Lot 4",
      sectionFilter: "12",
      selectedBurialsLength: 2,
      selectedTour: "Women of ARC",
      tourResultCount: 0,
    })).toEqual({
      hasGlobalResetState: true,
      hasMinimumBrowseQuery: true,
      hasSectionFilters: true,
      hasTourSelection: true,
      isCurrentTourLoading: true,
      isSectionBrowseVisible: true,
      isTourBrowseVisible: false,
    });
  });

  test("keeps unavailable tour browse hidden and defaults idle state", () => {
    expect(buildSidebarBrowseFlags({
      browseQuery: "a",
      browseSource: "tour",
      hasTourBrowse: false,
      selectedTour: "Women of ARC",
      tourResultCount: 3,
    })).toMatchObject({
      hasGlobalResetState: true,
      hasMinimumBrowseQuery: false,
      hasTourSelection: true,
      isCurrentTourLoading: false,
      isTourBrowseVisible: false,
    });

    expect(buildSidebarBrowseFlags()).toEqual({
      hasGlobalResetState: false,
      hasMinimumBrowseQuery: false,
      hasSectionFilters: false,
      hasTourSelection: false,
      isCurrentTourLoading: false,
      isSectionBrowseVisible: false,
      isTourBrowseVisible: false,
    });
  });
});
