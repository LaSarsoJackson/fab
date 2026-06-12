export const MOBILE_SHEET_STATES = {
  COLLAPSED: "collapsed",
  PEEK: "peek",
  FULL: "full",
};

const SNAP_COLLAPSED_FRACTION = 0.08;
const SNAP_COLLAPSED_MIN_HEIGHT = 76;
const SNAP_CONTENT_MEASUREMENT_MIN_HEIGHT = SNAP_COLLAPSED_MIN_HEIGHT + 56;
const SNAP_PEEK_FRACTION = 0.39;
const SNAP_FULL_FRACTION = 0.92;

export const getEffectiveMobileSheetMaxHeight = ({ maxHeight, visualViewportHeight } = {}) => {
  const normalizedMaxHeight = Number(maxHeight);
  const normalizedVisualViewportHeight = Number(visualViewportHeight);
  const hasMaxHeight = Number.isFinite(normalizedMaxHeight) && normalizedMaxHeight > 0;
  const hasVisualViewportHeight = Number.isFinite(normalizedVisualViewportHeight)
    && normalizedVisualViewportHeight > 0;

  if (!hasVisualViewportHeight) {
    return hasMaxHeight ? normalizedMaxHeight : 0;
  }

  if (!hasMaxHeight) {
    return normalizedVisualViewportHeight;
  }

  return Math.min(normalizedMaxHeight, normalizedVisualViewportHeight);
};

const normalizeHeaderHeight = (headerHeight) => {
  const normalized = Number(headerHeight);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

const getSheetContentCeilingHeight = ({ headerHeight, maxHeight, minHeight }) => {
  const fullHeight = maxHeight * SNAP_FULL_FRACTION;
  const pinnedHeaderHeight = normalizeHeaderHeight(headerHeight);
  // With a pinned header, `minHeight` measures the scrollable body alone, so
  // the total content height is header + body. Legacy callers measure both
  // together and need the bogus-measurement floor to ignore pre-mount values.
  const measuredContentHeight = pinnedHeaderHeight !== null
    ? (Number.isFinite(minHeight) && minHeight > 0
      ? pinnedHeaderHeight + minHeight
      : fullHeight)
    : (Number.isFinite(minHeight) && minHeight > SNAP_CONTENT_MEASUREMENT_MIN_HEIGHT
      ? minHeight
      : fullHeight);

  return Math.min(
    fullHeight,
    Math.max(measuredContentHeight, SNAP_COLLAPSED_MIN_HEIGHT)
  );
};

// Fractions are intentionally relative to the available sheet max height; that
// keeps the drawer usable across Safari's changing toolbar sizes and standalone
// PWA mode.
export const getDefaultMobileSheetState = ({
  isMobile,
} = {}) => {
  if (!isMobile) return MOBILE_SHEET_STATES.FULL;
  // Mobile opens as a compact map companion. Collapsed remains available as a
  // deliberate map-only state, while full height is user-initiated.
  return MOBILE_SHEET_STATES.PEEK;
};

export const getMobileSheetSnapHeight = ({
  headerHeight,
  maxHeight,
  minHeight,
  state,
  visualViewportHeight,
}) => {
  const effectiveMaxHeight = getEffectiveMobileSheetMaxHeight({ maxHeight, visualViewportHeight });
  const pinnedHeaderHeight = normalizeHeaderHeight(headerHeight);
  const contentCeilingHeight = getSheetContentCeilingHeight({
    headerHeight: pinnedHeaderHeight,
    maxHeight: effectiveMaxHeight,
    minHeight,
  });

  if (state === MOBILE_SHEET_STATES.COLLAPSED) {
    // A pinned header defines the collapsed height exactly so the brand line
    // and search field are always fully visible, never clipped mid-text.
    if (pinnedHeaderHeight !== null) {
      return Math.min(
        effectiveMaxHeight,
        Math.max(pinnedHeaderHeight, SNAP_COLLAPSED_MIN_HEIGHT)
      );
    }

    return Math.min(
      contentCeilingHeight,
      Math.max(effectiveMaxHeight * SNAP_COLLAPSED_FRACTION, SNAP_COLLAPSED_MIN_HEIGHT)
    );
  }

  if (state === MOBILE_SHEET_STATES.FULL) {
    return contentCeilingHeight;
  }

  return Math.min(effectiveMaxHeight * SNAP_PEEK_FRACTION, contentCeilingHeight);
};

export const getMobileSheetStateFromHeight = ({
  headerHeight,
  height,
  minHeight,
  windowHeight,
  visualViewportHeight,
}) => {
  const collapsedHeight = getMobileSheetSnapHeight({
    headerHeight,
    maxHeight: windowHeight,
    minHeight,
    state: MOBILE_SHEET_STATES.COLLAPSED,
    visualViewportHeight,
  });
  const peekHeight = getMobileSheetSnapHeight({
    headerHeight,
    maxHeight: windowHeight,
    minHeight,
    state: MOBILE_SHEET_STATES.PEEK,
    visualViewportHeight,
  });
  const fullHeight = getMobileSheetSnapHeight({
    headerHeight,
    maxHeight: windowHeight,
    minHeight,
    state: MOBILE_SHEET_STATES.FULL,
    visualViewportHeight,
  });
  const collapsedThreshold = (collapsedHeight + peekHeight) / 2;
  const peekThreshold = (peekHeight + fullHeight) / 2;

  if (height < collapsedThreshold) {
    return MOBILE_SHEET_STATES.COLLAPSED;
  }

  if (height < peekThreshold) {
    return MOBILE_SHEET_STATES.PEEK;
  }

  return MOBILE_SHEET_STATES.FULL;
};
