import { useCallback, useEffect, useRef, useState } from "react";

export const MOBILE_SHEET_STATES = {
  COLLAPSED: "collapsed",
  PEEK: "peek",
  FULL: "full",
};

const SNAP_COLLAPSED_FRACTION = 0.22;
const SNAP_PEEK_FRACTION = 0.50;
const SNAP_FULL_FRACTION = 0.92;

export const getDefaultMobileSheetState = ({
  hasBrowseContext = false,
  hasSelectedBurials = false,
  isMobile,
}) => {
  if (!isMobile) return MOBILE_SHEET_STATES.FULL;
  if (hasBrowseContext || hasSelectedBurials) return MOBILE_SHEET_STATES.PEEK;
  return MOBILE_SHEET_STATES.COLLAPSED;
};

export const getMobileSheetSnapHeight = ({ maxHeight, state }) => {
  if (state === MOBILE_SHEET_STATES.COLLAPSED) {
    return maxHeight * SNAP_COLLAPSED_FRACTION;
  }

  if (state === MOBILE_SHEET_STATES.FULL) {
    return maxHeight * SNAP_FULL_FRACTION;
  }

  return maxHeight * SNAP_PEEK_FRACTION;
};

export const getMobileSheetStateFromHeight = ({ height, windowHeight }) => {
  const collapsedThreshold = windowHeight * (SNAP_COLLAPSED_FRACTION + SNAP_PEEK_FRACTION) / 2;
  const peekThreshold = windowHeight * (SNAP_PEEK_FRACTION + SNAP_FULL_FRACTION) / 2;

  if (height < collapsedThreshold) {
    return MOBILE_SHEET_STATES.COLLAPSED;
  }

  if (height < peekThreshold) {
    return MOBILE_SHEET_STATES.PEEK;
  }

  return MOBILE_SHEET_STATES.FULL;
};

