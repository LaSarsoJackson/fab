import { normalizeName, smartSearch } from "./burialSearch";

export const MIN_BROWSE_QUERY_LENGTH = 2;
const VALID_BROWSE_SOURCES = new Set(["all", "section", "tour"]);

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const buildHeadstoneLabel = (section, lot, row, position) => (
  [
    section ? `Section ${section}` : "",
    lot ? `Lot ${lot}` : "",
    row ? `Row ${row}` : "",
    position ? `Position ${position}` : "",
  ]
    .filter(Boolean)
    .join(" • ") || "Tour location"
);

export const formatBrowseResultName = (record = {}) => {
  const explicitLabel = cleanValue(record.displayName || record.fullName || record.label);
  if (explicitLabel) return explicitLabel;

  const fullName = `${record.First_Name || ""} ${record.Last_Name || ""}`.trim();
  return fullName || "Unknown burial";
};

export const buildLocationParts = (record = {}) => {
  const section = cleanValue(record.Section ?? record.section);
  const lot = cleanValue(record.Lot ?? record.lot);
  const tier = cleanValue(record.Tier ?? record.tier);
  const grave = cleanValue(record.Grave ?? record.grave);
  const row = cleanValue(record.row);
  const position = cleanValue(record.position);
  const parts = [];

  if (section) parts.push(`Section ${section}`);
  if (lot) parts.push(`Lot ${lot}`);
  if (tier) parts.push(`Tier ${tier}`);
  if (grave) parts.push(`Grave ${grave}`);
  if (row) parts.push(`Row ${row}`);
  if (position) parts.push(`Position ${position}`);

  return parts;
};

export const buildLocationSummary = (record = {}) => buildLocationParts(record).join(", ");

export const buildBrowseSecondaryText = (record = {}) => {
  const locationSummary = buildLocationParts(record).slice(0, 2).join(", ");
  const birth = cleanValue(record.Birth ?? record.birth);
  const death = cleanValue(record.Death ?? record.death);
  const extraTitle = cleanValue(record.extraTitle);
  const parts = [];

  if (locationSummary) parts.push(locationSummary);
  if (birth) parts.push(`Born ${birth}`);
  if (death) parts.push(`Died ${death}`);
  if (!birth && !death && extraTitle) parts.push(extraTitle);

  return parts.join(" • ");
};

const buildSearchableLabel = (displayName, secondaryText, tourName) => (
  [displayName, secondaryText, tourName].filter(Boolean).join(" • ")
);

const buildBrowseId = (prefix, parts) => (
  `${prefix}:${parts.map((part) => cleanValue(part)).filter(Boolean).join(":")}`
);

const buildNameVariantsNormalized = (...values) => (
  Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((value) => normalizeName(value))
        .filter(Boolean)
    )
  )
);

export const buildBurialBrowseResult = (feature, { getTourName } = {}) => {
  const properties = feature.properties || feature;
  const firstName = cleanValue(properties.First_Name);
  const lastName = cleanValue(properties.Last_Name);
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || "Unknown burial";
  const section = cleanValue(properties.Section);
  const lot = cleanValue(properties.Lot);
  const tier = cleanValue(properties.Tier);
  const grave = cleanValue(properties.Grave);
  const tourName = getTourName ? cleanValue(getTourName(properties)) : cleanValue(properties.tourName);
  const tourKey = cleanValue(properties.title || properties.tourKey);
  const coordinates = feature.geometry?.coordinates || properties.coordinates || null;
  const baseRecord = {
    ...properties,
    id: buildBrowseId("burial", [properties.OBJECTID || displayName, section, lot, grave]),
    source: "burial",
    displayName,
    label: displayName,
    fullName,
    fullNameNormalized: properties.fullNameNormalized || normalizeName(fullName || displayName),
    First_Name: firstName,
    Last_Name: lastName,
    Section: section,
    Lot: lot,
    Tier: tier,
    Grave: grave,
    Birth: cleanValue(properties.Birth),
    Death: cleanValue(properties.Death),
    coordinates,
    title: tourKey,
    tourKey,
    tourName,
  };
  const secondaryText = buildBrowseSecondaryText(baseRecord);
  const searchableLabel = buildSearchableLabel(displayName, secondaryText, tourName);
  const nameVariantsNormalized = properties.nameVariantsNormalized || buildNameVariantsNormalized(
    fullName,
    `${lastName} ${firstName}`.trim(),
    searchableLabel,
    `${firstName} ${lastName} Section ${section} Lot ${lot}`.trim()
  );

  return {
    ...baseRecord,
    nameVariantsNormalized,
    secondaryText,
    searchableLabel,
    searchableLabelLower: properties.searchableLabelLower || searchableLabel.toLowerCase(),
  };
};

