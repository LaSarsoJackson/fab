import { useState } from "react";
import sections from "../../data/ARC_Sections.json";
import { getSectionBounds } from "./mapSections";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";

const sectionChoices = [...new Set(sections.features.map(({ properties }) => String(properties.Section)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).flatMap((section) => {
  const bounds = getSectionBounds(section);
  if (!bounds) return [];
  const [[south, west], [north, east]] = bounds;
  return [{ id: `section:${section}`, label: `Section ${section} (map center)`, coordinates: [(west + east) / 2, (south + north) / 2] }];
});

export default function RoutePlaces({ records, endpoint, onChoose, onCancel }) {
  const graves = records.length <= 60 ? records.filter((record) => isCoordinatePairValid(record.coordinates)).map((record) => ({ ...record, label: record.displayName })) : [];
  const choices = [...graves, ...sectionChoices];
  const [choiceId, setChoiceId] = useState(String(choices[0]?.id || ""));
  const choice = choices.find((value) => String(value.id) === choiceId);
  return <div className="map-route-places">
    <label htmlFor="route-place">Mapped place</label>
    <select id="route-place" autoFocus value={choiceId} onChange={(event) => setChoiceId(event.target.value)}>
      {choices.map((value) => <option key={value.id} value={value.id}>{value.label}</option>)}
    </select>
    <p>Section centers are approximate points, not entrances or mapped paths.</p>
    <div className="map-route-actions">
      <button type="button" className="secondary-button" disabled={!choice} onClick={() => onChoose(choice)}>Set {endpoint === "start" ? "start" : "destination"}</button>
      <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}