export function useBurialSidebarMobileSheetState({
  hasActiveBrowseContext,
  initialBrowseSource,
  initialQuery,
  isMobile,
  selectedBurialsLength,
}) {
  const initialHasBrowseContext = Boolean(
    (initialQuery || "").trim() || initialBrowseSource !== "all"
  );
  const initialMobileSheetState = getDefaultMobileSheetState({
    hasBrowseContext: initialHasBrowseContext,
    hasSelectedBurials: selectedBurialsLength > 0,
    isMobile,
  });
  const [mobileSheetState, setMobileSheetState] = useState(() => initialMobileSheetState);
  const [isSelectedSummaryExpanded, setIsSelectedSummaryExpanded] = useState(
    () => selectedBurialsLength > 0
  );
  const sheetRef = useRef(null);
  const previousSelectedCountRef = useRef(selectedBurialsLength);
  const previousIsMobileRef = useRef(isMobile);
  const previousHasActiveBrowseContextRef = useRef(hasActiveBrowseContext);
  const currentMobileSheetState = getDefaultMobileSheetState({
    hasBrowseContext: hasActiveBrowseContext,
    hasSelectedBurials: selectedBurialsLength > 0,
    isMobile,
  });
  // When the layout crosses from desktop into mobile, derive a fresh default
  // drawer state from the current context instead of reusing the last
  // desktop-era state snapshot.
  const resolvedMobileSheetState = isMobile && !previousIsMobileRef.current
    ? currentMobileSheetState
    : mobileSheetState;

  const mobileSnapPoints = useCallback(({ maxHeight }) => [
    getMobileSheetSnapHeight({
      maxHeight,
      state: MOBILE_SHEET_STATES.COLLAPSED,
    }),
    getMobileSheetSnapHeight({
      maxHeight,
      state: MOBILE_SHEET_STATES.PEEK,
    }),
    getMobileSheetSnapHeight({
      maxHeight,
      state: MOBILE_SHEET_STATES.FULL,
    }),
  ], []);

  const mobileDefaultSnap = useCallback(({ maxHeight, snapPoints }) => {
    if (resolvedMobileSheetState === MOBILE_SHEET_STATES.COLLAPSED) {
      return snapPoints[0] || getMobileSheetSnapHeight({
        maxHeight,
        state: MOBILE_SHEET_STATES.COLLAPSED,
      });
    }

    if (resolvedMobileSheetState === MOBILE_SHEET_STATES.FULL) {
      return snapPoints[2] || getMobileSheetSnapHeight({
        maxHeight,
        state: MOBILE_SHEET_STATES.FULL,
      });
    }

    return snapPoints[1] || getMobileSheetSnapHeight({
      maxHeight,
      state: MOBILE_SHEET_STATES.PEEK,
    });
  }, [resolvedMobileSheetState]);

  const snapMobileSheet = useCallback((state, maxHeight) => {
    return getMobileSheetSnapHeight({ maxHeight, state });
  }, []);

  const setAndSnapMobileSheet = useCallback((state) => {
    if (!isMobile) return;
    setMobileSheetState(state);
    if (sheetRef.current) {
      sheetRef.current.snapTo(({ maxHeight }) => snapMobileSheet(state, maxHeight));
    }
  }, [isMobile, snapMobileSheet]);

  const maximizeMobileSheet = useCallback(() => {
    setAndSnapMobileSheet(MOBILE_SHEET_STATES.FULL);
  }, [setAndSnapMobileSheet]);

  const expandMobileSheet = useCallback(() => {
    setAndSnapMobileSheet(MOBILE_SHEET_STATES.PEEK);
  }, [setAndSnapMobileSheet]);

  const collapseMobileSheet = useCallback(() => {
    setAndSnapMobileSheet(MOBILE_SHEET_STATES.COLLAPSED);
  }, [setAndSnapMobileSheet]);

  const handleSheetSpringEnd = useCallback((event) => {
    if (event.type !== "SNAP" && event.type !== "OPEN") return;
    if (!sheetRef.current || typeof window === "undefined") return;

    setMobileSheetState(getMobileSheetStateFromHeight({
      height: sheetRef.current.height,
      windowHeight: window.innerHeight,
    }));
  }, []);

  useEffect(() => {
    const wasMobile = previousIsMobileRef.current;
    previousIsMobileRef.current = isMobile;

    if (!isMobile) {
      return;
    }

    if (!wasMobile && mobileSheetState !== currentMobileSheetState) {
      setMobileSheetState(currentMobileSheetState);
    }
  }, [currentMobileSheetState, isMobile, mobileSheetState]);

  useEffect(() => {
    const previousSelectedCount = previousSelectedCountRef.current;
    const previousHasActiveBrowseContext = previousHasActiveBrowseContextRef.current;

    if (!isMobile) {
      previousSelectedCountRef.current = selectedBurialsLength;
      previousHasActiveBrowseContextRef.current = hasActiveBrowseContext;
      return;
    }

    // Mobile drawer behavior follows context changes automatically so search-
    // first flows stay lightweight while explicit selections still expand the
    // working area when the user needs it.
    if (selectedBurialsLength === 0 && previousSelectedCount > 0) {
      setIsSelectedSummaryExpanded(false);
      if (!hasActiveBrowseContext) {
        collapseMobileSheet();
      }
    } else if (
      !previousHasActiveBrowseContext
      && hasActiveBrowseContext
      && resolvedMobileSheetState === MOBILE_SHEET_STATES.COLLAPSED
    ) {
      expandMobileSheet();
    } else if (
      previousHasActiveBrowseContext &&
      !hasActiveBrowseContext &&
      selectedBurialsLength === 0
    ) {
      setIsSelectedSummaryExpanded(false);
      collapseMobileSheet();
    }

    previousSelectedCountRef.current = selectedBurialsLength;
    previousHasActiveBrowseContextRef.current = hasActiveBrowseContext;
  }, [
    collapseMobileSheet,
    expandMobileSheet,
    hasActiveBrowseContext,
    isMobile,
    resolvedMobileSheetState,
    selectedBurialsLength,
  ]);

  const toggleSelectedSummary = useCallback(() => {
    setIsSelectedSummaryExpanded((current) => !current);
  }, []);

  return {
    collapseMobileSheet,
    expandMobileSheet,
    handleSheetSpringEnd,
    isSelectedSummaryExpanded,
    maximizeMobileSheet,
    mobileDefaultSnap,
    mobileSnapPoints,
    resolvedMobileSheetState,
    setIsSelectedSummaryExpanded,
    sheetRef,
    toggleSelectedSummary,
  };
}
