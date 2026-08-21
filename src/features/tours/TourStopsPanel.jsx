import { formatRecordLocation } from "../locator/burialRecords";

export default function TourStopsPanel({ tour, records = [], selectedRecord, onSelect }) {
  if (!tour || records.length === 0) return null;

  const headingId = `tour-stops-${tour.key}`;

  return (
    <aside className="tour-stops-panel" aria-labelledby={headingId}>
      <header className="tour-stops-panel__header">
        <div>
          <p>Tour stops</p>
          <h2 id={headingId}>{tour.name}</h2>
        </div>
        <span>{records.length}</span>
      </header>
      <ol className="tour-stops-panel__list">
        {records.map((record, index) => {
          const selected = String(record.id) === String(selectedRecord?.id);
          const location = formatRecordLocation(record) || "Mapped tour stop";
          return (
            <li key={record.id}>
              <button
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
