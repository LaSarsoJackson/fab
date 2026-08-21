import {
  cleanRecordValue,
  normalizeRecordName,
} from "../fab/recordValues";

/**
 * Reconciles burial-source records and tour-source records without changing
 * either source file. The map and record card can then use one shape while
 * still showing richer tour metadata where a confident match exists.
 */
const MATCH_ACCEPTANCE_SCORE = 7;
const MATCHING_LIFE_DATE_SCORE = 8;
const TOUR_SITE_NAME_PATTERN = /\b(?:family plot|mausoleum|monument|memorial|family vault)\b/;
const GENERIC_SITE_NAME_TOKENS = new Set([
  "family",
  "mausoleum",
  "memorial",
  "monument",
  "plot",
  "vault",
]);
const PERSON_NAME_PREFIXES = new Set([
  "capt",
  "col",
  "dr",
  "gen",
  "hon",
  "maj",
  "president",
  "prof",
  "rev",
]);
const PERSON_NAME_SUFFIXES = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
  "2nd",
  "3rd",
]);
const DATE_MONTHS = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
});

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

const getPrimaryNameToken = (value = "") => (
  normalizeRecordName(value).split(" ").find(Boolean) || ""
);

const buildIdentityNameTokens = (value = "", { includeInitials = false } = {}) => (
  normalizeRecordName(value)
    .split(" ")
    .filter((token) => (
      (includeInitials || token.length > 1) &&
      !PERSON_NAME_PREFIXES.has(token) &&
      !PERSON_NAME_SUFFIXES.has(token)
    ))
);

const buildPersonNameParts = (record = {}) => {
  const fullName = cleanRecordValue(record.fullName || record.displayName);
  const fullNameTokens = buildIdentityNameTokens(fullName);
  const firstNameTokens = buildIdentityNameTokens(record.First_Name, {
    includeInitials: true,
  });
  const lastNameTokens = buildIdentityNameTokens(record.Last_Name);
  const surnameTokens = lastNameTokens.length > 0
    ? lastNameTokens
    : fullNameTokens.slice(-1);

  return {
    firstName: firstNameTokens[0] || fullNameTokens[0] || "",
    firstInitial: (firstNameTokens[0] || fullNameTokens[0] || "").slice(0, 1),
    firstNameIsInitial: (firstNameTokens[0] || fullNameTokens[0] || "").length === 1,
    surname: surnameTokens.join(""),
    surnameTail: surnameTokens[surnameTokens.length - 1] || "",
    fullNameNormalized: normalizeRecordName(fullName),
    fullNameTokens,
    isSurnameOnly: (
      firstNameTokens.length === 0 &&
      lastNameTokens.length > 0 &&
      fullNameTokens.length === lastNameTokens.length
    ),
  };
};

/**
 * Legacy names contain a small number of one-character transcription variants
 * (Bleeker/Bleecker, Meyers/Myers, Theophils/Theophilus). Treat only those
 * bounded differences as equivalent; broader fuzzy matching would recreate
 * the family-member collisions this matcher is meant to prevent.
 */
const areNamePartsEquivalent = (leftValue, rightValue) => {
  const left = cleanRecordValue(leftValue);
  const right = cleanRecordValue(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 4) return false;
  if (Math.abs(left.length - right.length) > 1) return false;

  if (left.length === right.length) {
    let differences = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences += 1;
      if (differences > 1) return false;
    }
    return true;
  }

  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let shorterIndex = 0;
  let longerIndex = 0;
  let skippedCharacters = 0;

  while (shorterIndex < shorter.length && longerIndex < longer.length) {
    if (shorter[shorterIndex] === longer[longerIndex]) {
      shorterIndex += 1;
      longerIndex += 1;
      continue;
    }

    skippedCharacters += 1;
    longerIndex += 1;
    if (skippedCharacters > 1) return false;
  }

  return true;
};

const haveCompatibleSurnames = (left, right) => (
  areNamePartsEquivalent(left.surname, right.surname) ||
  areNamePartsEquivalent(left.surnameTail, right.surnameTail)
);

