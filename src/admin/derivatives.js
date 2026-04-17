import * as turf from "@turf/turf";

import { APP_PROFILE } from "../config/appProfile";
import { buildBurialBrowseResult, buildTourBrowseResult, normalizeName } from "../features/browse";
import { buildTourLookup } from "../features/tours";
import { getTourModuleDefinitions } from "./moduleRegistry";

const PRIMARY_RECORD_MODULE_ID = APP_PROFILE.moduleIds?.primaryRecord || "burials";
const BOUNDARY_MODULE_ID = APP_PROFILE.moduleIds?.boundary || "boundary";
const SEARCH_INDEX_FILE_PATH = APP_PROFILE.artifacts?.searchIndexFilePath || "public/data/Search_Burials.json";
const BOUTIQUE_MATCHES_FILE_PATH = APP_PROFILE.artifacts?.boutiqueMatchesFilePath || "src/data/TourMatches.json";
const GENERATED_CONSTANTS_FILE_PATH = APP_PROFILE.artifacts?.generatedConstantsFilePath || "src/features/map/generatedBounds.js";
const PRIMARY_RECORD_LABEL = APP_PROFILE.labels?.primaryRecordSingular || "record";

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

const buildTourBrowseResults = (serializedModulesById) => {
  const tourDefinitions = getTourModuleDefinitions();
  const records = [];

  tourDefinitions.forEach((definition) => {
    const moduleData = serializedModulesById[definition.id];
    const features = moduleData?.features || [];
    features.forEach((feature) => {
      records.push(buildTourBrowseResult(feature, {
        tourKey: definition.tourKey,
        tourName: definition.label,
      }));
    });
  });

  return records;
};

const buildTourMatchesArtifact = (burialFeatures, serializedModulesById) => {
  const loadedTourRecords = buildTourBrowseResults(serializedModulesById);
  const tourLookup = buildTourLookup(loadedTourRecords);
  const matches = {};

  burialFeatures.forEach((feature) => {
    const burialRecord = buildBurialBrowseResult(feature);
    const matchedTour = findMatchingTourRecord(burialRecord, tourLookup);

    if (matchedTour) {
      matches[burialRecord.id] = matchedTour;
    }
  });

  return matches;
};

const buildSearchBurialsArtifact = (burialFeatures, tourMatches) => (
  burialFeatures.map((feature) => {
    const props = feature.properties || {};
    const burialRecord = buildBurialBrowseResult(feature);
    const match = tourMatches[burialRecord.id];

    return {
      i: props.OBJECTID,
      f: cleanValue(props.First_Name),
      l: cleanValue(props.Last_Name),
      s: cleanValue(props.Section),
      lo: cleanValue(props.Lot),
      g: cleanValue(props.Grave),
      t: cleanValue(props.Tier),
      b: cleanValue(props.Birth),
      d: cleanValue(props.Death),
      tk: match ? match.tourKey : "",
      c: feature.geometry?.coordinates || null,
      n: burialRecord.fullNameNormalized,
      sl: burialRecord.searchableLabelLower,
      nv: burialRecord.nameVariantsNormalized,
    };
  })
);

const buildConstantsArtifact = (boundaryFeatureCollection) => {
  const boundaryFeature = boundaryFeatureCollection?.features?.[0] || null;
  if (!boundaryFeature) {
    throw new Error("Boundary feature collection is required to regenerate constants.");
  }

  const boundaryBbox = turf.bbox(boundaryFeature);
  const bufferedBoundary = turf.buffer(boundaryFeature, 8, { units: "kilometers" });

  return `// Auto-generated by the static admin studio
export const BOUNDARY_BBOX = ${JSON.stringify(boundaryBbox)};
export const LOCATION_BUFFER_BOUNDARY = ${JSON.stringify(bufferedBoundary)};
`;
};

export const buildGeneratedArtifacts = (serializedModulesById) => {
  const burialFeatureCollection = serializedModulesById[PRIMARY_RECORD_MODULE_ID];
  const boundaryFeatureCollection = serializedModulesById[BOUNDARY_MODULE_ID];

  if (!burialFeatureCollection?.features) {
    throw new Error(`${PRIMARY_RECORD_LABEL} source data is required to regenerate derived artifacts.`);
  }

  const tourMatches = buildTourMatchesArtifact(burialFeatureCollection.features, serializedModulesById);
  const searchBurials = buildSearchBurialsArtifact(burialFeatureCollection.features, tourMatches);
  const constantsSource = buildConstantsArtifact(boundaryFeatureCollection);

  return [
    {
      path: SEARCH_INDEX_FILE_PATH,
      contents: JSON.stringify(searchBurials),
    },
    {
      path: BOUTIQUE_MATCHES_FILE_PATH,
      contents: JSON.stringify(tourMatches),
    },
    {
      path: GENERATED_CONSTANTS_FILE_PATH,
      contents: constantsSource,
    },
  ];
};
