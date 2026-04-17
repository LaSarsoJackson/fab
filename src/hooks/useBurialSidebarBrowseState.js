import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBrowseResults,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "../features/browse";
import { cancelIdleTask, scheduleIdleTask } from "../shared/runtime";

export const DEFAULT_RESULT_LIMIT = 10;
const ASYNC_BROWSE_RECORD_THRESHOLD = 5000;
const BROWSE_RESULTS_CACHE_LIMIT = 24;

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

  if (cache.size <= BROWSE_RESULTS_CACHE_LIMIT) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  if (oldestKey) {
    cache.delete(oldestKey);
  }
};

export function useBurialSidebarBrowseState({
  initialBrowseSource,
  initialQuery,
  burialRecords,
  sectionIndex,
  searchIndex,
  getTourName,
  sectionFilter,
  lotTierFilter,
  filterType,
  selectedTour,
  tourResults,
}) {
  const [requestedBrowseSource, setRequestedBrowseSource] = useState(initialBrowseSource);
  const [browseQuery, setBrowseQuery] = useState(initialQuery || "");
  const [resultLimit, setResultLimit] = useState(DEFAULT_RESULT_LIMIT);
  const [hasExplicitBrowseSourcePreference, setHasExplicitBrowseSourcePreference] = useState(false);
  const previousInitialBrowseSourceRef = useRef(initialBrowseSource);
  const browseResultsCacheRef = useRef(new Map());
  const [deferredBrowseResults, setDeferredBrowseResults] = useState([]);
  const [isBrowsePending, setIsBrowsePending] = useState(false);
  const hasPinnedBrowseContext = Boolean(
    browseQuery.trim() || lotTierFilter || sectionFilter || selectedTour
  );
  // Deep links and restored app state may update the initial browse source
  // after mount. Respect that until the user explicitly picks a different
  // browse mode or creates a pinned browse context of their own.
  const shouldPreferInitialBrowseSource = (
    !hasExplicitBrowseSourcePreference
    && !hasPinnedBrowseContext
    && requestedBrowseSource === previousInitialBrowseSourceRef.current
    && initialBrowseSource !== previousInitialBrowseSourceRef.current
  );
  const effectiveRequestedBrowseSource = shouldPreferInitialBrowseSource
    ? initialBrowseSource
    : requestedBrowseSource;

  useEffect(() => {
    setBrowseQuery(initialQuery || "");
  }, [initialQuery]);

  useEffect(() => {
    const previousInitialBrowseSource = previousInitialBrowseSourceRef.current;
    previousInitialBrowseSourceRef.current = initialBrowseSource;

    if (previousInitialBrowseSource === initialBrowseSource) {
      return;
    }

    if (!shouldPreferInitialBrowseSource) {
      return;
    }

    setRequestedBrowseSource(initialBrowseSource);
  }, [
    initialBrowseSource,
    shouldPreferInitialBrowseSource,
  ]);

  const setBrowseSource = useCallback((nextBrowseSource) => {
    setHasExplicitBrowseSourcePreference(true);
    setRequestedBrowseSource(nextBrowseSource);
  }, []);

  const browseSource = useMemo(
    () => getBrowseSourceMode({
      browseSource: effectiveRequestedBrowseSource,
      sectionFilter,
      selectedTour,
    }),
    [effectiveRequestedBrowseSource, sectionFilter, selectedTour]
  );

  const shouldDeferBrowseResults = (
    browseSource === "all" &&
    browseQuery.trim().length >= MIN_BROWSE_QUERY_LENGTH &&
    burialRecords.length >= ASYNC_BROWSE_RECORD_THRESHOLD
  );
  const browseCacheKey = useMemo(
    () => buildBrowseCacheKey({
      browseSource,
      browseQuery,
      filterType,
      lotTierFilter,
      sectionFilter,
      selectedTour,
    }),
    [
      browseQuery,
      browseSource,
      filterType,
      lotTierFilter,
      sectionFilter,
      selectedTour,
    ]
  );
  const immediateBrowseResults = useMemo(
    () => {
      if (shouldDeferBrowseResults) {
        return deferredBrowseResults;
      }

      return buildBrowseResults({
        browseSource,
        query: browseQuery,
        burialRecords,
        sectionIndex,
        searchIndex,
        getTourName,
        sectionFilter,
        lotTierFilter,
        filterType,
        selectedTour,
        tourResults,
      }).results;
    },
    [
      browseSource,
      browseQuery,
      burialRecords,
      deferredBrowseResults,
      filterType,
      getTourName,
      lotTierFilter,
      searchIndex,
      sectionIndex,
      sectionFilter,
      selectedTour,
      shouldDeferBrowseResults,
      tourResults,
    ]
  );

  useEffect(() => {
    browseResultsCacheRef.current.clear();
  }, [
    burialRecords,
    getTourName,
    searchIndex,
    sectionIndex,
    selectedTour,
    tourResults.length,
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

    const handle = scheduleIdleTask(() => {
      if (cancelled) {
        return;
      }

      const nextResults = buildBrowseResults({
        browseSource,
        query: browseQuery,
        burialRecords,
        sectionIndex,
        searchIndex,
        getTourName,
        sectionFilter,
        lotTierFilter,
        filterType,
        selectedTour,
        tourResults,
      }).results;

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
  }, [
    browseCacheKey,
    browseQuery,
    browseSource,
    burialRecords,
    filterType,
    getTourName,
    lotTierFilter,
    searchIndex,
    sectionIndex,
    sectionFilter,
    selectedTour,
    shouldDeferBrowseResults,
    tourResults,
  ]);

  const browseResults = immediateBrowseResults;

  const hasActiveBrowseContext = useMemo(
    () => Boolean(browseQuery.trim() || lotTierFilter || sectionFilter || selectedTour || browseSource !== "all"),
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