const parseComparableRecordDate = (value) => {
  const normalized = cleanRecordValue(value);
  if (!normalized || /^(unknown|none)$/i.test(normalized)) return null;

  const isoMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const usMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return {
      year: Number(usMatch[3]),
      month: Number(usMatch[1]),
      day: Number(usMatch[2]),
    };
  }

  const namedMonthMatch = normalized.match(
    /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i
  );
  if (namedMonthMatch) {
    const month = DATE_MONTHS[namedMonthMatch[1].toLowerCase()];
    if (month) {
      return {
        year: Number(namedMonthMatch[3]),
        month,
        day: Number(namedMonthMatch[2]),
      };
    }
  }

  const yearMatch = normalized.match(/^(?:c\.?\s*)?(\d{4})$/i);
  if (yearMatch) {
    return {
      year: Number(yearMatch[1]),
      month: null,
      day: null,
    };
  }

  return null;
};

const areKnownDatesConflicting = (leftValue, rightValue) => {
  const left = parseComparableRecordDate(leftValue);
  const right = parseComparableRecordDate(rightValue);
  if (!left || !right) return false;
  if (left.year !== right.year) return true;
  if (left.month !== null && right.month !== null && left.month !== right.month) return true;
  return left.day !== null && right.day !== null && left.day !== right.day;
};

const doKnownDatesMatch = (leftValue, rightValue) => {
  const left = parseComparableRecordDate(leftValue);
  const right = parseComparableRecordDate(rightValue);
  return Boolean(left && right && !areKnownDatesConflicting(leftValue, rightValue));
};

const areComparableDatesExact = (left, right) => Boolean(
  left &&
  right &&
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day
);

const differByOneDayDigit = (leftDay, rightDay) => {
  if (leftDay === null || rightDay === null) return false;

  const leftDigits = String(leftDay).padStart(2, "0");
  const rightDigits = String(rightDay).padStart(2, "0");
  return [...leftDigits].filter((digit, index) => digit !== rightDigits[index]).length === 1;
};

/**
 * A few independently maintained tour/burial rows have an otherwise exact
 * identity and plot but a bounded transcription discrepancy. Keep this
 * narrower than general date fuzziness: either the year is off by one with
 * month/day intact, or one day digit differs with year/month intact.
 */
const isBoundedDateTranscriptionDiscrepancy = (left, right) => {
  if (
    !left ||
    !right ||
    left.month === null ||
    right.month === null ||
    left.day === null ||
    right.day === null
  ) {
    return false;
  }

  if (
    Math.abs(left.year - right.year) === 1 &&
    left.month === right.month &&
    left.day === right.day
  ) {
    return true;
  }

  return (
    left.year === right.year &&
    left.month === right.month &&
    differByOneDayDigit(left.day, right.day)
  );
};

/**
 * Reports any literal conflict between known tour and burial life dates.
 * Missing dates remain neutral because many legacy records legitimately omit
 * one or both fields. Match scoring separately handles a narrowly corroborated
 * transcription discrepancy while keeping the raw conflict observable here.
 */
export const hasKnownLifeDateConflict = (tourRecord = {}, burialRecord = {}) => (
  areKnownDatesConflicting(tourRecord.Birth, burialRecord.Birth) ||
  areKnownDatesConflicting(tourRecord.Death, burialRecord.Death)
);

const getMatchingLifeDateCount = (tourRecord = {}, burialRecord = {}) => (
  Number(doKnownDatesMatch(tourRecord.Birth, burialRecord.Birth)) +
  Number(doKnownDatesMatch(tourRecord.Death, burialRecord.Death))
);

const countSharedIdentityTokens = (left, right) => {
  const rightTokens = new Set(right.fullNameTokens);
  return left.fullNameTokens.filter((token) => rightTokens.has(token)).length;
};

const hasTourSiteIdentityEvidence = (tourName, tourNameParts, burialNameParts) => {
  if (!TOUR_SITE_NAME_PATTERN.test(normalizeRecordName(tourName))) return false;

  const burialTokens = new Set(burialNameParts.fullNameTokens);
  return tourNameParts.fullNameTokens.some((token) => (
    !GENERIC_SITE_NAME_TOKENS.has(token) && burialTokens.has(token)
  ));
};

