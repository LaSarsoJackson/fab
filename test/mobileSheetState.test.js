import {
  getDefaultMobileSheetState,
  getEffectiveMobileSheetMaxHeight,
  getMobileSheetSnapHeight,
  getMobileSheetStateFromHeight,
  MOBILE_SHEET_STATES,
} from "../src/features/browse/mobileSheetGeometry";

describe("mobile sheet state helpers", () => {
  test("treats selected burials as mobile context so selections stay visible", () => {
    expect(getDefaultMobileSheetState({
      hasBrowseContext: false,
      hasSelectedBurials: true,
      isMobile: true,
    })).toBe(MOBILE_SHEET_STATES.PEEK);
  });

  test("opens the idle mobile visit sheet and keeps desktop state full", () => {
    expect(getDefaultMobileSheetState({
      hasBrowseContext: false,
      hasSelectedBurials: false,
      isMobile: true,
    })).toBe(MOBILE_SHEET_STATES.PEEK);

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
    })).toBeCloseTo(430);
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

  test("keeps selected-place actions visible while content measurement settles", () => {
    expect(getMobileSheetSnapHeight({
      headerHeight: 120,
      maxHeight: 844,
      minimumFullBodyHeight: 280,
      minHeight: 220,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBe(400);
  });

  test("caps the selected-place body floor to the available full height", () => {
    expect(getMobileSheetSnapHeight({
      headerHeight: 120,
      maxHeight: 400,
      minimumFullBodyHeight: 280,
      minHeight: 220,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBeCloseTo(400 * 0.92);
  });

  test("does not treat the collapsed header height as the full content height", () => {
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      minHeight: 104,
      state: MOBILE_SHEET_STATES.PEEK,
    })).toBeCloseTo(430);
    expect(getMobileSheetSnapHeight({
      maxHeight: 1000,
      minHeight: 104,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBeCloseTo(920);
  });

  test("uses a pinned header as the exact collapsed snap height", () => {
    expect(getMobileSheetSnapHeight({
      headerHeight: 128,
      maxHeight: 1000,
      minHeight: 500,
      state: MOBILE_SHEET_STATES.COLLAPSED,
    })).toBe(128);

    expect(getMobileSheetSnapHeight({
      headerHeight: 48,
      maxHeight: 1000,
      minHeight: 500,
      state: MOBILE_SHEET_STATES.COLLAPSED,
    })).toBe(76);
  });

  test("uses the library's complete pinned-header measurement without double counting", () => {
    expect(getMobileSheetSnapHeight({
      headerHeight: 120,
      maxHeight: 1000,
      minHeight: 360,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBe(360);

    expect(getMobileSheetSnapHeight({
      headerHeight: 120,
      maxHeight: 1000,
      minHeight: 900,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBe(900);

    expect(getMobileSheetSnapHeight({
      headerHeight: 120,
      maxHeight: 1000,
      minHeight: 980,
      state: MOBILE_SHEET_STATES.FULL,
    })).toBe(920);
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
    })).toBeCloseTo(348.3);
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

  test("uses the selected-place body floor when bucketing spring-end heights", () => {
    const selectedSheetMetrics = {
      headerHeight: 120,
      minHeight: 220,
      minimumFullBodyHeight: 280,
      windowHeight: 844,
    };

    expect(getMobileSheetStateFromHeight({
      ...selectedSheetMetrics,
      height: 300,
    })).toBe(MOBILE_SHEET_STATES.PEEK);
    expect(getMobileSheetStateFromHeight({
      ...selectedSheetMetrics,
      height: 400,
    })).toBe(MOBILE_SHEET_STATES.FULL);
  });
});
