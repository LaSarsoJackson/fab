import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { buildDirectionsLink } from "../../shared/routing";

const RoutePlaces = lazy(() => import("./RoutePlaces"));
const metres = (distance) => `${Math.round(distance).toLocaleString()} m`;
const RouteSummary = ({ result }) => (
  <div className="map-route-result">
    {result.startGap > 1 ? <span>Your start is {metres(result.startGap)} from the road.</span> : null}
    {result.endGap > 1 ? <span>Destination is {metres(result.endGap)} from the road.</span> : null}
    <span>Dashed lines are straight links, not mapped paths. Roads may not show closures; check signs and access on site.</span>
  </div>
);
const statusMessage = (draft, result, calculating) => {
  if (draft.following) {
    if (!draft.start && draft.signal === "stale") return "No location update for 20 seconds. Wait for a fix, or choose a start.";
    if (!draft.start && draft.signal === "weak") return "GPS signal is weak or unavailable. Wait for a better fix, or choose a start.";
    if (draft.signal === "stale") return "Location isn't updating. The route uses your last position.";
    if (draft.signal === "weak") return "Your location is too imprecise or unavailable. The route uses your last position.";
    return draft.signal === "starting" ? "Finding your live location…" : "Following your location.";
  }
  if (draft.locating) return "Finding your location…";
  if (calculating) return "Finding a route…";
  if (result) return "Route ready. Approximate, along mapped roads.";
  return "Choose a start and destination.";
};
const EndpointRow = ({ endpoint, point, expanded, onClick }) => (
  <button id={`route-${endpoint}`} type="button" className="map-route-endpoint" aria-label={`${endpoint === "start" ? "From" : "To"} ${point?.label || (endpoint === "start" ? "Choose start" : "Choose destination")}`} aria-expanded={expanded} aria-controls={`route-${endpoint}-options`} onClick={onClick}>
    <span className="map-route-endpoint__label">{endpoint === "start" ? "From" : "To"}</span>
    <span className="map-route-endpoint__value">{point?.label || (endpoint === "start" ? "Choose start" : "Choose destination")}</span>
    <span aria-hidden="true">⌄</span>
  </button>
);
const EndpointOptions = ({ endpoint, available, onLocate, onPick, onList }) => {
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus({ preventScroll: true }); }, []);
  return <div id={`route-${endpoint}-options`} className="map-route-options">
    {endpoint === "start" && available ? <button ref={firstRef} type="button" className="secondary-button" onClick={onLocate}>Use my location</button> : null}
    <button ref={endpoint === "start" && available ? undefined : firstRef} type="button" className="secondary-button" onClick={onPick}>Choose on map</button>
    <button type="button" className="secondary-button" onClick={onList}>Choose from list</button>
  </div>;
};
const FooterNote = ({ full, short }) => <p><span className="route-note-full">{full}</span><span className="route-note-short">{short}</span></p>;
const RouteFooter = ({ routing, available }) => {
  const { draft } = routing;
  return <div className="map-route-footer">
    {available ? <button type="button" className="primary-button" disabled={draft.locating} onClick={draft.following ? routing.stopFollowing : draft.start ? routing.follow : routing.useLocation}>
      {draft.following ? "Stop following" : draft.start ? "Follow my location" : "Start from my location"}
    </button> : <p>Location isn't available in this browser. Choose a start on the map or from the list.</p>}
    {!draft.following && available ? <FooterNote full={draft.start ? "Updates the line as you walk. Stops when you close directions or change a point." : "Your browser will ask for permission. Your position stays in FAB on this device."} short={draft.start ? "Updates as you walk; stops on close or edit." : "Ask first; position stays here."} /> : null}
    {draft.following ? <FooterNote full="Your position stays on this device. Stop following ends updates for these directions." short="On this device; Stop ends updates." /> : null}
  </div>;
};

export default function RoutePanel({ routing, records = [] }) {
  const { draft, result, error, calculating } = routing;
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const promptRef = useRef(null);
  const previousPick = useRef(null);
  const [options, setOptions] = useState(null);
  const [list, setList] = useState(null);
  const available = Boolean(navigator.geolocation);
  const restore = (endpoint) => requestAnimationFrame(() => document.getElementById(`route-${endpoint}`)?.focus({ preventScroll: true }));
  const collapse = () => { const endpoint = options || list; setOptions(null); setList(null); restore(endpoint); };
  const pick = (endpoint) => { setOptions(null); setList(null); routing.pick(endpoint); };
  const locate = () => { setOptions(null); routing.useLocation(); restore("start"); };
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
    <aside className={`map-route-panel${draft.picking ? " map-route-panel--picking" : ""}`} aria-labelledby="route-title" onKeyDown={(event) => {
      if (event.key !== "Escape") return;
      if (draft.picking) routing.cancelPick();
      else if (options || list) collapse();
      else routing.close();
      event.stopPropagation();
    }}>
      <header>
        <div>
          <h2 id="route-title" tabIndex={-1} ref={titleRef}>Cemetery directions</h2>
          {result ? <strong className="map-route-distance">{metres(result.roadDistance)}<span className="route-note-full"> along mapped roads</span><span className="route-note-short"> · mapped roads</span></strong> : null}
        </div>
        <button type="button" className="text-button" onClick={routing.close}>Close route</button>
      </header>
      {draft.picking ? (
        <div className="map-route-prompt" tabIndex={-1} ref={promptRef}>
          <p>Tap the map to choose {draft.picking === "start" ? "your start" : "a destination"}. Or use arrow keys to move the map, then press Set {draft.picking === "start" ? "start" : "destination"} here at the crosshair.</p>
          <button type="button" className="text-button" onClick={routing.cancelPick}>Cancel pick</button>
        </div>
      ) : <>
        <div className="map-route-panel__content" ref={contentRef}>
          {!result ? <p className="map-route-note">Approximate route on mapped cemetery roads.</p> : null}
          {list ? <Suspense fallback={<p>Loading mapped places…</p>}>
            <RoutePlaces records={records} endpoint={list} onChoose={(point) => { routing.setPoint(list, point); collapse(); }} onCancel={collapse} />
          </Suspense> : ["start", "end"].map((endpoint) => <div key={endpoint}>
            <EndpointRow endpoint={endpoint} point={draft[endpoint]} expanded={options === endpoint} onClick={() => setOptions(options === endpoint ? null : endpoint)} />
            {options === endpoint ? <EndpointOptions endpoint={endpoint} available={available} onLocate={locate} onPick={() => pick(endpoint)} onList={() => { setList(endpoint); setOptions(null); }} /> : null}
          </div>)}
          <p role="status" className="map-route-status">{statusMessage(draft, result, calculating)}</p>
          {draft.following && draft.fix ? <p className="map-route-note">Approximate position (±{Math.ceil(draft.fix.accuracy)} m)</p> : null}
          {result ? <RouteSummary result={result} /> : null}
          {error ? <p role="alert">{error}</p> : null}
          {result ? <button type="button" className="text-button" onClick={routing.showWholeRoute}>Show whole route</button> : null}
          {directions ? <div className="map-route-external">
            <a className="text-button" href={directions.href} target={directions.target} rel="noreferrer">Open in Maps ↗</a>
            <p>Sends your chosen points to your maps app when you tap it.</p>
          </div> : null}
        </div>
        <RouteFooter routing={routing} available={available} />
      </>}
    </aside>
  );
}
