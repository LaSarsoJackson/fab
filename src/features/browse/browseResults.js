import { normalizeName, smartSearch } from "./burialSearch";
import { APP_PROFILE, getAppFeature } from "../../config/appProfile";
import { FEATURE_FLAGS } from "../../shared/runtime/runtimeEnv";

export const MIN_BROWSE_QUERY_LENGTH = 2;
const VALID_BROWSE_SOURCES = new Set(["all", "section", "tour"]);
const PRIMARY_RECORD_FIELDS = APP_PROFILE.fieldAliases?.primaryRecord || {};
const TOUR_RECORD_FIELDS = APP_PROFILE.fieldAliases?.boutiqueTourRecord || {};
const TOUR_FEATURE = getAppFeature("tours");
const UNKNOWN_PRIMARY_RECORD_LABEL = APP_PROFILE.labels?.unknownPrimaryRecord || "Unknown burial";
const DEFAULT_TOUR_LOCATION_LABEL = APP_PROFILE.labels?.defaultTourLocationLabel || "Tour location";

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const readCandidateValue = (record = {}, keys = []) => {
  for (const key of keys) {
    const value = record?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }

  return "";
};

const readRecordValue = (record, fieldAliases, fieldKey) => (
  cleanValue(readCandidateValue(record, fieldAliases[fieldKey] || []))
);

// Section browse pivots between lot and tier filters, so keep the helper that
// populates those lookup buckets close to the section-index builder.
const addToMapArray = (map, key, item) => {
  if (!key) return;

  let items = map.get(key);
  if (!items) {
    items = [];
    map.set(key, items);
  }

  items.push(item);
};

const buildHeadstoneLabel = (section, lot, row, position) => (
  [
    section ? `Section ${section}` : "",
    lot ? `Lot ${lot}` : "",
    row ? `Row ${row}` : "",
    position ? `Position ${position}` : "",
  ]
    .filter(Boolean)
    .join(" • ") || DEFAULT_TOUR_LOCATION_LABEL
);

