import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CloseIcon, EditIcon } from "../../app/icons";
import { buildDirectionsLink } from "../../shared/routing";

const RoutePlaces = lazy(() => import("./RoutePlaces"));
const endpointTitles = { start: "From", end: "To" };
const metres = (distance) => `${Math.round(distance).toLocaleString()} m`;
const statusMessage = (draft, result, calculating) => {
  if (draft.following) {
    if (!draft.start && draft.signal === "stale") return "No location update. Choose a start or wait for GPS.";
    if (!draft.start && draft.signal === "weak") return "Waiting for a more accurate location…";
    if (draft.signal === "stale") return "Location isn't updating. Showing last position.";
    if (draft.signal === "weak") return "Location is too imprecise. Showing last position.";
    return draft.signal === "starting" ? "Finding your location…" : "Following your location.";
  }
  if (draft.locating) return "Finding your location…";
  if (calculating) return "Finding a route…";
  if (result) return "Route ready, along mapped roads.";
  return "";
};
const RouteStatus = ({ draft, result, calculating }) => {
  const settled = result && (!draft.following || draft.signal === "good") && !draft.locating && !calculating;
  return <p role="status" className={settled ? "visually-hidden" : "map-route-status"}>{statusMessage(draft, result, calculating)}</p>;
};
const EndpointRow = ({ endpoint, point, onClick }) => (
  <button id={`route-${endpoint}`} type="button" className="map-route-endpoint" aria-label={`${endpoint === "start" ? "From" : "To"} ${point?.label || (endpoint === "start" ? "Choose start" : "Choose destination")}`} onClick={onClick}>
    <span className="map-route-endpoint__label">{endpoint === "start" ? "From" : "To"}</span>
    <span className="map-route-endpoint__value">{point?.label || (endpoint === "start" ? "Choose start" : "Choose destination")}</span>
    <EditIcon />
  </button>
);
const EndpointOptions = ({ endpoint, records, available, onLocate, onPick, onChoose }) => (
  <div id={`route-${endpoint}-options`} className="map-route-options">
    {endpoint === "start" && available ? <button type="button" className="secondary-button" onClick={onLocate}>Use my location</button> : null}
    <button type="button" className="secondary-button" onClick={onPick}>Choose on map</button>
    <Suspense fallback={<p>Loading places…</p>}><RoutePlaces records={records} onChoose={onChoose} /></Suspense>
  </div>
);
const RouteFooter = ({ routing, available, options }) => {
  const { draft } = routing;
  if (!available || options || (draft.start && !draft.following)) return null;
  return <div className="map-route-footer">
    <button type="button" className={draft.following ? "text-button" : "primary-button"} onClick={draft.following ? routing.stopFollowing : routing.follow}>
      {draft.following ? "Stop following" : "Use my location"}
    </button>
  </div>;
};
const RouteDetails = ({ result, fix, directions }) => <details className="map-route-details">
  <summary>Route details</summary>
  {result ? <>
    <p>Solid lines follow mapped roads. Dashed lines connect to your start or destination.</p>
    {result.startGap > 1 ? <p>Start: {metres(result.startGap)} from the road.</p> : null}
    {result.endGap > 1 ? <p>Destination: {metres(result.endGap)} from the road.</p> : null}
    <p>Check signs and access on arrival. Section locations mark their centers.</p>
  </> : null}
  {fix ? <p>Location accuracy: ±{Math.ceil(fix.accuracy)} m</p> : null}
  {fix ? <p>Location stays on this device and stops updating when you close directions.</p> : null}
  {directions ? <a className="text-button" href={directions.href} target={directions.target} rel="noreferrer">Open in Maps ↗</a> : null}
</details>;

export default function RoutePanel({ routing, records = [], allowLocation = true }) {
  const { draft, result, error, calculating } = routing;
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const promptRef = useRef(null);
  const previousPick = useRef(null);
  const [options, setOptions] = useState(null);
  const available = allowLocation && Boolean(navigator.geolocation);
  const restore = (endpoint) => requestAnimationFrame(() => document.getElementById(`route-${endpoint}`)?.focus({ preventScroll: true }));
  const collapse = () => { setOptions(null); restore(options); };
  const pick = (endpoint) => { setOptions(null); routing.pick(endpoint); };
  const locate = () => { setOptions(null); routing.follow(); restore("start"); };
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (draft.following && contentRef.current) contentRef.current.scrollTop = 0; }, [draft.following]);
  useEffect(() => {
    if (draft.picking) promptRef.current?.focus({ preventScroll: true });
    else if (previousPick.current) document.getElementById(`route-${previousPick.current}`)?.focus({ preventScroll: true });
    previousPick.current = draft.picking;
  }, [draft.picking]);
  const directions = draft.end ? buildDirectionsLink({
    longitude: draft.end.coordinates[0], latitude: draft.end.coordinates[1],
    originLongitude: draft.start?.coordinates[0], originLatitude: draft.start?.coordinates[1],
    label: draft.end.label, userAgent: navigator.userAgent,
  }) : null;

  return (
    <aside className={`map-route-panel${draft.picking ? " map-route-panel--picking" : ""}`} aria-label="Cemetery directions" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (draft.picking) routing.cancelPick();
      else if (options) collapse();
      else routing.close();
      event.stopPropagation();
    }}>
      <header>
        <div>
          <h2 id="route-title" tabIndex={-1} ref={titleRef}>{endpointTitles[options] || "Directions"}</h2>
          {result && !options ? <strong className="map-route-distance">{metres(result.roadDistance)} · mapped roads</strong> : null}
        </div>
        <button type="button" className="icon-button" aria-label="Close route" onClick={routing.close}><CloseIcon /></button>
      </header>
      {draft.picking ? (
        <div className="map-route-prompt" tabIndex={-1} ref={promptRef}>
          <p>Tap the map to set {draft.picking === "start" ? "your start" : "the destination"}.</p>
          <span className="visually-hidden">Or move the map with arrow keys and choose Set {draft.picking === "start" ? "start" : "destination"} here at the crosshair.</span>
          <button type="button" className="text-button" onClick={routing.cancelPick}>Cancel</button>
        </div>
      ) : <>
        <div className="map-route-panel__content" ref={contentRef}>
          {options ? <>
            <button type="button" className="text-button map-route-back" aria-label="Back to directions" onClick={collapse}>← Back</button>
            <EndpointOptions endpoint={options} records={records} available={available} onLocate={locate} onPick={() => pick(options)} onChoose={(point) => { routing.setPoint(options, point); collapse(); }} />
          </> : ["start", "end"].map((endpoint) => <EndpointRow key={endpoint} endpoint={endpoint} point={draft[endpoint]} onClick={() => setOptions(endpoint)} />)}
          <RouteStatus draft={draft} result={result} calculating={calculating} />
          {error ? <p role="alert">{error}</p> : null}
          {!options && (result || draft.fix) ? <div className="map-route-actions">
            <RouteDetails result={result} fix={draft.fix} directions={directions} />
            {result ? <button type="button" className="text-button" onClick={routing.showWholeRoute}>Show whole route</button> : null}
          </div> : null}
        </div>
        <RouteFooter routing={routing} available={available} options={options} />
      </>}
    </aside>
  );
}
