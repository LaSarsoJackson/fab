import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBrowseResults,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "./browseResults";
import { cancelIdleTask, scheduleIdleTask } from "../../shared/runtimeEnv";

/**
 * Owns the sidebar's derived browse state: current browse source, query,
 * incremental result limits, idle-result computation, and the small LRU cache
 * that keeps repeated section/tour searches responsive.
 */
export const DEFAULT_RESULT_LIMIT = 10;
const ASYNC_BROWSE_RECORD_THRESHOLD = 5000;
const BROWSE_RESULTS_CACHE_LIMIT = 24;

const hasPinnedBrowseContext = ({
  browseQuery = "",
  lotTierFilter = "",
  sectionFilter = "",
  selectedTour = "",
}) => Boolean(
  browseQuery.trim() || lotTierFilter || sectionFilter || selectedTour
);

const buildBrowseCacheKey = ({
  browseSource,
  browseQuery,
  filterType,
  lotTierFilter,
  sectionFilter,
  selectedTour,
}) => (
  [
    browseSource,
    String(browseQuery || "").trim().toLowerCase(),
    sectionFilter,
    lotTierFilter,
    filterType,
    selectedTour,
  ].join("::")
);

const cacheBrowseResults = (cache, key, results) => {
  if (!key) {
    return;
  }

  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, results);

  // Keep the cache small and LRU-like. Large cemetery search results are cheap
  // to recompute during idle time, but unbounded arrays add memory pressure on
  // mobile Safari.
  if (cache.size <= BROWSE_RESULTS_CACHE_LIMIT) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  if (oldestKey) {
    cache.delete(oldestKey);
  }
};

function usePreferredBrowseSource({
  initialBrowseSource,
  browseQuery,
  lotTierFilter,
  sectionFilter,
  selectedTour,
}) {
  const [requestedBrowseSource, setRequestedBrowseSource] = useState(initialBrowseSource);
  const [hasExplicitBrowseSourcePreference, setHasExplicitBrowseSourcePreference] = useState(false);
  const previousInitialBrowseSourceRef = useRef(initialBrowseSource);
  const hasPinnedContext = hasPinnedBrowseContext({
    browseQuery,
    lotTierFilter,
    sectionFilter,
    selectedTour,
  });
  const hasExternalBrowseContext = initialBrowseSource === "section" || initialBrowseSource === "tour";
  const didInitialBrowseSourceChange = initialBrowseSource !== previousInitialBrowseSourceRef.current;
  // Parent context wins until the user explicitly chooses a different browse
  // source. That keeps deep links and map-driven section/tour clicks coherent.
  const shouldUseExternalBrowseSource = (
    hasExternalBrowseContext &&
    (!hasExplicitBrowseSourcePreference || didInitialBrowseSourceChange)
  );
  // Deep links, restored app state, and map-driven section clicks can update
  // the parent-owned browse context after the sidebar has already mounted.
  const shouldPreferInitialBrowseSource = (
    !hasExplicitBrowseSourcePreference
    && !hasPinnedContext
    && requestedBrowseSource === previousInitialBrowseSourceRef.current
    && didInitialBrowseSourceChange
  );
  const effectiveRequestedBrowseSource = shouldUseExternalBrowseSource || shouldPreferInitialBrowseSource
    ? initialBrowseSource
    : requestedBrowseSource;

  useEffect(() => {
    const previousInitialBrowseSource = previousInitialBrowseSourceRef.current;
    previousInitialBrowseSourceRef.current = initialBrowseSource;

    if (shouldUseExternalBrowseSource) {
      if (requestedBrowseSource !== initialBrowseSource) {
        setRequestedBrowseSource(initialBrowseSource);
      }
      return;
    }

    if (previousInitialBrowseSource === initialBrowseSource || !shouldPreferInitialBrowseSource) {
      return;
    }

    setRequestedBrowseSource(initialBrowseSource);
  }, [
    initialBrowseSource,
    requestedBrowseSource,
    shouldUseExternalBrowseSource,
    shouldPreferInitialBrowseSource,
  ]);

  const setBrowseSource = useCallback((nextBrowseSource) => {
    setHasExplicitBrowseSourcePreference(true);
    setRequestedBrowseSource(nextBrowseSource);
  }, []);

  return {
    effectiveRequestedBrowseSource,
    setBrowseSource,
  };
}

