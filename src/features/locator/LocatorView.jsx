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

  const updateQuery = (value) => {
    onRouteChange({ query: value });
  };

  const updateSection = (value) => {
    onRouteChange({ section: value });
  };

  return (
    <section className="locator-view" aria-labelledby="locator-title">
      <header className="page-heading">
        <p className="page-heading__eyebrow">97,457 cemetery records</p>
        <h1 id="locator-title">Burial Locator</h1>
        <p>Search by name. Add a section only when you need to narrow the list.</p>
      </header>

      <div className="locator-search">
        <label htmlFor="burial-query">Name</label>
        <div className="search-field">
          <input
            id="burial-query"
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="First or last name"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button type="button" className="text-button" onClick={() => updateQuery("")}>
              Clear
            </button>
          ) : null}
        </div>

        <details className="section-filter" open={Boolean(section)}>
          <summary>Filter by cemetery section</summary>
          <label htmlFor="burial-section">Section number</label>
          <input
            id="burial-section"
            inputMode="numeric"
            value={section}
            onChange={(event) => updateSection(event.target.value)}
            placeholder="For example, 49"
          />
        </details>
      </div>

      <div className="locator-results" aria-live="polite">
        {search.status === "loading" ? <p className="status-message">Searching cemetery records…</p> : null}
        {search.status === "error" ? <p className="status-message status-message--error">{search.error}</p> : null}
        {search.status === "idle" ? (
          <p className="status-message">Enter at least two letters, or browse a section.</p>
        ) : null}
        {search.status === "ready" && search.total === 0 ? (
          <p className="status-message">No burial records match this search.</p>
        ) : null}
        {search.status === "ready" && search.total > 0 ? (
          <>
            <p className="result-count">
              {search.total.toLocaleString()} {search.total === 1 ? "record" : "records"}
              {search.total > search.results.length ? ` · showing first ${search.results.length}` : ""}
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
