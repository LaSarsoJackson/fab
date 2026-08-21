import { useCallback, useEffect, useRef, useState } from "react";
import { inflateBurialRow } from "./burialRecords";

const INITIAL_STATE = Object.freeze({
  status: "idle",
  results: [],
  total: 0,
  error: "",
});

export default function useBurialSearch() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const [state, setState] = useState(INITIAL_STATE);

  const clear = useCallback(() => {
    requestIdRef.current += 1;
    setState(INITIAL_STATE);
  }, []);

  const runSearch = useCallback((criteria = {}) => {
    if (!workerRef.current) {
      const worker = new Worker(new URL("./search.worker.js", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = ({ data }) => {
        const resolve = pendingRef.current.get(data.requestId);
        if (data.error) {
          if (data.requestId === requestIdRef.current) {
            setState({ status: "error", results: [], total: 0, error: data.error });
          }
          resolve?.([]);
          pendingRef.current.delete(data.requestId);
          return;
        }
        const results = data.rows.map(inflateBurialRow);
        if (data.requestId === requestIdRef.current) {
          setState({
            status: "ready",
            results,
            total: data.total,
            error: "",
          });
        }
        resolve?.(results);
        pendingRef.current.delete(data.requestId);
      };
      worker.onerror = (event) => {
        if (workerRef.current !== worker) return;
        setState({
          status: "error",
          results: [],
          total: 0,
          error: event.message || "Burial search could not start",
        });
        pendingRef.current.forEach((resolve) => resolve([]));
        pendingRef.current.clear();
        workerRef.current = null;
        worker.terminate();
      };
    }

    requestIdRef.current += 1;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    const requestId = requestIdRef.current;
    workerRef.current.postMessage({
      ...criteria,
      requestId,
      dataUrl: `${import.meta.env.BASE_URL}data/Search_Burials.json`,
    });
    return new Promise((resolve) => {
      pendingRef.current.set(requestId, resolve);
    });
  }, []);

  useEffect(() => () => {
    const worker = workerRef.current;
    workerRef.current = null;
    requestIdRef.current += 1;
    pendingRef.current.forEach((resolve) => resolve([]));
    pendingRef.current.clear();
    worker?.terminate();
  }, []);

  return { ...state, clear, runSearch };
}