function useDeferredBrowseResults({
  browseCacheKey,
  burialRecords,
  sectionRecordsOverride,
  computeBrowseResults,
  getTourName,
  searchIndex,
  sectionIndex,
  selectedTour,
  shouldDeferBrowseResults,
  tourResultsLength,
}) {
  const browseResultsCacheRef = useRef(new Map());
  const [deferredBrowseResults, setDeferredBrowseResults] = useState([]);
  const [isBrowsePending, setIsBrowsePending] = useState(false);

  // Input collections are large and can be replaced wholesale after data
  // reloads, so cache invalidation follows object identity instead of trying
  // to diff the underlying record arrays.
  useEffect(() => {
    browseResultsCacheRef.current.clear();
  }, [
    burialRecords,
    getTourName,
    searchIndex,
    sectionRecordsOverride,
    sectionIndex,
    selectedTour,
    tourResultsLength,
  ]);

  useEffect(() => {
    if (!shouldDeferBrowseResults) {
      setIsBrowsePending(false);
      return undefined;
    }

    const cachedResults = browseResultsCacheRef.current.get(browseCacheKey);
    if (cachedResults) {
      setDeferredBrowseResults(cachedResults);
      setIsBrowsePending(false);
      return undefined;
    }

    let cancelled = false;
    setIsBrowsePending(true);

    // Full-cemetery searches can touch tens of thousands of records. Running
    // them during idle time avoids blocking typing, drawer animation, and map
    // interaction while still returning cached results immediately on repeats.
    const handle = scheduleIdleTask(() => {
      if (cancelled) {
        return;
      }

      const nextResults = computeBrowseResults();
      if (cancelled) {
        return;
      }

      cacheBrowseResults(browseResultsCacheRef.current, browseCacheKey, nextResults);
      setDeferredBrowseResults(nextResults);
      setIsBrowsePending(false);
    }, {
      timeout: 250,
      fallbackDelay: 24,
    });

    return () => {
      cancelled = true;
      cancelIdleTask(handle);
    };
  }, [browseCacheKey, computeBrowseResults, shouldDeferBrowseResults]);

  const browseResults = useMemo(
    () => (shouldDeferBrowseResults ? deferredBrowseResults : computeBrowseResults()),
    [computeBrowseResults, deferredBrowseResults, shouldDeferBrowseResults]
  );

  return {
    browseResults,
    isBrowsePending,
  };
}

export function useBurialSidebarBrowseState({
  initialBrowseSource,
  initialQuery,
  burialRecords,
  sectionRecordsOverride,
  sectionIndex,
  searchIndex,
  getTourName,
  sectionFilter,
  lotTierFilter,
  filterType,
  selectedTour,
  tourResults,
}) {
  const [browseQuery, setBrowseQuery] = useState(initialQuery || "");
  const [resultLimit, setResultLimit] = useState(DEFAULT_RESULT_LIMIT);
  const trimmedBrowseQuery = browseQuery.trim();

  useEffect(() => setBrowseQuery(initialQuery || ""), [initialQuery]);

  const { effectiveRequestedBrowseSource, setBrowseSource } = usePreferredBrowseSource({
    initialBrowseSource, browseQuery, lotTierFilter, sectionFilter, selectedTour,
  });

  const browseSource = useMemo(
    () => getBrowseSourceMode({ browseSource: effectiveRequestedBrowseSource, sectionFilter, selectedTour }),
    [effectiveRequestedBrowseSource, sectionFilter, selectedTour]
  );

  const shouldDeferBrowseResults = browseSource === "all"
    && trimmedBrowseQuery.length >= MIN_BROWSE_QUERY_LENGTH
    && burialRecords.length >= ASYNC_BROWSE_RECORD_THRESHOLD;
  // Section and tour result sets are small enough to compute synchronously.
  // Full-cemetery queries defer once the burial dataset crosses the threshold.
  const browseCacheKey = useMemo(
    () => buildBrowseCacheKey({
      browseSource,
      browseQuery: trimmedBrowseQuery,
      filterType,
      lotTierFilter,
      sectionFilter,
      selectedTour,
    }),
    [
      browseSource,
      filterType,
      lotTierFilter,
      sectionFilter,
      selectedTour,
      trimmedBrowseQuery,
    ]
  );
  const computeBrowseResults = useCallback(
    () => buildBrowseResults({
      browseSource,
      query: browseQuery,
      burialRecords,
      sectionRecordsOverride,
      sectionIndex,
      searchIndex,
      getTourName,
      sectionFilter,
      lotTierFilter,
      filterType,
      selectedTour,
      tourResults,
    }).results,
    [
      browseQuery,
      browseSource,
      burialRecords,
      filterType,
      getTourName,
      lotTierFilter,
      searchIndex,
      sectionRecordsOverride,
      sectionIndex,
      sectionFilter,
      selectedTour,
      tourResults,
    ]
  );
  const { browseResults, isBrowsePending } = useDeferredBrowseResults({
    browseCacheKey,
    burialRecords,
    computeBrowseResults,
    getTourName,
    searchIndex,
    sectionRecordsOverride,
    sectionIndex,
    selectedTour,
    shouldDeferBrowseResults,
    tourResultsLength: tourResults.length,
  });

  const hasActiveBrowseContext = useMemo(
    () => hasPinnedBrowseContext({ browseQuery, lotTierFilter, sectionFilter, selectedTour }) || browseSource !== "all",
    [browseQuery, browseSource, lotTierFilter, sectionFilter, selectedTour]
  );

  return {
    browseQuery,
    browseResults,
    browseSource,
    hasActiveBrowseContext,
    isBrowsePending,
    resultLimit,
    setBrowseQuery,
    setBrowseSource,
    setResultLimit,
  };
}

