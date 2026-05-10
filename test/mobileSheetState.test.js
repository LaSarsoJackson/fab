import {
  getDefaultMobileSheetState,
  getEffectiveMobileSheetMaxHeight,
  getMobileSheetSnapHeight,
  getMobileSheetStateFromHeight,
  MOBILE_SHEET_STATES,
} from "../src/features/browse/sidebarState";

describe("mobile sheet state helpers", () => {
  test("treats selected burials as mobile context so selections stay visible", () => {
    expect(getDefaultMobileSheetState({
      hasBrowseContext: false,
      hasSelectedBurials: true,
      isMobile: true,
    })).toBe(MOBILE_SHEET_STATES.PEEK);
  });

  test("keeps idle mobile state collapsed and desktop state full", () => {
    expect(getDefaultMobileSheetState({
      hasBrowseContext: false,
      hasSelectedBurials: false,
      isMobile: true,
    })).toBe(MOBILE_SHEET_STATES.COLLAPSED);

    expect(getDefaultMobileSheetState({
      hasBrowseContext: false,
      hasSelectedBurials: false,
      isMobile: false,
    })).toBe(MOBILE_SHEET_STATES.FULL);
  });

  test("reuses the same snap-height math for each sheet state", () => {
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      state: MOBILE_SHEET_STATES.COLLAPSED,
    })).toBeCloseTo(80);
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      state: MOBILE_SHEET_STATES.PEEK,
    })).toBeCloseTo(500);
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBeCloseTo(920);
  });

  test("does not let short mobile content stretch into an empty full-height sheet", () => {
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      minHeight: 340,
      state: MOBILE_SHEET_STATES.PEEK,
    })).toBeCloseTo(340);
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      minHeight: 340,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBeCloseTo(340);
  });

  test("does not treat the collapsed header height as the full content height", () => {
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      minHeight: 104,
      state: MOBILE_SHEET_STATES.PEEK,
    })).toBeCloseTo(500);
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      minHeight: 104,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBeCloseTo(920);
  });

  test("caps snap heights to the visible mobile viewport", () => {
    expect(getEffectiveMobileSheetMaxHeight({
      maxHeight: 875,
      visualViewportHeight: 810,
    })).toBe(810);

    expect(getMobileSheetSnapHeight({
      maxHeight: 875,
      visualViewportHeight: 810,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBeCloseTo(745.2);

    expect(getMobileSheetSnapHeight({
      maxHeight: 875,
      visualViewportHeight: 810,
      state: MOBILE_SHEET_STATES.PEEK,
    })).toBeCloseTo(405);
  });

  test("maps spring-end heights back onto the nearest sheet state", () => {
    expect(getMobileSheetStateFromHeight({
      height: 200,
      windowHeight: 1000,
    })).toBe(MOBILE_SHEET_STATES.COLLAPSED);
    expect(getMobileSheetStateFromHeight({
      height: 500,
      windowHeight: 1000,
    })).toBe(MOBILE_SHEET_STATES.PEEK);
    expect(getMobileSheetStateFromHeight({
      height: 900,
      windowHeight: 1000,
    })).toBe(MOBILE_SHEET_STATES.FULL);
  });
});
