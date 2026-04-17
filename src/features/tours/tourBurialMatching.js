import distance from "@turf/distance";
import { point } from "@turf/helpers";
import { buildBrowseSecondaryText, formatBrowseResultName } from "../browse/browseResults";
import { normalizeName } from "../browse/burialSearch";
import { cleanRecordValue, resolveRecordDates } from "../map/mapRecordPresentation";

const MATCH_ACCEPTANCE_SCORE = 7;

const buildSectionLotKey = (record = {}) => {
  const section = cleanRecordValue(record.Section ?? record.section);
  const lot = cleanRecordValue(record.Lot ?? record.lot);
  if (!section || !lot) return "";
  return `${section}::${lot}`;
};

const getPrimaryNameToken = (value = "") => (
  normalizeName(value).split(" ").find(Boolean) || ""
);

const getRecordDistanceMeters = (left, right) => {
  if (!Array.isArray(left?.coordinates) || !Array.isArray(right?.coordinates)) {
    return Number.POSITIVE_INFINITY;
  }

  try {
    return distance(
      point(left.coordinates),
      point(right.coordinates),
      { units: "meters" }
    );
  } catch (error) {
    return Number.POSITIVE_INFINITY;
  }
};

/**
 * Score candidate burial records for a tour stop. The inputs are noisy, so the
 * heuristic intentionally blends exact name matches, token overlap, grave/tier
 * agreement, and geospatial proximity.
 */
const scoreTourBurialMatch = (tourRecord, burialRecord) => {
  let score = 0;
  const tourName = cleanRecordValue(tourRecord.fullName || tourRecord.displayName);
  const burialName = cleanRecordValue(burialRecord.fullName || burialRecord.displayName);
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
    cleanRecordValue(tourRecord.Grave) &&
    cleanRecordValue(burialRecord.Grave) &&
    String(tourRecord.Grave) === String(burialRecord.Grave)
  ) {
    score += 2;
  }

  if (
    cleanRecordValue(tourRecord.Tier) &&
    cleanRecordValue(burialRecord.Tier) &&
    String(tourRecord.Tier) === String(burialRecord.Tier)
  ) {
    score += 1;
  }

  const distanceMeters = getRecordDistanceMeters(tourRecord, burialRecord);
  if (distanceMeters <= 4) {
    score += 6;
  } else if (distanceMeters <= 12) {
    score += 4;
  } else if (distanceMeters <= 25) {
    score += 2;
  } else if (distanceMeters <= 50) {
    score += 1;
  }

  return score;
};

/**
 * Build a lookup keyed by section/lot because that pairing is the most stable
 * join key shared across the burial and tour datasets.
 */
export const buildBurialLookup = (records = []) => {
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

const findMatchingBurialRecord = (tourRecord, burialLookup) => {
  if (!tourRecord || tourRecord.source !== "tour") return null;

  const candidates = burialLookup?.bySectionLot?.get(buildSectionLotKey(tourRecord)) || [];
  if (!candidates.length) return null;

  let bestCandidate = null;
  let bestScore = -Infinity;

  candidates.forEach((candidate) => {
    const score = scoreTourBurialMatch(tourRecord, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestScore >= MATCH_ACCEPTANCE_SCORE ? bestCandidate : null;
};

/**
 * Normalize tour records into the same shape the rest of the browse UI expects.
 * This keeps selection, popup rendering, and deep-link handling consistent
 * regardless of whether the source record started as a tour stop or burial row.
 */
export const harmonizeTourBrowseResult = (tourRecord, burialLookup) => {
  const matchedBurial = findMatchingBurialRecord(tourRecord, burialLookup);
  const rawDisplayName = cleanRecordValue(
    tourRecord.displayName ||
    tourRecord.fullName ||
    formatBrowseResultName(tourRecord)
  );
  const displayName = matchedBurial ? formatBrowseResultName(matchedBurial) : rawDisplayName;
  const fullName = cleanRecordValue(
    matchedBurial?.fullName ||
    matchedBurial?.displayName ||
    tourRecord.fullName ||
    displayName
  );
  const resolvedDates = resolveRecordDates({
    Birth: matchedBurial?.Birth || tourRecord.Birth,
    Death: matchedBurial?.Death || tourRecord.Death,
  });
  const mergedRecord = {
    ...tourRecord,
    ...(matchedBurial
      ? {
          matchedBurialId: matchedBurial.id,
          matchedBurialName: displayName,
          displayAlias: rawDisplayName !== displayName ? rawDisplayName : "",
          First_Name: matchedBurial.First_Name || tourRecord.First_Name,
          Last_Name: matchedBurial.Last_Name || tourRecord.Last_Name,
          Section: matchedBurial.Section || tourRecord.Section,
          Lot: matchedBurial.Lot || tourRecord.Lot,
          Tier: matchedBurial.Tier ?? tourRecord.Tier,
          Grave: matchedBurial.Grave ?? tourRecord.Grave,
          row: tourRecord.row || matchedBurial.row,
          position: tourRecord.position || matchedBurial.position,
        }
      : {}),
    displayName,
    label: displayName,
    fullName,
    fullNameNormalized: normalizeName(fullName || displayName),
    Birth: resolvedDates.birth,
    Death: resolvedDates.death,
  };

  const secondaryText = buildBrowseSecondaryText(mergedRecord);
  const searchableLabel = [
    displayName,
    secondaryText,
    cleanRecordValue(mergedRecord.tourName),
  ].filter(Boolean).join(" • ");
  const nameVariantsNormalized = Array.from(
    new Set([
      ...(tourRecord.nameVariantsNormalized || []),
      ...(matchedBurial?.nameVariantsNormalized || []),
      normalizeName(tourRecord.displayName),
      normalizeName(tourRecord.fullName),
      normalizeName(displayName),
      normalizeName(fullName),
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