/**
 * Centralizes the mobile bottom-sheet state machine so the sidebar component
 * only decides when context changes, not how snap points and drawer expansion
 * should translate into pixel heights.
 */
export const MOBILE_SHEET_STATES = {
  COLLAPSED: "collapsed",
  PEEK: "peek",
  FULL: "full",
};

const SNAP_COLLAPSED_FRACTION = 0.08;
const SNAP_COLLAPSED_MIN_HEIGHT = 76;
const SNAP_CONTENT_MEASUREMENT_MIN_HEIGHT = SNAP_COLLAPSED_MIN_HEIGHT + 56;
const SNAP_PEEK_FRACTION = 0.50;
const SNAP_FULL_FRACTION = 0.92;

const getSheetContentCeilingHeight = ({ maxHeight, minHeight }) => {
  const fullHeight = maxHeight * SNAP_FULL_FRACTION;
  const measuredContentHeight = Number.isFinite(minHeight) && minHeight > SNAP_CONTENT_MEASUREMENT_MIN_HEIGHT
    ? minHeight
    : fullHeight;

  return Math.min(
    fullHeight,
    Math.max(measuredContentHeight, SNAP_COLLAPSED_MIN_HEIGHT)
  );
};

// Fractions are intentionally relative to the available sheet max height; that
// keeps the drawer usable across Safari's changing toolbar sizes and standalone
// PWA mode.
export const getDefaultMobileSheetState = ({
  hasBrowseContext = false,
  hasSelectedBurials = false,
  isMobile,
}) => {
  if (!isMobile) return MOBILE_SHEET_STATES.FULL;
  if (hasBrowseContext || hasSelectedBurials) return MOBILE_SHEET_STATES.PEEK;
  return MOBILE_SHEET_STATES.COLLAPSED;
};

export const getMobileSheetSnapHeight = ({ maxHeight, minHeight, state }) => {
  const contentCeilingHeight = getSheetContentCeilingHeight({ maxHeight, minHeight });

  if (state === MOBILE_SHEET_STATES.COLLAPSED) {
    return Math.min(
      contentCeilingHeight,
      Math.max(maxHeight * SNAP_COLLAPSED_FRACTION, SNAP_COLLAPSED_MIN_HEIGHT)
    );
  }

  if (state === MOBILE_SHEET_STATES.FULL) {
    return contentCeilingHeight;
  }

  return Math.min(maxHeight * SNAP_PEEK_FRACTION, contentCeilingHeight);
};