export const formatBrowseResultName = (record = {}) => {
  const explicitLabel = cleanValue(record.displayName || record.fullName || record.label);
  if (explicitLabel) return explicitLabel;

  const fullName = `${record.First_Name || ""} ${record.Last_Name || ""}`.trim();
  return fullName || UNKNOWN_PRIMARY_RECORD_LABEL;
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
  const firstName = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "firstName");
  const lastName = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "lastName");
  const fullName = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "fullName") || `${firstName} ${lastName}`.trim();
  const displayName = fullName || UNKNOWN_PRIMARY_RECORD_LABEL;
  const section = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "section");
  const lot = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "lot");
  const tier = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "tier");
  const grave = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "grave");
  const tourName = getTourName
    ? cleanValue(getTourName(properties))
    : readRecordValue(properties, PRIMARY_RECORD_FIELDS, "tourName");
  const tourKey = readRecordValue(properties, PRIMARY_RECORD_FIELDS, "tourKey");
  const objectId = readCandidateValue(properties, PRIMARY_RECORD_FIELDS.objectId || ["OBJECTID"]);
  const coordinates = feature.geometry?.coordinates || properties.coordinates || null;
  const baseRecord = {
    ...properties,
    id: buildBrowseId("burial", [objectId || displayName, section, lot, grave]),
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
    Birth: readRecordValue(properties, PRIMARY_RECORD_FIELDS, "birth"),
    Death: readRecordValue(properties, PRIMARY_RECORD_FIELDS, "death"),
    coordinates,
    title: tourKey,
    tourKey,
    tourName,
    extraTitle: readRecordValue(properties, PRIMARY_RECORD_FIELDS, "extraTitle"),
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
  const firstName = readRecordValue(properties, TOUR_RECORD_FIELDS, "firstName");
  const lastName = readRecordValue(properties, TOUR_RECORD_FIELDS, "lastName");
  const fullName = readRecordValue(properties, TOUR_RECORD_FIELDS, "fullName") || `${firstName} ${lastName}`.trim();
  const section = readRecordValue(properties, TOUR_RECORD_FIELDS, "section");
  const lot = readRecordValue(properties, TOUR_RECORD_FIELDS, "lot");
  const row = readRecordValue(properties, TOUR_RECORD_FIELDS, "row");
  const position = readRecordValue(properties, TOUR_RECORD_FIELDS, "position");
  const grave = readRecordValue(properties, TOUR_RECORD_FIELDS, "grave");
  const displayName = fullName || buildHeadstoneLabel(section, lot, row, position);
  const coordinates = feature.geometry?.coordinates || properties.coordinates || null;
  const activeTourFeature = FEATURE_FLAGS.fabTours ? TOUR_FEATURE : null;
  const tourFeatureMetadata = typeof activeTourFeature?.enrichRecord === "function"
    ? activeTourFeature.enrichRecord({
        ...properties,
        Full_Name: fullName || properties.Full_Name,
        displayName,
        First_Name: firstName,
        Last_Name: lastName,
        Section: section,
        Lot: lot,
        Row: row,
        Position: position,
      })
    : {};
  const resolvedTourKey = cleanValue(
    tourKey ||
    readCandidateValue(properties, TOUR_RECORD_FIELDS.tourKey || ["title", "Tour_ID"])
  );
  const resolvedTourName = cleanValue(
    tourName ||
    readCandidateValue(properties, TOUR_RECORD_FIELDS.tourName || ["Tour_Name"])
  );
  const objectId = readCandidateValue(properties, TOUR_RECORD_FIELDS.objectId || ["OBJECTID"]);
  const baseRecord = {
    ...properties,
    id: buildBrowseId("tour", [
      resolvedTourKey || resolvedTourName,
      objectId || displayName,
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
    Tier: readRecordValue(properties, TOUR_RECORD_FIELDS, "tier"),
    Grave: grave,
    Birth: readRecordValue(properties, TOUR_RECORD_FIELDS, "birth"),
    Death: readRecordValue(properties, TOUR_RECORD_FIELDS, "death"),
    row,
    position,
    coordinates,
    title: resolvedTourKey,
    tourKey: resolvedTourKey,
    tourName: resolvedTourName,
    extraTitle: readRecordValue(properties, TOUR_RECORD_FIELDS, "extraTitle"),
    portraitImageName: cleanValue(tourFeatureMetadata.portraitImageName || properties.portraitImageName),
    biographyLink: cleanValue(tourFeatureMetadata.biographyLink || properties.biographyLink || properties.Tour_Bio),
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

/**
 * Browsing a section can touch hundreds of records repeatedly as the user
 * flips between lot/tier filters, so build a small in-memory index once.
 */
export const buildBurialSectionIndex = (records = []) => {
  const sectionIndex = new Map();

  records.forEach((record) => {
    const section = cleanValue(record.Section);
    if (!section) return;

    let sectionEntry = sectionIndex.get(section);
    if (!sectionEntry) {
      sectionEntry = {
        records: [],
        lots: new Map(),
        tiers: new Map(),
      };
      sectionIndex.set(section, sectionEntry);
    }

    sectionEntry.records.push(record);
    addToMapArray(sectionEntry.lots, cleanValue(record.Lot), record);
    addToMapArray(sectionEntry.tiers, cleanValue(record.Tier), record);
  });

  return sectionIndex;
};

export const filterBurialRecordsBySection = (
  records,
  {
    sectionFilter = "",
    lotTierFilter = "",
    filterType = "lot",
  } = {},
  {
    sectionIndex = null,
  } = {}
) => {
  const section = cleanValue(sectionFilter);
  if (!section) return [];

  const detailFilter = cleanValue(lotTierFilter);

  if (sectionIndex) {
    const sectionEntry = sectionIndex.get(section);
    if (!sectionEntry) return [];
    if (!detailFilter) return sectionEntry.records;

    const detailIndex = filterType === "tier"
      ? sectionEntry.tiers
      : sectionEntry.lots;

    return detailIndex.get(detailFilter) || [];
  }

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
  sectionIndex = null,
  searchIndex = null,
  getTourName,
  sectionFilter = "",
  lotTierFilter = "",
  filterType = "lot",
  selectedTour = "",
  tourResults = [],
} = {}) => {
  // Keep source selection centralized so the sidebar, search, and map all use
  // the same rules when section and tour context overlap.
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
    }, {
      sectionIndex,
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
