import { useEffect, useRef } from "react";
import { formatRecordLocation } from "../locator/burialRecords";

export default function TourStopsPanel({
  detailsOpen = false,
  tour,
  records = [],
  selectedRecord,
  onExit,
  onSelect,
}) {
  const selectedPlaceRef = useRef(null);

  useEffect(() => {
    if (detailsOpen) return;
    selectedPlaceRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [detailsOpen, selectedRecord?.id]);

  if (!tour || records.length === 0) return null;

  const headingId = `tour-stops-${tour.key}`;
  const isCollection = tour.kind === "collection";
  const List = isCollection ? "ul" : "ol";
  const itemNoun = isCollection ? "grave" : "stop";
  const itemLabel = records.length === 1 ? itemNoun : `${itemNoun}s`;

  return (
    <aside className="tour-stops-panel" aria-labelledby={headingId}>
      <header className="tour-stops-panel__header">
        <h2 id={headingId}>{tour.name}</h2>
        <div className="tour-stops-panel__actions">
          <span>{records.length.toLocaleString()} {itemLabel}</span>
          {onExit ? (
            <button
              type="button"
              className="text-button"
              aria-label="Back to Search Tours"
              onClick={onExit}
            >
              Back
            </button>
          ) : null}
        </div>
      </header>
      <List className="tour-stops-panel__list">
        {records.map((record, index) => {
          const selected = String(record.id) === String(selectedRecord?.id);
          const location = formatRecordLocation(record) || "Location not recorded";
          return (
            <li key={record.id}>
              <button
                ref={selected ? selectedPlaceRef : undefined}
                type="button"
                className={`tour-stop${isCollection ? " tour-stop--collection" : ""}`}
                aria-current={selected ? "location" : undefined}
                onClick={() => onSelect(record)}
              >
                {!isCollection ? (
                  <span className="tour-stop__number" aria-hidden="true">{index + 1}</span>
                ) : null}
                <span className="tour-stop__copy">
                  <strong>{record.displayName}</strong>
                  <span className="tour-stop__summary">{record.extraTitle || location}</span>
                  {record.extraTitle ? <span className="tour-stop__location">{location}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </List>
    </aside>
  );
}