const hasExactSourcePersonIdentity = (tourRecord, burialRecord) => {
  const tourFirstName = normalizeRecordName(tourRecord.First_Name);
  const burialFirstName = normalizeRecordName(burialRecord.First_Name);
  const tourLastName = normalizeRecordName(tourRecord.Last_Name);
  const burialLastName = normalizeRecordName(burialRecord.Last_Name);

  return Boolean(
    tourFirstName &&
    burialFirstName &&
    tourLastName &&
    burialLastName &&
    tourFirstName === burialFirstName &&
    tourLastName === burialLastName
  );
};

const hasCorroboratedDateTranscriptionDiscrepancy = (tourRecord, burialRecord) => {
  const tourSectionLot = buildSectionLotKey(tourRecord);
  if (
    !tourSectionLot ||
    tourSectionLot !== buildSectionLotKey(burialRecord) ||
    !hasExactSourcePersonIdentity(tourRecord, burialRecord)
  ) {
    return false;
  }

  const comparableDatePairs = [
    [tourRecord.Birth, burialRecord.Birth],
    [tourRecord.Death, burialRecord.Death],
  ]
    .map(([tourValue, burialValue]) => [
      parseComparableRecordDate(tourValue),
      parseComparableRecordDate(burialValue),
    ])
    .filter(([tourDate, burialDate]) => tourDate && burialDate);

  if (comparableDatePairs.length === 0) return false;

  let foundBoundedDiscrepancy = false;
  for (const [tourDate, burialDate] of comparableDatePairs) {
    if (areComparableDatesExact(tourDate, burialDate)) continue;
    if (!isBoundedDateTranscriptionDiscrepancy(tourDate, burialDate)) return false;
    foundBoundedDiscrepancy = true;
  }

  return foundBoundedDiscrepancy;
};

const hasDisqualifyingKnownLifeDateConflict = (tourRecord, burialRecord) => (
  hasKnownLifeDateConflict(tourRecord, burialRecord) &&
  !hasCorroboratedDateTranscriptionDiscrepancy(tourRecord, burialRecord)
);

/**
 * Location narrows the candidate pool, but it is not identity evidence: a
 * section/lot can contain dozens of relatives. Person stops therefore need a
 * compatible first name and surname, or a matching known life date plus some
 * name evidence. Explicit plot/mausoleum stops use their shared family/site
 * name instead, and surname-only burial markers remain valid destinations.
 */
const hasTourBurialIdentityEvidence = (tourRecord, burialRecord) => {
  const tourName = cleanRecordValue(tourRecord.fullName || tourRecord.displayName);
  const tourNameParts = buildPersonNameParts(tourRecord);
  const burialNameParts = buildPersonNameParts(burialRecord);

  if (hasTourSiteIdentityEvidence(tourName, tourNameParts, burialNameParts)) {
    return true;
  }

  if (
    tourNameParts.fullNameNormalized &&
    tourNameParts.fullNameNormalized === burialNameParts.fullNameNormalized
  ) {
    return true;
  }

  const firstNamesMatch = areNamePartsEquivalent(
    tourNameParts.firstName,
    burialNameParts.firstName
  );
  const surnamesMatch = haveCompatibleSurnames(tourNameParts, burialNameParts);
  const sharedNameTokens = countSharedIdentityTokens(tourNameParts, burialNameParts);
  const firstInitialsMatch = Boolean(
    tourNameParts.firstInitial &&
    tourNameParts.firstInitial === burialNameParts.firstInitial
  );

  if (firstNamesMatch && surnamesMatch) return true;
  if (
    firstInitialsMatch &&
    (tourNameParts.firstNameIsInitial || burialNameParts.firstNameIsInitial) &&
    surnamesMatch &&
    sharedNameTokens >= 2
  ) return true;
  if (burialNameParts.isSurnameOnly && surnamesMatch) return true;

  const matchingLifeDates = getMatchingLifeDateCount(tourRecord, burialRecord);
  return matchingLifeDates > 0 && (
    sharedNameTokens > 0 || firstNamesMatch || surnamesMatch
  );
};

const isSpecificPlotValue = (value) => {
  const normalized = cleanRecordValue(value);
  return Boolean(normalized && normalized !== "0");
};

