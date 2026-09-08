import { useState } from "react";
import { ArrowRightIcon, SearchIcon } from "../../app/icons";
import { FAB_TOUR_DEFINITIONS } from "../fab/tours";

export default function ToursView({
  continueTour = null,
  loadingTour = "",
  onContinueTour,
  onSelectTour,
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const continueLabel = continueTour?.kind === "collection"
    ? "Continue browsing"
    : "Continue tour";
  const tours = FAB_TOUR_DEFINITIONS.filter(({ name }) => (
    !normalizedQuery || name.toLocaleLowerCase().includes(normalizedQuery)
  ));

  return (
    <section className="tours-view" aria-labelledby="tours-title">
      <div className="catalogue-heading">
        <header className="page-heading">
          <h1 id="tours-title">Search Tours</h1>
          <p>Choose a tour or browse graves by section or group.</p>
        </header>
        <label className="tour-search" htmlFor="tour-query">
          <SearchIcon />
          <span className="visually-hidden">Search tours</span>
          <input
            id="tour-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a tour or group"
          />
        </label>
      </div>

      {continueTour ? (
        <button
          type="button"
          className="tour-continue"
          aria-label={`${continueLabel}: ${continueTour.name}${continueTour.recordName ? ` from ${continueTour.recordName}` : ""}`}
          onClick={onContinueTour}
        >
          <span className="tour-continue__eyebrow">{continueLabel}</span>
          <strong>{continueTour.name}</strong>
          {continueTour.recordName ? <span>{continueTour.recordName}</span> : null}
          <span className="tour-continue__action">Open map</span>
        </button>
      ) : null}

      {tours.length > 0 ? (
        <div className="tour-catalogue">
          {["collection", "tour"].map((kind) => {
            const entries = tours.filter((tour) => tour.kind === kind);
            if (!entries.length) return null;
            return (
              <section key={kind} className={`tour-group tour-group--${kind}`} aria-labelledby={`group-${kind}`}>
                <h2 id={`group-${kind}`}>{kind === "tour" ? "Tours" : "Sections & groups"}</h2>
                <ul className="tour-list">
                  {entries.map((tour) => {
                    const isLoading = loadingTour === tour.key;
                    return (
                      <li key={tour.key}>
                        <button
                          type="button"
                          className="tour-row"
                          aria-label={`${tour.name}: ${kind === "collection" ? "Browse graves" : "View stops"}`}
                          disabled={isLoading}
                          onClick={() => onSelectTour(tour)}
                        >
                          <span className="tour-row__name">{tour.name}</span>
                          {isLoading ? <span className="tour-row__loading">Loading…</span> : <ArrowRightIcon />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="status-message">No tours or groups match “{query}”.</p>
      )}
    </section>
  );
}
