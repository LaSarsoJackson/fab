import { useDeferredValue, useEffect } from "react";
import { formatRecordLocation } from "./burialRecords";

const MIN_QUERY_LENGTH = 2;

export default function LocatorView({
  initialQuery = "",
  initialSection = "",
  search,
  onRouteChange,
  onSelect,
}) {
  const query = initialQuery;
  const section = initialSection;
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = query.trim();
  const { clear, runSearch } = search;

  useEffect(() => {
    const normalizedQuery = deferredQuery.trim();
    const normalizedSection = section.trim();
    if (normalizedQuery.length < MIN_QUERY_LENGTH && !normalizedSection) {
      clear();
      return;
    }
    runSearch({ query: normalizedQuery, section: normalizedSection });
  }, [clear, deferredQuery, runSearch, section]);

  return (
    <section className="locator-view" aria-labelledby="locator-title">
      <header className="page-heading">
        <h1 id="locator-title">Burial Locator</h1>
        <p>Search by name or cemetery section.</p>
      </header>

      <div className="locator-fields">
        <label className="locator-field" htmlFor="burial-query">
          <span>Name</span>
          <input
            id="burial-query"
            type="search"
            value={query}
            onChange={(event) => onRouteChange({ query: event.target.value })}
            placeholder="First or last name"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <label className="locator-field locator-field--section" htmlFor="burial-section">
          <span>Section</span>
          <input
            id="burial-section"
            type="search"
            inputMode="numeric"
            value={section}
            onChange={(event) => onRouteChange({ section: event.target.value })}
            placeholder="e.g. 49"
            enterKeyHint="search"
          />
        </label>
      </div>

      <div className="locator-results" aria-live="polite">
        {search.status === "loading" ? <p className="status-message">Searching…</p> : null}
        {search.status === "error" ? <p className="status-message status-message--error">{search.error}</p> : null}
        {search.status === "idle" && normalizedQuery.length === 1 ? (
          <p className="status-message">Type at least 2 letters.</p>
        ) : null}
        {search.status === "ready" && search.total === 0 ? (
          <p className="status-message">No burials found.</p>
        ) : null}
        {search.status === "ready" && search.total > 0 ? (
          <>
            <p className="result-count">
              {search.total.toLocaleString()} {search.total === 1 ? "match" : "matches"}
              {search.total > search.results.length ? ` · first ${search.results.length} shown` : ""}
            </p>
            <ol className="record-list">
              {search.results.map((record) => (
                <li key={record.id}>
                  <button type="button" className="record-row" onClick={() => onSelect(record)}>
                    <span className="record-row__name">{record.displayName}</span>
                    <span className="record-row__location">{formatRecordLocation(record) || "Location not recorded"}</span>
                    {(record.birth || record.death) ? (
                      <span className="record-row__dates">{record.birth || "?"} – {record.death || "?"}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </section>
  );
}
