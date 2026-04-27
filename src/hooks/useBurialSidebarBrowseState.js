import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBrowseResults,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "../features/browse/browseResults";
import { cancelIdleTask, scheduleIdleTask } from "../shared/runtime/runtimeEnv";

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
  // Deep links and restored app state may update the initial browse source
  // after mount. Respect that until the user explicitly picks a different
  // browse mode or creates a pinned browse context of their own.
  const shouldPreferInitialBrowseSource = (
    !hasExplicitBrowseSourcePreference
    && !hasPinnedContext
    && requestedBrowseSource === previousInitialBrowseSourceRef.current
    && initialBrowseSource !== previousInitialBrowseSourceRef.current
  );
  const effectiveRequestedBrowseSource = shouldPreferInitialBrowseSource
    ? initialBrowseSource
    : requestedBrowseSource;

  useEffect(() => {
    const previousInitialBrowseSource = previousInitialBrowseSourceRef.current;
    previousInitialBrowseSourceRef.current = initialBrowseSource;

    if (previousInitialBrowseSource === initialBrowseSource || !shouldPreferInitialBrowseSource) {
      return;
    }

    setRequestedBrowseSource(initialBrowseSource);
  }, [initialBrowseSource, shouldPreferInitialBrowseSource]);

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
