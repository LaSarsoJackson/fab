import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { distanceMeters } from "../../shared/distanceMeters";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";

const LOCATION_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
const locationError = (code) => code === 1
  ? "Location is blocked. Choose a start on the map, or allow location in your browser settings."
  : "Your location could not be found. Try again or choose a start on the map.";
const readFix = ({ coords, timestamp }) => {
  const coordinates = [coords.longitude, coords.latitude];
  const age = Date.now() - timestamp;
  if (!isCoordinatePairValid(coordinates) || !Number.isFinite(coords.accuracy) || coords.accuracy < 0 || coords.accuracy > 100 || !Number.isFinite(age) || age < -1000 || age > 60000) return null;
  return { coordinates, accuracy: coords.accuracy, at: timestamp };
};
const stoppedDraft = (current) => current ? {
  ...current, following: false, locating: false, signal: "", position: null,
  start: current.start?.gps ? { ...current.start, label: "My location (last position)" } : current.start,
} : current;

const calculationState = (calculation, input, draft) => {
  const current = calculation?.input === input ? calculation : null;
  const pending = draft?.following && input && !current && calculation?.input.to === input.to ? calculation.result : null;
  return { result: current?.result || pending, error: draft?.error || current?.error || "",
    calculating: Boolean(input && !current && !pending) };
};

export default function useLocalRouting(active, contextKey) {
  const [draft, setDraft] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const locationRequest = useRef(0);
  const watchId = useRef(null);
  const lastRoutedFix = useRef(null);
  const openerId = useRef("");
  if (draft && (!active || draft.contextKey !== contextKey)) setDraft(null);
  const from = draft?.start?.coordinates;
  const to = draft?.end?.coordinates;
  const input = useMemo(() => from && to ? { from, to } : null, [from, to]);

  const cancelLocation = useCallback(() => {
    locationRequest.current += 1;
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    lastRoutedFix.current = null;
  }, []);
  const stopFollowing = useCallback(() => {
    cancelLocation();
    setDraft(stoppedDraft);
  }, [cancelLocation]);

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

  useEffect(() => cancelLocation, [active, contextKey, cancelLocation]);

  useEffect(() => {
    if (!draft?.following) return undefined;
    const timer = setInterval(() => setDraft((current) => {
      if (!current?.following || current.signal === "stale") return current;
      return Date.now() - (current.fix?.at || current.followStarted) > 20000
        ? { ...current, signal: "stale" } : current;
    }), 5000);
    window.addEventListener("pagehide", stopFollowing);
    return () => { clearInterval(timer); window.removeEventListener("pagehide", stopFollowing); };
  }, [draft?.following, stopFollowing]);

  const start = (record = null, trigger = null) => {
    openerId.current = trigger?.id || "";
    cancelLocation();
    setDraft({ contextKey, start: null,
      end: isCoordinatePairValid(record?.coordinates) ? { coordinates: record.coordinates, label: record.displayName } : null,
      picking: null, locating: false, following: false, error: "", viewRevision: 0,
    });
  };
  const close = () => {
    cancelLocation();
    const returnTo = openerId.current;
    setDraft(null);
    requestAnimationFrame(() => document.getElementById(returnTo)?.focus({ preventScroll: true }));
  };
  const pick = (endpoint) => {
    cancelLocation();
    setDraft((current) => ({ ...stoppedDraft(current), picking: endpoint, error: "" }));
  };
  const setPoint = (endpoint, point) => {
    if (!isCoordinatePairValid(point?.coordinates)) return;
    cancelLocation();
    setDraft((current) => current ? { ...stoppedDraft(current), [endpoint]: point,
      picking: null, error: "", viewRevision: current.viewRevision + 1 } : current);
  };
  const choosePoint = useCallback((coordinates) => {
    setDraft((current) => current?.picking ? {
      ...current, [current.picking]: { coordinates, label: current.picking === "start" ? "Map start" : "Map destination" },
      picking: null, error: "", viewRevision: current.viewRevision + 1,
    } : current);
  }, []);
  const useLocation = () => {
    cancelLocation();
    const request = locationRequest.current;
    setDraft((current) => ({ ...stoppedDraft(current), picking: null, locating: true, error: "" }));
    const fail = (message) => {
      if (request === locationRequest.current) setDraft((current) => current ? { ...current, locating: false, error: message } : current);
    };
    if (!navigator.geolocation) { fail("Location is unavailable. Choose a start on the map."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      if (request !== locationRequest.current) return;
      const fix = readFix(position);
      if (!fix) { fail("Your location is too imprecise or out of date. Try again or choose a start on the map."); return; }
      setDraft((current) => current ? { ...current, locating: false, fix,
        start: { coordinates: fix.coordinates, label: "My location", gps: true },
        viewRevision: current.viewRevision + 1,
      } : current);
    }, (error) => fail(locationError(error.code)), LOCATION_OPTIONS);
  };
  const follow = () => {
    cancelLocation();
    const request = locationRequest.current;
    setCalculation(null);
    setDraft((current) => ({ ...current, start: null, position: null, following: true, followStarted: Date.now(), fix: null, signal: "starting", error: "" }));
    const receive = (position) => {
      if (request !== locationRequest.current) return;
      const fix = readFix(position);
      if (!fix) {
        setDraft((current) => current ? { ...current, signal: current.signal === "stale" ? "stale" : "weak" } : current);
        return;
      }
      const previous = lastRoutedFix.current;
      const moved = !previous || (Date.now() - previous.routedAt >= 2000 && distanceMeters(previous.coordinates, fix.coordinates) >= Math.max(5, Math.min(25, fix.accuracy / 2)));
      if (moved) lastRoutedFix.current = { ...fix, routedAt: Date.now() };
      setDraft((current) => current ? { ...current, fix, position: fix.coordinates, signal: "good",
        start: moved ? { coordinates: fix.coordinates, label: "My location · following", gps: true } : current.start,
      } : current);
    };
    const fail = (error) => {
      if (request !== locationRequest.current) return;
      if (error.code === 1) {
        cancelLocation();
        setDraft((current) => current ? { ...stoppedDraft(current), error: locationError(error.code) } : current);
      } else setDraft((current) => current ? { ...current, signal: current.signal === "stale" ? "stale" : "weak" } : current);
    };
    if (!navigator.geolocation) { fail({ code: 1 }); return; }
    const id = navigator.geolocation.watchPosition(receive, fail, { ...LOCATION_OPTIONS, maximumAge: 5000, timeout: 20000 });
    // Some browser shims fail synchronously before returning the watch ID.
    if (request === locationRequest.current) watchId.current = id;
    else navigator.geolocation.clearWatch(id);
  };
  return {
    draft, start, close, pick, choosePoint, setPoint, useLocation, follow, stopFollowing,
    showWholeRoute: () => setDraft((value) => ({ ...value, viewRevision: value.viewRevision + 1 })),
    cancelPick: () => setDraft((value) => ({ ...value, picking: null })),
    ...calculationState(calculation, input, draft),
  };
}
