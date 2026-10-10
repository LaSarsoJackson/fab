import { useCallback, useEffect, useRef, useState } from "react";
import { inflateBurialRow } from "./burialRecords";
import { getSearchCriteriaKey } from "./searchEngine";
import { requestBurialSearch, retainBurialSearchWorker } from "./burialSearchClient";

const INITIAL_STATE = Object.freeze({
  status: "idle",
  results: [],
  total: 0,
  error: "",
  criteriaKey: "",
});

export default function useBurialSearch() {
  const pendingRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const [state, setState] = useState(INITIAL_STATE);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    setState(INITIAL_STATE);
  }, []);

  const runSearch = useCallback((criteria = {}) => {
    requestIdRef.current += 1;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    const requestId = requestIdRef.current;
    return new Promise((resolve) => {
      const cancel = requestBurialSearch(criteria, (data) => {
        pendingRef.current.delete(requestId);
        if (data.error || data.cancelled) {
          if (data.error && requestId === requestIdRef.current) {
            setState({ status: "error", results: [], total: 0, error: data.error });
          }
          resolve([]);
          return;
        }
        const results = data.rows.map(inflateBurialRow);
        if (requestId === requestIdRef.current) {
          setState({
            status: "ready",
            results,
            total: data.total,
            error: "",
            criteriaKey: getSearchCriteriaKey(criteria),
          });
        }
        resolve(results);
      });
      pendingRef.current.set(requestId, cancel);
    });
  }, []);

  useEffect(() => {
    const release = retainBurialSearchWorker();
    const pendingRequests = pendingRef.current;
    return () => {
      requestIdRef.current += 1;
      pendingRequests.forEach(cancel => cancel());
      pendingRequests.clear();
      release();
    };
  }, []);

  return { ...state, clear, runSearch };
}
