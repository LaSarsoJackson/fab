import * as turf from "@turf/turf";
import { buildBrowseSecondaryText, formatBrowseResultName } from "./browseResults";
import { normalizeName } from "./burialSearch";

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

const getPrimaryNameToken = (value = "") => normalizeName(value).split(" ").find(Boolean) || "";

const getRecordDistanceMeters = (left, right) => {
  if (!Array.isArray(left?.coordinates) || !Array.isArray(right?.coordinates)) {
    return Number.POSITIVE_INFINITY;
  }

  try {
    return turf.distance(
      turf.point(left.coordinates),
      turf.point(right.coordinates),
      { units: "meters" }
    );
  } catch (error) {
    return Number.POSITIVE_INFINITY;
  }
};

const scoreTourBurialMatch = (tourRecord, burialRecord) => {
  let score = 0;
  const tourName = cleanValue(tourRecord.fullName || tourRecord.displayName);
  const burialName = cleanValue(burialRecord.fullName || burialRecord.displayName);
  const tourNormalized = normalizeName(tourName);
  const burialNormalized = normalizeName(burialName);

  if (tourNormalized && burialNormalized) {
    if (tourNormalized === burialNormalized) {
      score += 10;
    }

    const tourTokens = tourNormalized.split(" ").filter(Boolean);
    const burialTokens = burialNormalized.split(" ").filter(Boolean);
    const sharedTokens = tourTokens.filter((token) => burialTokens.includes(token));

    score += sharedTokens.length * 1.5;

    const tourLast = tourTokens[tourTokens.length - 1];
    const burialLast = burialTokens[burialTokens.length - 1];
    if (tourLast && burialLast && tourLast === burialLast) {
      score += 4;
    }

    const tourFirst = getPrimaryNameToken(tourNormalized);
    const burialFirst = getPrimaryNameToken(burialNormalized);
    if (tourFirst && burialFirst && tourFirst === burialFirst) {
      score += 3;
    }
  }

  if (
    cleanValue(tourRecord.Grave) &&
    cleanValue(burialRecord.Grave) &&
    String(tourRecord.Grave) === String(burialRecord.Grave)
  ) {
    score += 2;
  }

  if (
    cleanValue(tourRecord.Tier) &&
    cleanValue(burialRecord.Tier) &&
    String(tourRecord.Tier) === String(burialRecord.Tier)
  ) {
    score += 1;
  }

  const distance = getRecordDistanceMeters(tourRecord, burialRecord);
  if (distance <= 4) {
    score += 6;
  } else if (distance <= 12) {
    score += 4;
  } else if (distance <= 25) {
    score += 2;
  } else if (distance <= 50) {
    score += 1;
  }

  return score;
};

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

const findMatchingTourRecord = (burialRecord, tourLookup) => {
  if (!burialRecord || burialRecord.source !== "burial") return null;

  const candidates = tourLookup?.bySectionLot?.get(buildSectionLotKey(burialRecord)) || [];
  if (!candidates.length) return null;

  let bestCandidate = null;
  let bestScore = -Infinity;

  candidates.forEach((candidate) => {
    const score = scoreTourBurialMatch(candidate, burialRecord);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestScore >= 7 ? bestCandidate : null;
};

export const harmonizeBurialBrowseResult = (burialRecord, tourLookup) => {
  const matchedTour = findMatchingTourRecord(burialRecord, tourLookup);
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
    Tour_Bio: burialRecord.Tour_Bio || matchedTour.Tour_Bio,
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
