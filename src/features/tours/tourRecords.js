import tourBiographyAliases from "../../data/TourBiographyAliases.json";
import {
  cleanRecordValue,
  formatRecordLocation,
  formatRecordSecondaryText,
  normalizeRecordName,
  readFirstRecordValue,
} from "../fab/recordValues";
import {
  resolveBiographyReferenceFromAliases,
  resolvePortraitImageName,
} from "./tourDerivedData";

const read = (record, keys) => cleanRecordValue(readFirstRecordValue(record, keys));

const buildTourStopName = ({ section, lot, row, position }) => (
  [
    section ? `Section ${section}` : "",
    lot ? `Lot ${lot}` : "",
    row ? `Row ${row}` : "",
    position ? `Position ${position}` : "",
  ].filter(Boolean).join(" • ") || "Tour stop"
);

const buildNameVariants = (...values) => Array.from(new Set(
  values.map(normalizeRecordName).filter(Boolean)
));

export const buildTourRecord = (feature, { tourKey = "", tourName = "" } = {}) => {
  const properties = feature.properties || {};
  const firstName = read(properties, ["First_Name", "First_name"]);
  const lastName = read(properties, ["Last_Name"]);
  const fullName = read(properties, ["Full_Name"]) || `${firstName} ${lastName}`.trim();
  const section = read(properties, ["Section", "ARC_Secton"]);
  const lot = read(properties, ["Lot", "ARC_Lot"]);
  const row = read(properties, ["Row"]);
  const position = read(properties, ["Position"]);
  const displayName = fullName || buildTourStopName({ section, lot, row, position });
  const resolvedTourKey = cleanRecordValue(tourKey || readFirstRecordValue(properties, ["tourKey", "title", "Tour_ID"]));
  const resolvedTourName = cleanRecordValue(tourName || readFirstRecordValue(properties, ["tourName", "Tour_Name"]));
  const portraitImageName = resolvePortraitImageName(properties);
  const biographyLink = resolveBiographyReferenceFromAliases(
    { ...properties, displayName, fullName, portraitImageName },
    tourBiographyAliases
  );
  const objectId = readFirstRecordValue(properties, ["OBJECTID", "id"]);
  const record = {
    ...properties,
    id: `tour:${[
      resolvedTourKey || resolvedTourName,
      objectId || displayName,
      section,
      lot,
      row,
      position,
    ].map(cleanRecordValue).filter(Boolean).join(":")}`,
    source: "tour",
    displayName,
    label: displayName,
    fullName: fullName || displayName,
    First_Name: firstName,
    Last_Name: lastName,
    Section: section,
    Lot: lot,
    Tier: read(properties, ["Tier"]),
    Grave: read(properties, ["Grave"]),
    Birth: read(properties, ["Birth"]),
    Death: read(properties, ["Death"]),
    row,
    position,
    coordinates: feature.geometry?.coordinates || properties.coordinates || null,
    title: resolvedTourKey,
    tourKey: resolvedTourKey,
    tourName: resolvedTourName,
    extraTitle: read(properties, ["Titles", "extraTitle"]),
    portraitImageName,
    biographyLink,
  };
  const secondaryText = formatRecordSecondaryText(record);
  const searchableLabel = [displayName, secondaryText, resolvedTourName].filter(Boolean).join(" • ");

  return {
    ...record,
    fullNameNormalized: normalizeRecordName(record.fullName),
    nameVariantsNormalized: buildNameVariants(
      record.fullName,
      `${lastName} ${firstName}`,
      searchableLabel,
      `${displayName} ${formatRecordLocation(record, ", ")}`
    ),
    secondaryText,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLocaleLowerCase(),
  };
};
