import { useEffect, useMemo, useState } from "react";
import sections from "../../data/ARC_Sections.json";
import { getSectionBounds } from "./mapSections";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";
import useBurialSearch from "../locator/useBurialSearch";
import { formatRecordLocation } from "../locator/burialRecords";
import { getSearchCriteriaKey } from "../locator/searchEngine";

const sectionChoices = [...new Set(sections.features.map(({ properties }) => String(properties.Section)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).flatMap((section) => {
  const bounds = getSectionBounds(section);
  if (!bounds) return [];
  const [[south, west], [north, east]] = bounds;
  return [{ id: `section:${section}`, label: `Section ${section}`, detail: "Map center", coordinates: [(west + east) / 2, (south + north) / 2] }];
});

export default function RoutePlaces({ records, onChoose }) {
  const [value, setValue] = useState("");
  const query = value.trim();
  const search = useBurialSearch();
  const { runSearch, clear } = search;
  const criteria = useMemo(() => ({ query, limit: 8 }), [query]);
  const names = query.length >= 2 && !/^(?:section\s*)?\d/i.test(query);
  const ready = search.status === "ready" && search.criteriaKey === getSearchCriteriaKey(criteria);
  useEffect(() => {
    if (!names) { clear(); return undefined; }
    const timer = setTimeout(() => { void runSearch(criteria); }, 250);
    return () => clearTimeout(timer);
  }, [criteria, names, clear, runSearch]);
  const terms = query.toLocaleLowerCase().split(/\s+/);
  const current = query ? records.filter(record => terms.every(term => record.displayName.toLocaleLowerCase().includes(term))) : [];
  const graves = [...current, ...(ready ? search.results : [])].filter(record => isCoordinatePairValid(record.coordinates));
  const uniqueGraves = [...new Map(graves.map(record => [String(record.id), { ...record, label: record.displayName, detail: formatRecordLocation(record) }])).values()].slice(0, 8);
  const sectionQuery = query.replace(/^section\s*/i, "").toLocaleLowerCase();
  const matches = query ? sectionChoices.filter(section => section.label.toLocaleLowerCase().replace("section ", "").startsWith(sectionQuery)).slice(0, 8) : [];
  const choices = [...matches, ...uniqueGraves];
  return <div className="map-route-places">
    <label className="visually-hidden" htmlFor="route-place">Section or burial</label>
    <input id="route-place" type="search" value={value} onChange={event => setValue(event.target.value)} placeholder="Section or name" autoComplete="off" />
    {choices.length ? <ul className="map-route-place-results">{choices.map(point => <li key={point.id}>
      <button type="button" aria-label={point.label} onClick={() => onChoose(point)}><strong>{point.label}</strong>{point.detail ? <span>{point.detail}</span> : null}</button>
    </li>)}</ul> : null}
    {query && !choices.length ? <p role="status">{names && !ready && search.status !== "error" ? "Searching…" : "No places found."}</p> : null}
    {names && search.status === "error" ? <div role="alert"><p>Burial search couldn’t load.</p><button type="button" className="text-button" onClick={() => runSearch(criteria)}>Try again</button></div> : null}
  </div>;
}