export const buildTourBrowseResult = (feature, { tourKey, tourName } = {}) => {
  const properties = feature.properties || {};
  const firstName = cleanValue(properties.First_Name || properties.First_name);
  const lastName = cleanValue(properties.Last_Name);
  const fullName = cleanValue(
    properties.Full_Name || `${firstName} ${lastName}`.trim()
  );
  const section = cleanValue(properties.Section || properties.ARC_Secton);
  const lot = cleanValue(properties.Lot || properties.ARC_Lot);
  const row = cleanValue(properties.Row);
  const position = cleanValue(properties.Position);
  const grave = cleanValue(properties.Grave);
  const displayName = fullName || buildHeadstoneLabel(section, lot, row, position);
  const coordinates = feature.geometry?.coordinates || properties.coordinates || null;
  const baseRecord = {
    ...properties,
    id: buildBrowseId("tour", [
      cleanValue(tourKey || properties.title || properties.Tour_Name || properties.Tour_ID),
      properties.OBJECTID || displayName,
      section,
      lot,
      row,
      position,
    ]),
    source: "tour",
    displayName,
    label: displayName,
    fullName: fullName || displayName,
    fullNameNormalized: normalizeName(fullName || displayName),
    First_Name: firstName,
    Last_Name: lastName,
    Section: section,
    Lot: lot,
    Tier: cleanValue(properties.Tier),
    Grave: grave,
    Birth: cleanValue(properties.Birth),
    Death: cleanValue(properties.Death),
    row,
    position,
    coordinates,
    title: cleanValue(tourKey || properties.title),
    tourKey: cleanValue(tourKey || properties.title),
    tourName: cleanValue(tourName || properties.Tour_Name),
    extraTitle: cleanValue(properties.Titles),
  };
  const secondaryText = buildBrowseSecondaryText(baseRecord);
  const searchableLabel = buildSearchableLabel(displayName, secondaryText, baseRecord.tourName);
  const nameVariantsNormalized = buildNameVariantsNormalized(
    baseRecord.fullName,
    `${lastName} ${firstName}`.trim(),
    searchableLabel,
    `${displayName} ${buildLocationSummary(baseRecord)}`.trim()
  );

  return {
    ...baseRecord,
    nameVariantsNormalized,
    secondaryText,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLowerCase(),
  };
};

export const getBrowseSourceMode = ({ browseSource = "", sectionFilter = "", selectedTour = "" } = {}) => {
  if (VALID_BROWSE_SOURCES.has(cleanValue(browseSource))) {
    return cleanValue(browseSource);
  }

  if (cleanValue(selectedTour)) return "tour";
  if (cleanValue(sectionFilter)) return "section";
  return "all";
};

export const filterBurialRecordsBySection = (
  records,
  {
    sectionFilter = "",
    lotTierFilter = "",
    filterType = "lot",
  } = {}
) => {
  const section = cleanValue(sectionFilter);
  if (!section) return [];

  const detailFilter = cleanValue(lotTierFilter);

  return records.filter((record) => {
    if (cleanValue(record.Section) !== section) {
      return false;
    }

    if (!detailFilter) return true;

    if (filterType === "tier") {
      return cleanValue(record.Tier) === detailFilter;
    }

    return cleanValue(record.Lot) === detailFilter;
  });
};

export const buildBrowseResults = ({
  browseSource = "",
  query = "",
  burialRecords = [],
  searchIndex = null,
  getTourName,
  sectionFilter = "",
  lotTierFilter = "",
  filterType = "lot",
  selectedTour = "",
  tourResults = [],
} = {}) => {
  const activeSource = getBrowseSourceMode({ browseSource, sectionFilter, selectedTour });
  const trimmedQuery = cleanValue(query);
  const hasQuery = trimmedQuery.length >= MIN_BROWSE_QUERY_LENGTH;
  const recordTourName = (record) => cleanValue(record.tourName || record.title || "");

  if (activeSource === "tour") {
    if (!cleanValue(selectedTour)) {
      return {
        activeSource,
        results: [],
      };
    }

    if (!hasQuery) {
      return {
        activeSource,
        results: tourResults,
      };
    }

    return {
      activeSource,
      results: smartSearch(tourResults, trimmedQuery, { getTourName: recordTourName }),
    };
  }

  if (activeSource === "section") {
    if (!cleanValue(sectionFilter)) {
      return {
        activeSource,
        results: [],
      };
    }

    const sectionResults = filterBurialRecordsBySection(burialRecords, {
      sectionFilter,
      lotTierFilter,
      filterType,
    });

    if (!hasQuery) {
      return {
        activeSource,
        results: sectionResults,
      };
    }

    return {
      activeSource,
      results: smartSearch(sectionResults, trimmedQuery, { getTourName }),
    };
  }

  if (!hasQuery) {
    return {
      activeSource,
      results: [],
    };
  }

  return {
    activeSource,
    results: smartSearch(burialRecords, trimmedQuery, {
      index: searchIndex,
      getTourName,
    }),
  };
};
