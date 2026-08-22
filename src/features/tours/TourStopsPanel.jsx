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

  return (
    <aside className="tour-stops-panel" aria-labelledby={headingId}>
      <header className="tour-stops-panel__header">
        <div>
          <p>{isCollection ? "Collection" : "Tour places"}</p>
          <h2 id={headingId}>{tour.name}</h2>
        </div>
        <div className="tour-stops-panel__actions">
          <span aria-label={`${records.length} places`}>{records.length}</span>
          {onExit ? (
            <button type="button" className="text-button" onClick={onExit}>All tours</button>
          ) : null}
        </div>
      </header>
      <ol className="tour-stops-panel__list">
        {records.map((record, index) => {
          const selected = String(record.id) === String(selectedRecord?.id);
          const location = formatRecordLocation(record) || "Mapped place";
          return (
            <li key={record.id}>
              <button
                ref={selected ? selectedPlaceRef : undefined}
                type="button"
                className="tour-stop"
                aria-current={selected ? "location" : undefined}
                onClick={() => onSelect(record)}
              >
                <span className="tour-stop__number" aria-hidden="true">{index + 1}</span>
                <span className="tour-stop__copy">
                  <strong>{record.displayName}</strong>
                  <span className="tour-stop__summary">{record.extraTitle || location}</span>
                  {record.extraTitle ? <span className="tour-stop__location">{location}</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
