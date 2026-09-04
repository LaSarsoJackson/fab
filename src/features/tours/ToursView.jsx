import { useDeferredValue, useMemo, useState } from "react";
import { SearchIcon } from "../../app/icons";
import { FAB_TOUR_DEFINITIONS } from "../fab/tours";

export default function ToursView({
  continueTour = null,
  loadingTour = "",
  onContinueTour,
  onSelectTour,
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const continueLabel = continueTour?.kind === "collection"
    ? "Continue browsing"
    : "Continue tour";
  const tours = useMemo(() => FAB_TOUR_DEFINITIONS.filter(({ name }) => (
    !deferredQuery || name.toLocaleLowerCase().includes(deferredQuery)
  )), [deferredQuery]);

  return (
    <section className="tours-view" aria-labelledby="tours-title">
      <header className="page-heading">
        <h1 id="tours-title">Search Tours</h1>
        <p>Choose a tour or browse graves by section or group.</p>
      </header>

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

      <label className="tour-search" htmlFor="tour-query">
        <SearchIcon />
        <span className="visually-hidden">Search tours</span>
        <input
          id="tour-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a tour"
        />
      </label>

      {tours.length > 0 ? (
        <ul className="tour-grid">
          {tours.map((tour) => {
            const isLoading = loadingTour === tour.key;
            return (
              <li key={tour.key}>
                <button
                  type="button"
                  className="tour-card"
                  disabled={isLoading}
                  onClick={() => onSelectTour(tour)}
                >
                  <span className="tour-card__content">
                    <span className="tour-card__name">{tour.name}</span>
                    <span className="tour-card__action">
                      {isLoading ? "Loading…" : tour.kind === "collection" ? "Browse graves" : "View stops"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="status-message">No tours match "{query}".</p>
      )}
    </section>
  );
}
