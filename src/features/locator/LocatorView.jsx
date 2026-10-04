import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { formatRecordLocation } from "./burialRecords";
import { getSearchCriteriaKey } from "./searchEngine";

const MIN_QUERY_LENGTH = 2;
const PAGE_SIZE = 80;
const LOCATION_FIELDS = [
  { key: "section", label: "Section", placeholder: "e.g. 49" },
  { key: "lot", label: "Lot", placeholder: "e.g. 30" },
  { key: "tier", label: "Tier", placeholder: "e.g. 2" },
];

const LocationFilters = ({ values, onChange }) => (
  <fieldset className="locator-location-fields">
    <legend>Location</legend>
    <div className="locator-location-grid">
      {LOCATION_FIELDS.map(({ key, label, placeholder }) => (
        <label key={key} className="locator-field" htmlFor={`burial-${key}`}>
          <span>{label}</span>
          <input id={`burial-${key}`} type="search" value={values[key]} onChange={(event) => onChange({ [key]: event.target.value })} placeholder={placeholder} autoComplete="off" enterKeyHint="search" />
        </label>
      ))}
    </div>
  </fieldset>
);

const noMatchesMessage = (query, section, lot, tier) => {
  const location = [section && `section ${section}`, lot && `lot ${lot}`, tier && `tier ${tier}`].filter(Boolean).join(", ");
  if (query) return `No burials match “${query}”${location ? ` in ${location}` : ""}. Try fewer letters, or search by last name only.`;
  return `No burials found in ${location}. Check the location, or use fewer fields.`;
};

const buildSearchCriteria = (query, section, lot, tier) => {
  const criteria = { query: query.trim(), section: section.trim() };
  if (lot.trim()) criteria.lot = lot.trim();
  if (tier.trim()) criteria.tier = tier.trim();
  return criteria;
};

const withLimit = (criteria, limit) => {
  const request = { ...criteria };
  if (limit > PAGE_SIZE) request.limit = limit;
  return request;
};

const LocatorStatus = ({ search, loadingMore, hasSearch, hasLocation, query, section, lot, tier, onRetry }) => {
  if (search.status === "loading") return loadingMore ? null : <p className="status-message" role="status">Searching…</p>;
  if (search.status === "error") return <div className="status-message status-message--error" role="alert">
    <p>Burial search isn’t available right now.</p>
    <button type="button" className="text-button" onClick={onRetry}>Try again</button>
  </div>;
  if (search.status === "ready" && search.total === 0) return <p className="status-message" role="status">{noMatchesMessage(query, section.trim(), lot.trim(), tier.trim())}</p>;
  if (search.status !== "idle") return null;
  if (query.length === 1 && !hasLocation) return <p className="status-message" role="status">Type at least 2 letters.</p>;
  if (hasSearch) return null;
  return <div className="locator-empty">
    <h2>Search by name or location</h2>
    <p>Names can be partial. Use any section, lot, or tier you know to narrow the search.</p>
  </div>;
};

const LocatorResults = ({ search, loadingMore, onSelect, onMore }) => <>
  <p className="result-count" role="status">
    {search.total.toLocaleString()} {search.total === 1 ? "match" : "matches"}
    {search.total > search.results.length ? ` · first ${search.results.length} shown` : ""}
  </p>
  <ol className="record-list">
    {search.results.map((record) => <li key={record.id}>
      <button type="button" className="record-row" onClick={() => onSelect(record)}>
        <span className="record-row__name">{record.displayName}</span>
        <span className="record-row__location">{formatRecordLocation(record) || "Location not recorded"}</span>
        {(record.birth || record.death) ? <span className="record-row__dates">{record.birth || "?"} – {record.death || "?"}</span> : null}
      </button>
    </li>)}
  </ol>
  {search.total > search.results.length ? <div className="locator-more">
    <button type="button" className="secondary-button" onClick={onMore} disabled={loadingMore}>Show more results</button>
    {loadingMore ? <p role="status">Loading more results…</p> : null}
  </div> : null}
</>;

export default function LocatorView({
  initialQuery = "",
  initialSection = "",
  initialLot = "",
  initialTier = "",
  search,
  onRouteChange,
  onSelect,
}) {
  const query = initialQuery;
  const section = initialSection;
  const lot = initialLot;
  const tier = initialTier;
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = query.trim();
  const { clear, runSearch } = search;

  const criteria = useMemo(() => buildSearchCriteria(deferredQuery, section, lot, tier), [deferredQuery, section, lot, tier]);
  const criteriaKey = getSearchCriteriaKey(criteria);
  const [page, setPage] = useState({ criteriaKey: "", limit: PAGE_SIZE });
  const limit = page.criteriaKey === criteriaKey ? page.limit : PAGE_SIZE;
  const resultsRef = useRef(null);
  const nextResultRef = useRef(null);
  const hasLocation = Boolean(section.trim() || lot.trim() || tier.trim());
  const hasSearch = Boolean(normalizedQuery || hasLocation);
  const loadingMore = search.status === "loading" && page.criteriaKey === criteriaKey && search.criteriaKey === criteriaKey;
  const showResults = search.results.length > 0 && (search.status === "ready" || loadingMore);

  useEffect(() => {
    if (page.criteriaKey !== criteriaKey) nextResultRef.current = null;
    if (criteria.query.length < MIN_QUERY_LENGTH && !criteria.section && !criteria.lot && !criteria.tier) {
      clear();
      return;
    }
    runSearch(withLimit(criteria, limit));
  }, [clear, criteria, criteriaKey, limit, page.criteriaKey, runSearch]);

  useEffect(() => {
    const nextIndex = nextResultRef.current;
    if (search.status !== "ready" || nextIndex === null) return;
    const nextRow = resultsRef.current?.querySelectorAll(".record-row")[nextIndex];
    if (!nextRow) return;
    nextResultRef.current = null;
    nextRow.focus({ preventScroll: true });
    nextRow.scrollIntoView({ block: "nearest" });
  }, [search.status, search.results]);

  const showMore = () => {
    nextResultRef.current = search.results.length;
    setPage({ criteriaKey, limit: search.results.length + PAGE_SIZE });
  };

  const updateSearch = (changes) => {
    nextResultRef.current = null;
    setPage({ criteriaKey: "", limit: PAGE_SIZE });
    onRouteChange(changes);
  };

  return (
    <section className="locator-view" aria-labelledby="locator-title">
      <header className="page-heading">
        <h1 id="locator-title">Burial Locator</h1>
        <p>Find a grave in Albany Rural Cemetery.</p>
      </header>

      <div className="locator-layout">
        <div className="locator-fields">
          <label className="locator-field" htmlFor="burial-query">
            <span>Name</span>
            <input
              id="burial-query"
              type="search"
              value={query}
              onChange={(event) => updateSearch({ query: event.target.value })}
              placeholder="First or last name"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <LocationFilters values={{ section, lot, tier }} onChange={updateSearch} />
          {hasSearch ? <button type="button" className="text-button locator-clear" onClick={() => updateSearch({ query: "", section: "", lot: "", tier: "", record: "" })}>Clear search</button> : null}
        </div>

        <div className="locator-results" ref={resultsRef}>
          <LocatorStatus search={search} loadingMore={loadingMore} hasSearch={hasSearch} hasLocation={hasLocation} query={normalizedQuery} section={section} lot={lot} tier={tier} onRetry={() => runSearch(withLimit(criteria, limit))} />
          {showResults ? <LocatorResults search={search} loadingMore={loadingMore} onSelect={onSelect} onMore={showMore} /> : null}
        </div>
      </div>
    </section>
  );
}
