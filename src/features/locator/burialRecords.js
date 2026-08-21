import {
  cleanRecordValue as clean,
  formatRecordLocation,
  formatRecordSecondaryText,
  normalizeRecordName,
} from "../fab/recordValues";

export const buildBurialRecord = (feature) => {
  const properties = feature.properties || feature;
  const firstName = clean(properties.First_Name);
  const lastName = clean(properties.Last_Name);
  const displayName = clean(properties.Full_Name) || `${firstName} ${lastName}`.trim() || "Unknown burial";
  const section = clean(properties.Section);
  const lot = clean(properties.Lot);
  const grave = clean(properties.Grave);
  const record = {
    ...properties,
    id: `burial:${[properties.OBJECTID || displayName, section, lot, grave].map(clean).filter(Boolean).join(":")}`,
    source: "burial",
    displayName,
    label: displayName,
    fullName: displayName,
    First_Name: firstName,
    Last_Name: lastName,
    Section: section,
    Lot: lot,
    Tier: clean(properties.Tier),
    Grave: grave,
    Birth: clean(properties.Birth),
    Death: clean(properties.Death),
    coordinates: feature.geometry?.coordinates || properties.coordinates || null,
  };
  const secondaryText = formatRecordSecondaryText(record);
  const searchableLabel = [displayName, secondaryText].filter(Boolean).join(" • ");

  return {
    ...record,
    fullNameNormalized: normalizeRecordName(displayName),
    nameVariantsNormalized: Array.from(new Set([
      normalizeRecordName(displayName),
      normalizeRecordName(`${lastName} ${firstName}`),
      normalizeRecordName(searchableLabel),
    ].filter(Boolean))),
    secondaryText,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLocaleLowerCase(),
  };
};

export const inflateBurialRow = (row = {}) => {
  const firstName = clean(row.f);
  const lastName = clean(row.l);
  const displayName = `${firstName} ${lastName}`.trim() || "Unknown burial";

  return {
    id: clean(row.i),
    source: "burial",
    displayName,
    firstName,
    lastName,
    section: clean(row.s),
    lot: clean(row.lo),
    grave: clean(row.g),
    tier: clean(row.t),
    birth: clean(row.b),
    death: clean(row.d),
    tourKey: clean(row.tk),
    tourName: clean(row.tn),
    portraitImageName: clean(row.p),
    biographyLink: clean(row.u),
    extraTitle: clean(row.x),
    coordinates: Array.isArray(row.c) ? row.c.map(Number) : null,
  };
};

export const recordsToFeatureCollection = (records = []) => ({
  type: "FeatureCollection",
  features: records
    .filter((record) => (
      Array.isArray(record?.coordinates) &&
      Number.isFinite(record.coordinates[0]) &&
      Number.isFinite(record.coordinates[1])
    ))
    .map((record) => ({
      type: "Feature",
      id: record.id,
      properties: {
        id: record.id,
        name: record.displayName,
        source: record.source || "burial",
        tourKey: record.tourKey || "",
      },
      geometry: {
        type: "Point",
        coordinates: record.coordinates,
      },
    })),
});

export { formatRecordLocation };
