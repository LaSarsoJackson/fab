import { useEffect, useRef, useState } from "react";
import { buildDirectionsLink } from "../../shared/routing";

const metres = (distance) => `${Math.round(distance).toLocaleString()} m`;

const RouteSummary = ({ result, draft }) => (
  <div className="map-route-result" role="status">
    <strong>{metres(result.roadDistance)} along mapped roads</strong>
    <span>{draft.start.label} → {draft.end.label}</span>
    {result.endGap > 1 ? <span>Destination is {metres(result.endGap)} from the road.</span> : null}
    <span>Dashed lines show gaps to the road, not mapped paths. Check access on site.</span>
  </div>
);

export default function RoutePanel({ routing }) {
  const { draft, result, error, calculating } = routing;
  const titleRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const pick = (endpoint) => { setEditing(false); routing.pick(endpoint); };
  const locate = () => { setEditing(false); routing.useLocation(); };
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  const directions = draft.end ? buildDirectionsLink({
    longitude: draft.end.coordinates[0], latitude: draft.end.coordinates[1],
    originLongitude: draft.start?.coordinates[0], originLatitude: draft.start?.coordinates[1],
    label: draft.end.label, userAgent: navigator.userAgent,
  }) : null;

  return (
    <aside className={`map-route-panel${draft.picking ? " map-route-panel--picking" : ""}`} aria-labelledby="route-title">
      <header>
        <h2 id="route-title" tabIndex={-1} ref={titleRef}>Cemetery route</h2>
        <button type="button" className="text-button" onClick={routing.close}>Close route</button>
      </header>
      {draft.picking ? (
        <div className="map-route-prompt" role="status">
          <span>Tap the map to choose {draft.picking === "start" ? "your start" : "a destination"}.</span>
          <button type="button" className="text-button" onClick={routing.cancelPick}>Cancel pick</button>
        </div>
      ) : (
        <div className="map-route-panel__content">
          {result && !editing ? <RouteSummary result={result} draft={draft} /> : null}
          {(!result || editing) ? <>
          <div className="map-route-endpoint">
            <p><strong>From:</strong> {draft.start?.label || "Choose a start"}</p>
            <div className="map-route-actions">
              <button type="button" className="secondary-button" onClick={locate}>
                {draft.locating ? "Locating…" : "Use my location"}
              </button>
              <button type="button" className="secondary-button" onClick={() => pick("start")}>Choose start on map</button>
            </div>
          </div>
          <div className="map-route-endpoint">
            <p><strong>To:</strong> {draft.end?.label || "Choose a destination"}</p>
            <button type="button" className="text-button" onClick={() => pick("end")}>Choose destination on map</button>
          </div>
          </> : <button type="button" className="text-button" onClick={() => setEditing(true)}>Change route points</button>}
          {!result ? <p className="map-route-note">Plan along the cemetery roads. Pick a start on the map to plan before your visit.</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {calculating ? <p role="status">Finding a route…</p> : null}
          {directions ? <a className="text-button" href={directions.href} target={directions.target} rel="noreferrer">Open in Maps</a> : null}
        </div>
      )}
    </aside>
  );
}
