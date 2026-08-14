import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildBrowseResults,
  getBrowseSourceMode,
  MIN_BROWSE_QUERY_LENGTH,
} from "./browseResults";
import { cancelIdleTask, scheduleIdleTask } from "../../shared/runtimeEnv";

/**
 * Owns the sidebar's derived browse state: current browse source, query,
 * incremental result limits, worker-backed full-cemetery search, and the small
 * LRU cache that keeps repeated section/tour searches responsive.
 */
export const DEFAULT_RESULT_LIMIT = 10;
const ASYNC_BROWSE_RECORD_THRESHOLD = 5000;
const BROWSE_RESULTS_CACHE_LIMIT = 24;
let browseSearchWorkerFactoryPromise = null;

export const buildSidebarBrowseFlags = ({
  browseQuery = "",
  browseSource = "all",
  hasTourBrowse = true,
  loadingTourName = "",
  lotTierFilter = "",
  minimumBrowseQueryLength = MIN_BROWSE_QUERY_LENGTH,
  sectionFilter = "",
  selectedBurialsLength = 0,
  selectedTour = "",
  tourResultCount = 0,
} = {}) => {
  const trimmedBrowseQuery = String(browseQuery || "").trim();
  const hasSectionFilters = Boolean(sectionFilter || lotTierFilter);
  const hasTourSelection = Boolean(selectedTour);

  return {
    hasGlobalResetState: Boolean(
      trimmedBrowseQuery ||
      sectionFilter ||
      lotTierFilter ||
      selectedTour ||
      Number(selectedBurialsLength) > 0
    ),
    hasMinimumBrowseQuery: trimmedBrowseQuery.length >= minimumBrowseQueryLength,
    hasSectionFilters,
    hasTourSelection,
    isCurrentTourLoading: Boolean(
      selectedTour && loadingTourName === selectedTour && Number(tourResultCount) === 0
    ),
    isSectionBrowseVisible: browseSource === "section",
    isTourBrowseVisible: browseSource === "tour" && Boolean(hasTourBrowse),
  };
};

const canUseBrowseSearchWorker = () => (
  typeof window !== "undefined" &&
  typeof window.Worker === "function"
);

