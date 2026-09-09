import { useEffect, useRef } from "react";
import { formatRecordLocation } from "../locator/burialRecords";

export default function MapRecordPicker({ records, onSelect, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (records.length) closeRef.current?.focus();
  }, [records]);
  if (!records.length) return null;

  return (
    <aside className="map-point-picker" aria-label="Burials at this point">
      <header className="tour-stops-panel__header">
        <h2>Burials at this point</h2>
        <button ref={closeRef} className="text-button" type="button" onClick={onClose}>Close</button>
      </header>
      <ul className="tour-stops-panel__list">
        {records.map((record) => (
          <li key={record.id}>
            <button type="button" className="tour-stop tour-stop--collection" onClick={() => onSelect(record)}>
              <span className="tour-stop__copy">
                <strong>{record.displayName}</strong>
                <span>{formatRecordLocation(record)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