const getRecordDistanceMeters = (left, right) => {
  if (!Array.isArray(left?.coordinates) || !Array.isArray(right?.coordinates)) {
    return Number.POSITIVE_INFINITY;
  }

  const [leftLng, leftLat] = left.coordinates.map(Number);
  const [rightLng, rightLat] = right.coordinates.map(Number);
  if (![leftLng, leftLat, rightLng, rightLat].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(rightLat - leftLat);
  const deltaLng = toRadians(rightLng - leftLng);
  const startLat = toRadians(leftLat);
  const endLat = toRadians(rightLat);
  const haversine = (
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2
  );
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

/**
 * Keep the tour/burial heuristic in one place so the runtime and the admin
 * artifact builder score records the same way.
 */
const scoreTourBurialMatch = (tourRecord, burialRecord) => {
  if (hasDisqualifyingKnownLifeDateConflict(tourRecord, burialRecord)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (!hasTourBurialIdentityEvidence(tourRecord, burialRecord)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  const tourName = cleanRecordValue(tourRecord.fullName || tourRecord.displayName);
  const burialName = cleanRecordValue(burialRecord.fullName || burialRecord.displayName);
  const tourNormalized = normalizeRecordName(tourName);
  const burialNormalized = normalizeRecordName(burialName);

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
    isSpecificPlotValue(tourRecord.Grave) &&
    isSpecificPlotValue(burialRecord.Grave) &&
    String(tourRecord.Grave) === String(burialRecord.Grave)
  ) {
    score += 2;
  }

  if (
    isSpecificPlotValue(tourRecord.Tier) &&
    isSpecificPlotValue(burialRecord.Tier) &&
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

  score += getMatchingLifeDateCount(tourRecord, burialRecord) * MATCHING_LIFE_DATE_SCORE;

  return score;
};

const buildStableRecordKey = (record = {}) => cleanRecordValue(
  record.id ||
  record.OBJECTID ||
  record.objectId ||
  [record.fullName, record.Section, record.Lot, record.Grave].join("::")
);

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

  // Only candidates sharing a section/lot reach the scoring stage. Identity
  // eligibility and the acceptance threshold protect against family collisions.
  let bestCandidate = null;
  let bestCandidateKey = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  candidates.forEach((candidate) => {
    const score = scoreCandidate(candidate);
    const candidateKey = buildStableRecordKey(candidate);
    if (
      score > bestScore ||
      (score === bestScore && candidateKey && (!bestCandidateKey || candidateKey < bestCandidateKey))
    ) {
      bestScore = score;
      bestCandidate = candidate;
      bestCandidateKey = candidateKey;
    }
  });

  return bestScore >= MATCH_ACCEPTANCE_SCORE ? bestCandidate : null;
};

/**
 * Build a lookup keyed by section/lot because that pairing is the most stable
 * join key shared across the burial and tour datasets.
 */
export const buildBurialLookup = (records = []) => buildLookupBySectionLot(records);

export const findMatchingBurialRecord = (tourRecord, burialLookup) => (
  findBestSectionLotMatch(tourRecord, burialLookup, {
    isMatchableRecord: (record) => record?.source === "tour",
    scoreCandidate: (candidate) => scoreTourBurialMatch(tourRecord, candidate),
  })
);

/**
 * Build the generated burial-id -> tour-stop map in the natural direction:
 * each tour stop chooses at most one best burial. If multiple stops choose the
 * same burial, the stronger score wins and a stable tour id breaks exact ties.
 */
export const buildTourBurialMatches = (
  tourRecords = [],
  burialRecords = []
) => {
  const burialLookup = buildBurialLookup(burialRecords);
  const rankedMatchesByBurialId = new Map();

  tourRecords.forEach((tourRecord) => {
    const burialRecord = findMatchingBurialRecord(tourRecord, burialLookup);
    if (!burialRecord) return;

    const score = scoreTourBurialMatch(tourRecord, burialRecord);
    const burialId = cleanRecordValue(burialRecord.id);
    const tourId = buildStableRecordKey(tourRecord);
    if (!burialId || !Number.isFinite(score)) return;

    const current = rankedMatchesByBurialId.get(burialId);
    if (
      !current ||
      score > current.score ||
      (score === current.score && tourId && tourId < current.tourId)
    ) {
      rankedMatchesByBurialId.set(burialId, {
        score,
        tourId,
        tourRecord,
      });
    }
  });

  return Object.fromEntries(
    [...rankedMatchesByBurialId.entries()].map(([burialId, match]) => (
      [burialId, match.tourRecord]
    ))
  );
};
