import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";

export default function useLocalRouting(active, contextKey) {
  const [draft, setDraft] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const locationRequest = useRef(0);
  if (draft && draft.contextKey !== contextKey) setDraft(null);
  const from = draft?.start?.coordinates;
  const to = draft?.end?.coordinates;
  const input = useMemo(() => from && to ? { from, to } : null, [from, to]);

  useEffect(() => {
    if (!input || !active) return undefined;
    let cancelled = false;
    import("./mapRouting").then(({ routeOnCemeteryRoads }) => {
      const result = routeOnCemeteryRoads(input.from, input.to);
      if (!cancelled) setCalculation({ input, result });
    }).catch((error) => {
      if (!cancelled) setCalculation({ input, error: error.message });
    });
    return () => { cancelled = true; };
  }, [input, active]);

  useEffect(() => () => {
    locationRequest.current += 1;
    setDraft((current) => current?.locating ? { ...current, locating: false } : current);
  }, [active, contextKey]);

  const start = (record = null) => {
    locationRequest.current += 1;
    setDraft({
      contextKey,
      start: null,
      end: isCoordinatePairValid(record?.coordinates)
        ? { coordinates: record.coordinates, label: record.displayName } : null,
      picking: null,
      locating: false,
      error: "",
    });
  };
  const close = () => { locationRequest.current += 1; setDraft(null); };
  const pick = (endpoint) => {
    locationRequest.current += 1;
    setDraft((current) => ({ ...current, picking: endpoint, locating: false, error: "" }));
  };
  const choosePoint = useCallback((coordinates) => {
    setDraft((current) => current?.picking ? {
      ...current,
      [current.picking]: { coordinates, label: current.picking === "start" ? "Map start" : "Map destination" },
      picking: null,
      error: "",
    } : current);
  }, []);
  const useLocation = () => {
    const request = ++locationRequest.current;
    setDraft((current) => ({ ...current, start: null, picking: null, locating: true, error: "" }));
    const fail = (message) => {
      if (request === locationRequest.current) {
        setDraft((current) => ({ ...current, locating: false, error: message }));
      }
    };
    if (!navigator.geolocation) { fail("Location is unavailable. Choose a start on the map."); return; }
    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      if (request !== locationRequest.current) return;
      if (!Number.isFinite(coords.accuracy) || coords.accuracy > 100 || !Number.isFinite(timestamp) || Date.now() - timestamp > 60000) {
        fail("Your location is too imprecise or out of date. Try again or choose a start on the map.");
        return;
      }
      setDraft((current) => ({ ...current, locating: false,
        start: { coordinates: [coords.longitude, coords.latitude], label: "My location" },
      }));
    }, (error) => fail(error.code === 1
      ? "Location is blocked. Choose a start on the map, or allow location in your browser settings."
      : "Your location could not be found. Try again or choose a start on the map."),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  };
  const result = calculation?.input === input ? calculation : null;
  return {
    draft, start, close, pick, choosePoint, useLocation,
    cancelPick: () => setDraft((current) => ({ ...current, picking: null })),
    result: result?.result,
    error: draft?.error || result?.error || "",
    calculating: Boolean(input && !result),
  };
}