const loadBrowseSearchWorkerFactory = () => {
  if (!canUseBrowseSearchWorker()) {
    return Promise.resolve(null);
  }

  if (!browseSearchWorkerFactoryPromise) {
    browseSearchWorkerFactoryPromise = import("./browseSearchWorkerClient")
      .then((module) => module.createBrowseSearchWorker)
      .catch((error) => {
        console.warn("Browse search worker unavailable; falling back to idle search.", error);
        return null;
      });
  }

  return browseSearchWorkerFactoryPromise;
};

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
  browseQuery,
  burialRecords,
  burialRecordsById,
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
  const computeBrowseResultsRef = useRef(computeBrowseResults);
  const recordsByIdRef = useRef(new Map());
  const workerRef = useRef(null);
  const workerRecordVersionRef = useRef(0);
  const workerReadyVersionRef = useRef(0);
  const latestWorkerRequestIdRef = useRef(0);
  const pendingWorkerQueryRef = useRef(null);
  const workerUnavailableRef = useRef(false);
  const [deferredBrowseResults, setDeferredBrowseResults] = useState([]);
  const [isBrowsePending, setIsBrowsePending] = useState(false);

  useEffect(() => {
    computeBrowseResultsRef.current = computeBrowseResults;
  }, [computeBrowseResults]);

  useEffect(() => {
    recordsByIdRef.current = burialRecordsById || new Map(
      burialRecords.map((record) => [record.id, record])
    );
  }, [burialRecords, burialRecordsById]);

  const clearBrowseSearchWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    workerReadyVersionRef.current = 0;
    pendingWorkerQueryRef.current = null;
  }, []);

  const finishPendingWorkerQueryOnMainThread = useCallback((pendingQuery) => {
    if (
      !pendingQuery ||
      pendingQuery.requestId !== latestWorkerRequestIdRef.current ||
      pendingQuery.recordVersion !== workerRecordVersionRef.current
    ) {
      return;
    }

    const nextResults = computeBrowseResultsRef.current();
    cacheBrowseResults(browseResultsCacheRef.current, pendingQuery.browseCacheKey, nextResults);
    setDeferredBrowseResults(nextResults);
    setIsBrowsePending(false);
    pendingWorkerQueryRef.current = null;
  }, []);

  const postPendingWorkerQuery = useCallback(() => {
    const worker = workerRef.current;
    const pendingQuery = pendingWorkerQueryRef.current;

    if (
      !worker ||
      !pendingQuery ||
      workerReadyVersionRef.current !== pendingQuery.recordVersion
    ) {
      return;
    }

    worker.postMessage({
      type: "query",
      requestId: pendingQuery.requestId,
      recordVersion: pendingQuery.recordVersion,
      query: pendingQuery.query,
    });
  }, []);

  const handleWorkerMessage = useCallback((event) => {
    const message = event?.data || {};

    if (message.recordVersion !== workerRecordVersionRef.current) {
      return;
    }

    if (message.type === "ready") {
      workerReadyVersionRef.current = message.recordVersion;
      postPendingWorkerQuery();
      return;
    }

    if (message.type === "results") {
      const pendingQuery = pendingWorkerQueryRef.current;
      if (
        !pendingQuery ||
        message.requestId !== pendingQuery.requestId ||
        message.requestId !== latestWorkerRequestIdRef.current
      ) {
        return;
      }

      const recordsById = recordsByIdRef.current;
      const nextResults = (message.resultIds || [])
        .map((id) => recordsById.get(id))
        .filter(Boolean);

      cacheBrowseResults(browseResultsCacheRef.current, pendingQuery.browseCacheKey, nextResults);
      setDeferredBrowseResults(nextResults);
      setIsBrowsePending(false);
      pendingWorkerQueryRef.current = null;
      return;
    }

    if (message.type === "error" || message.type === "stale") {
      workerUnavailableRef.current = true;
      finishPendingWorkerQueryOnMainThread(pendingWorkerQueryRef.current);
    }
  }, [finishPendingWorkerQueryOnMainThread, postPendingWorkerQuery]);

  const hydrateBrowseSearchWorker = useCallback((recordVersion) => {
    if (!canUseBrowseSearchWorker()) {
      workerUnavailableRef.current = true;
      return undefined;
    }

    let cancelled = false;
    workerUnavailableRef.current = false;

    loadBrowseSearchWorkerFactory().then((createWorker) => {
      if (cancelled || recordVersion !== workerRecordVersionRef.current) {
        return;
      }

      if (!createWorker) {
        workerUnavailableRef.current = true;
        finishPendingWorkerQueryOnMainThread(pendingWorkerQueryRef.current);
        return;
      }

      let worker;
      try {
        worker = createWorker();
      } catch (error) {
        console.warn("Browse search worker failed to start; falling back to idle search.", error);
        workerUnavailableRef.current = true;
        finishPendingWorkerQueryOnMainThread(pendingWorkerQueryRef.current);
        return;
      }

      workerRef.current = worker;
      worker.onmessage = handleWorkerMessage;
      worker.onerror = () => {
        const pendingQuery = pendingWorkerQueryRef.current;
        workerUnavailableRef.current = true;
        clearBrowseSearchWorker();
        finishPendingWorkerQueryOnMainThread(pendingQuery);
      };
      worker.postMessage({
        type: "hydrate",
        recordVersion,
        records: burialRecords,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    burialRecords,
    clearBrowseSearchWorker,
    finishPendingWorkerQueryOnMainThread,
    handleWorkerMessage,
  ]);

  const queueWorkerBrowseQuery = useCallback(({ query, browseCacheKey: nextBrowseCacheKey }) => {
    if (!canUseBrowseSearchWorker() || workerUnavailableRef.current) {
      return null;
    }

    const requestId = latestWorkerRequestIdRef.current + 1;
    latestWorkerRequestIdRef.current = requestId;
    pendingWorkerQueryRef.current = {
      browseCacheKey: nextBrowseCacheKey,
      query,
      recordVersion: workerRecordVersionRef.current,
      requestId,
    };
    postPendingWorkerQuery();
    return requestId;
  }, [postPendingWorkerQuery]);

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
    workerRecordVersionRef.current += 1;
    workerUnavailableRef.current = false;
    setDeferredBrowseResults([]);
    clearBrowseSearchWorker();

    const recordVersion = workerRecordVersionRef.current;
    if (burialRecords.length < ASYNC_BROWSE_RECORD_THRESHOLD) {
      return undefined;
    }

    const cancelHydration = hydrateBrowseSearchWorker(recordVersion);
    return () => {
      if (typeof cancelHydration === "function") {
        cancelHydration();
      }
      clearBrowseSearchWorker();
    };
  }, [burialRecords, clearBrowseSearchWorker, hydrateBrowseSearchWorker]);

  useEffect(() => {
    if (!shouldDeferBrowseResults) {
      latestWorkerRequestIdRef.current += 1;
      pendingWorkerQueryRef.current = null;
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

    // Full-cemetery searches can touch tens of thousands of records. Prefer a
    // dedicated worker so scoring does not compete with typing,
    // or Leaflet interaction; the idle path remains the fallback for old
    // browsers and test environments.
    const workerRequestId = queueWorkerBrowseQuery({
      browseCacheKey,
      query: browseQuery,
    });
    if (workerRequestId) {
      return () => {
        cancelled = true;
        if (
          pendingWorkerQueryRef.current?.requestId === workerRequestId &&
          latestWorkerRequestIdRef.current === workerRequestId
        ) {
          pendingWorkerQueryRef.current = null;
        }
      };
    }

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
  }, [
    browseCacheKey,
    browseQuery,
    computeBrowseResults,
    queueWorkerBrowseQuery,
    shouldDeferBrowseResults,
  ]);

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
  burialRecordsById,
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
    browseQuery,
    burialRecords,
    burialRecordsById,
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
