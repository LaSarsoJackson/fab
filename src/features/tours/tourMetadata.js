
import { buildBrowseSecondaryText, formatBrowseResultName } from "../browse/browseResults";
import { normalizeName } from "../browse/burialSearch";

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const buildSectionLotKey = (record = {}) => {
  const section = cleanValue(record.Section ?? record.section);
  const lot = cleanValue(record.Lot ?? record.lot);
  if (!section || !lot) return "";
  return `${section}::${lot}`;
};

/**
 * Search results start from the burial dataset, so keep a reverse lookup that
 * lets those records inherit richer tour-only metadata after the fact.
 */
export const buildTourLookup = (records = []) => {
  const bySectionLot = new Map();

  records.forEach((record) => {
    const key = buildSectionLotKey(record);
    if (!key) return;

    if (!bySectionLot.has(key)) {
      bySectionLot.set(key, []);
    }

    bySectionLot.get(key).push(record);
  });

  return { bySectionLot };
};

/**
 * Preserve the burial record as the canonical search result, but pull in the
 * extra biography/image/title fields that only exist on matching tour stops.
 */
export const harmonizeBurialBrowseResult = (burialRecord, tourMatches = {}) => {
  const matchedTour = tourMatches[burialRecord.id] || null;
  if (!matchedTour) return burialRecord;

  const displayName = cleanValue(
    burialRecord.displayName ||
    burialRecord.fullName ||
    formatBrowseResultName(burialRecord)
  );
  const fullName = cleanValue(
    burialRecord.fullName ||
    matchedTour.fullName ||
    displayName
  );

  const mergedRecord = {
    ...burialRecord,
    matchedTourId: matchedTour.id,
    matchedTourName: matchedTour.tourName || burialRecord.tourName,
    title: matchedTour.tourKey || burialRecord.title,
    tourKey: matchedTour.tourKey || burialRecord.tourKey,
    tourName: matchedTour.tourName || burialRecord.tourName,
    extraTitle: burialRecord.extraTitle || matchedTour.extraTitle,
    Titles: burialRecord.Titles || matchedTour.Titles,
    Highest_Ra: burialRecord.Highest_Ra || matchedTour.Highest_Ra,
    Initial_Te: burialRecord.Initial_Te || matchedTour.Initial_Te,
    Subsequent: burialRecord.Subsequent || matchedTour.Subsequent,
    Unit: burialRecord.Unit || matchedTour.Unit,
    Service_Re: burialRecord.Service_Re || matchedTour.Service_Re,
    Headstone_: burialRecord.Headstone_ || matchedTour.Headstone_,
    Bio_Portra: burialRecord.Bio_Portra || matchedTour.Bio_Portra,
    Bio_Portri: burialRecord.Bio_Portri || matchedTour.Bio_Portri,
    Bio_portra: burialRecord.Bio_portra || matchedTour.Bio_portra,
    portraitImageName: burialRecord.portraitImageName || matchedTour.portraitImageName,
    Tour_Bio: burialRecord.Tour_Bio || matchedTour.Tour_Bio,
    biographyLink: burialRecord.biographyLink || matchedTour.biographyLink,
    displayAlias: burialRecord.displayAlias || (
      cleanValue(matchedTour.displayName) && cleanValue(matchedTour.displayName) !== displayName
        ? cleanValue(matchedTour.displayName)
        : ""
    ),
    displayName,
    label: displayName,
    fullName,
    fullNameNormalized: normalizeName(fullName || displayName),
  };

  const secondaryText = buildBrowseSecondaryText(mergedRecord);
  const searchableLabel = [displayName, secondaryText, cleanValue(mergedRecord.tourName)]
    .filter(Boolean)
    .join(" • ");
  const nameVariantsNormalized = Array.from(
    new Set([
      ...(burialRecord.nameVariantsNormalized || []),
      ...(matchedTour.nameVariantsNormalized || []),
      normalizeName(displayName),
      normalizeName(fullName),
      normalizeName(matchedTour.displayName),
      normalizeName(matchedTour.fullName),
    ].filter(Boolean))
  );

  return {
    ...mergedRecord,
    nameVariantsNormalized,
    secondaryText,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLowerCase(),
  };
};