export const getMobileSheetStateFromHeight = ({ height, windowHeight }) => {
  const collapsedHeight = getMobileSheetSnapHeight({
    maxHeight: windowHeight,
    state: MOBILE_SHEET_STATES.COLLAPSED,
  });
  const peekHeight = getMobileSheetSnapHeight({
    maxHeight: windowHeight,
    state: MOBILE_SHEET_STATES.PEEK,
  });
  const fullHeight = getMobileSheetSnapHeight({
    maxHeight: windowHeight,
    state: MOBILE_SHEET_STATES.FULL,
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
    () => selectedBurialsLength > 1
  );
  const sheetRef = useRef(null);
  const requestedMobileSheetStateRef = useRef(null);
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

  const mobileSnapPoints = useCallback(({ maxHeight, minHeight }) => {
    // Deduplicate because constrained viewports can collapse peek/full heights
    // into the same physical snap point.
    const snapPoints = [
      getMobileSheetSnapHeight({
        maxHeight,
        minHeight,
        state: MOBILE_SHEET_STATES.COLLAPSED,
      }),
      getMobileSheetSnapHeight({
        maxHeight,
        minHeight,
        state: MOBILE_SHEET_STATES.PEEK,
      }),
      getMobileSheetSnapHeight({
        maxHeight,
        minHeight,
        state: MOBILE_SHEET_STATES.FULL,
      }),
    ];

    return Array.from(new Set(snapPoints)).sort((a, b) => a - b);
  }, []);

  const mobileDefaultSnap = useCallback(({ maxHeight, minHeight, snapPoints }) => {
    if (resolvedMobileSheetState === MOBILE_SHEET_STATES.COLLAPSED) {
      return snapPoints[0] || getMobileSheetSnapHeight({
        maxHeight,
        minHeight,
        state: MOBILE_SHEET_STATES.COLLAPSED,
      });
    }

    if (resolvedMobileSheetState === MOBILE_SHEET_STATES.FULL) {
      return snapPoints[snapPoints.length - 1] || getMobileSheetSnapHeight({
        maxHeight,
        minHeight,
        state: MOBILE_SHEET_STATES.FULL,
      });
    }

    return snapPoints[Math.min(1, snapPoints.length - 1)] || getMobileSheetSnapHeight({
      maxHeight,
      minHeight,
      state: MOBILE_SHEET_STATES.PEEK,
    });
  }, [resolvedMobileSheetState]);

  const snapMobileSheet = useCallback((state, maxHeight, minHeight) => {
    return getMobileSheetSnapHeight({ maxHeight, minHeight, state });
  }, []);

  const setAndSnapMobileSheet = useCallback((state) => {
    if (!isMobile) return;
    if (requestedMobileSheetStateRef.current === state) return;

    requestedMobileSheetStateRef.current = state;
    setMobileSheetState(state);
    if (sheetRef.current) {
      sheetRef.current.snapTo(({ maxHeight, minHeight }) => snapMobileSheet(state, maxHeight, minHeight));
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

    const nextState = getMobileSheetStateFromHeight({
      height: sheetRef.current.height,
      windowHeight: window.innerHeight,
    });
    requestedMobileSheetStateRef.current = nextState;
    setMobileSheetState(nextState);
  }, []);

  useEffect(() => {
    const wasMobile = previousIsMobileRef.current;
    previousIsMobileRef.current = isMobile;

    if (!isMobile) {
      return;
    }

    if (!wasMobile && mobileSheetState !== currentMobileSheetState) {
      requestedMobileSheetStateRef.current = currentMobileSheetState;
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
    } else if (selectedBurialsLength > previousSelectedCount && selectedBurialsLength > 1) {
      setIsSelectedSummaryExpanded(true);
      if (resolvedMobileSheetState === MOBILE_SHEET_STATES.COLLAPSED) {
        expandMobileSheet();
      }
    } else if (
      !previousHasActiveBrowseContext
      && hasActiveBrowseContext
      && initialBrowseSource !== "all"
      && resolvedMobileSheetState === MOBILE_SHEET_STATES.COLLAPSED
    ) {
      expandMobileSheet();
    } else if (
      previousHasActiveBrowseContext &&
      !hasActiveBrowseContext &&
      selectedBurialsLength === 0 &&
      resolvedMobileSheetState !== MOBILE_SHEET_STATES.COLLAPSED
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
    initialBrowseSource,
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
