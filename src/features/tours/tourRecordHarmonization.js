import distance from "@turf/distance";
import { point } from "@turf/helpers";
import { buildBrowseSecondaryText, formatBrowseResultName } from "../browse/browseResults";
import { normalizeName } from "../browse/burialSearch";
import { cleanRecordValue, resolveRecordDates } from "../map/mapRecordPresentation";

/**
 * Reconciles burial-source records and tour-source records without changing
 * either source file. The map/sidebar can then work with one browse shape while
 * still showing richer tour metadata where a confident match exists.
 */
const MATCH_ACCEPTANCE_SCORE = 7;

const buildSectionLotKey = (record = {}) => {
  const section = cleanRecordValue(record.Section ?? record.section);
  const lot = cleanRecordValue(record.Lot ?? record.lot);
  if (!section || !lot) return "";
  return `${section}::${lot}`;
};

const buildLookupBySectionLot = (records = []) => {
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

const appendNameVariantInput = (variants, input) => {
  if (Array.isArray(input)) {
    input.forEach((item) => appendNameVariantInput(variants, item));
    return;
  }

  variants.push(input);
};

const buildNameVariantsNormalized = (...inputs) => {
  const variants = [];
  inputs.forEach((input) => appendNameVariantInput(variants, input));

  return Array.from(
    new Set(
      variants
        .map((value) => normalizeName(value))
        .filter(Boolean)
    )
  );
};

const buildSearchableLabel = (displayName, secondaryText, tourName) => (
  [displayName, secondaryText, cleanRecordValue(tourName)].filter(Boolean).join(" • ")
);

const rebuildHarmonizedBrowseResult = (
  record,
  {
    displayName = "",
    fullName = "",
    nameVariantInputs = [],
  } = {}
) => {
  const nextDisplayName = cleanRecordValue(
    displayName ||
    record.displayName ||
    record.fullName ||
    formatBrowseResultName(record)
  );
  const nextFullName = cleanRecordValue(fullName || record.fullName || nextDisplayName);
  const baseRecord = {
    ...record,
    displayName: nextDisplayName,
    label: nextDisplayName,
    fullName: nextFullName,
    fullNameNormalized: normalizeName(nextFullName || nextDisplayName),
  };
  const secondaryText = buildBrowseSecondaryText(baseRecord);
  const searchableLabel = buildSearchableLabel(
    nextDisplayName,
    secondaryText,
    baseRecord.tourName
  );

  return {
    ...baseRecord,
    nameVariantsNormalized: buildNameVariantsNormalized(
      nameVariantInputs,
      nextDisplayName,
      nextFullName
    ),
    secondaryText,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLowerCase(),
  };
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
  } catch (_error) {
    return Number.POSITIVE_INFINITY;
  }
};

/**
 * Keep the tour/burial heuristic in one place so the runtime and the admin
 * artifact builder score records the same way.
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

const findBestSectionLotMatch = (
  record,
  lookup,
  {
    isMatchableRecord = () => true,
    scoreCandidate = () => Number.NEGATIVE_INFINITY,
  } = {}
) => {
  if (!isMatchableRecord(record)) {
    return null;
  }

  const candidates = lookup?.bySectionLot?.get(buildSectionLotKey(record)) || [];
  if (!candidates.length) {
    return null;
  }

  let bestCandidate = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestScore >= MATCH_ACCEPTANCE_SCORE ? bestCandidate : null;
};

/**
 * Search results start from the burial dataset, so keep a reverse lookup that
 * lets those records inherit richer tour-only metadata after the fact.
 */
export const buildTourLookup = (records = []) => buildLookupBySectionLot(records);

/**
 * Build a lookup keyed by section/lot because that pairing is the most stable
 * join key shared across the burial and tour datasets.
 */
export const buildBurialLookup = (records = []) => buildLookupBySectionLot(records);

export const findMatchingTourRecord = (burialRecord, tourLookup) => (
  findBestSectionLotMatch(burialRecord, tourLookup, {
    isMatchableRecord: (record) => record?.source === "burial",
    scoreCandidate: (candidate) => scoreTourBurialMatch(candidate, burialRecord),
  })
);

export const findMatchingBurialRecord = (tourRecord, burialLookup) => (
  findBestSectionLotMatch(tourRecord, burialLookup, {
    isMatchableRecord: (record) => record?.source === "tour",
    scoreCandidate: (candidate) => scoreTourBurialMatch(tourRecord, candidate),
  })
);

/**
 * Preserve the burial record as the canonical search result, but pull in the
 * extra biography/image/title fields that only exist on matching tour stops.
 */
export const harmonizeBurialBrowseResult = (burialRecord, tourMatches = {}) => {
  const matchedTour = tourMatches[burialRecord.id] || null;
  if (!matchedTour) return burialRecord;

  const displayName = cleanRecordValue(
    burialRecord.displayName ||
    burialRecord.fullName ||
    formatBrowseResultName(burialRecord)
  );
  const fullName = cleanRecordValue(
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
      cleanRecordValue(matchedTour.displayName) &&
      cleanRecordValue(matchedTour.displayName) !== displayName
        ? cleanRecordValue(matchedTour.displayName)
        : ""
    ),
  };

  return rebuildHarmonizedBrowseResult(mergedRecord, {
    displayName,
    fullName,
    nameVariantInputs: [
      burialRecord.nameVariantsNormalized,
      matchedTour.nameVariantsNormalized,
      matchedTour.displayName,
      matchedTour.fullName,
    ],
  });
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
    Birth: resolvedDates.birth,
    Death: resolvedDates.death,
  };

  return rebuildHarmonizedBrowseResult(mergedRecord, {
    displayName,
    fullName,
    nameVariantInputs: [
      tourRecord.nameVariantsNormalized,
      matchedBurial?.nameVariantsNormalized,
      rawDisplayName,
      tourRecord.fullName,
    ],
  });
};
