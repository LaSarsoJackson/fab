import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bbox from "@turf/bbox";
import buffer from "@turf/buffer";
import distance from "@turf/distance";
import { point } from "@turf/helpers";

import { loadBurialFeatureCollection } from "./geospatial/load_burial_source.js";
import { buildBurialBrowseResult, buildTourBrowseResult } from "../src/features/browse/browseResults.js";
import { normalizeName } from "../src/features/browse/burialSearch.js";
import { TOUR_DEFINITIONS } from "../src/features/fab/profile.js";
import { buildTourLookup } from "../src/features/tours/tourRecordHarmonization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate the build-time artifacts that keep runtime search and popup
 * enrichment cheap: the tour match table, the minified search payload, and the
 * static boundary constants.
 */
const cleanValue = (value) => {
  if (value === null || value === undefined) return '';
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
    return distance(
      point(left.coordinates),
      point(right.coordinates),
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
    // Names carry the strongest signal, but the legacy tour files have enough
    // duplicate surnames that location and grave metadata must contribute too.
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

const findMatchingTourRecord = (burialRecord, tourLookup) => {
  if (!burialRecord || burialRecord.source !== "burial") return null;

  // Runtime tour->burial matching works in the opposite direction. The build
  // step mirrors the same heuristic so search records can be enriched up front.
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

/**
 * The build pipeline needs the normalized burial browse record for both tour
 * matching and the compact search artifact. Build it once so `build:data`
 * spends time on the matching heuristic itself instead of recomputing the same
 * browse shape in two full passes over ~97k burials.
 */
const buildNormalizedBurialEntries = (burialFeatures, { getTourName } = {}) => (
  burialFeatures.map((feature) => ({
    feature,
    properties: feature.properties || {},
    burialRecord: buildBurialBrowseResult(feature, { getTourName }),
  }))
);

async function precalculate() {
  console.log('Loading TOUR_DEFINITIONS...');
  const loadedRecords = [];
  for (const definition of TOUR_DEFINITIONS) {
    console.log(`Loading tour: ${definition.name}`);
    const module = await definition.load();
    const features = module.default?.features || module.features || [];
    const browseResults = features.map((feature) => (
      buildTourBrowseResult(feature, {
        tourKey: definition.key,
        tourName: definition.name,
      })
    ));
    loadedRecords.push(...browseResults);
  }

  console.log(`Loaded ${loadedRecords.length} tour records.`);
  const tourLookup = buildTourLookup(loadedRecords);

  console.log('Loading burial source data...');
  const { featureCollection: burialsData, source: burialSource } = await loadBurialFeatureCollection();
  const burialFeatures = burialsData.features || [];
  console.log(
    `Loaded ${burialFeatures.length} burial features from ${burialSource.format} (${burialSource.filePath}).`
  );

  const getTourName = (option = {}) => {
    // The precompute step only needs a stable label for normalized browse
    // records, not the full runtime tour registry.
    return cleanValue(option.tourName || option.title || option.tourKey || '');
  };
  const normalizedBurialEntries = buildNormalizedBurialEntries(burialFeatures, { getTourName });

  const matches = {};
  let matchCount = 0;

  console.log('Matching burials to tours...');
  for (let i = 0; i < normalizedBurialEntries.length; i++) {
    const { burialRecord } = normalizedBurialEntries[i];
    const matchedTour = findMatchingTourRecord(burialRecord, tourLookup);
    
    if (matchedTour) {
      matches[burialRecord.id] = matchedTour;
      matchCount++;
    }
    
    if (i > 0 && i % 10000 === 0) {
      console.log(`Processed ${i} burials...`);
    }
  }

  console.log(`Done matching! Found ${matchCount} matches.`);

  const outputPath = path.join(__dirname, '../src/data/TourMatches.json');
  await fs.writeFile(outputPath, JSON.stringify(matches));
  console.log(`Wrote matches to ${outputPath}`);

  console.log('Generating minified search index...');
  const searchBurials = normalizedBurialEntries.map(({ feature, properties, burialRecord }) => {
    const match = matches[burialRecord.id];

    // Runtime search downloads this compact shape, then rebuilds the full
    // browse result. Keep keys short here because this file ships to visitors.
    return {
      i: properties.OBJECTID,
      f: cleanValue(properties.First_Name),
      l: cleanValue(properties.Last_Name),
      s: cleanValue(properties.Section),
      lo: cleanValue(properties.Lot),
      g: cleanValue(properties.Grave),
      t: cleanValue(properties.Tier),
      b: cleanValue(properties.Birth),
      d: cleanValue(properties.Death),
      tk: match ? match.tourKey : '',
      c: feature.geometry?.coordinates || null,
      n: burialRecord.fullNameNormalized,
      sl: burialRecord.searchableLabelLower,
      nv: burialRecord.nameVariantsNormalized
    };
  });

  const searchOutputPath = path.join(__dirname, '../public/data/Search_Burials.json');
  const publicDataDir = path.join(__dirname, '../public/data');
  await fs.mkdir(publicDataDir, { recursive: true });
  await fs.writeFile(searchOutputPath, JSON.stringify(searchBurials));
  console.log(`Wrote minified search index to ${searchOutputPath}`);
  
  // Write static boundary helpers once so the client does not recompute them on
  // every page load.
  console.log('Loading BOUNDARY_POLYGON for static boundary calculations...');
  const boundaryModule = await import('../src/data/ARC_Boundary.json');
  const BOUNDARY_POLYGON = boundaryModule.default?.features?.[0] || boundaryModule.features?.[0];
  
  const BOUNDARY_BBOX = bbox(BOUNDARY_POLYGON);
  const LOCATION_BUFFER_BOUNDARY = buffer(BOUNDARY_POLYGON, 8, { units: 'kilometers' });

  const constantsPath = path.join(__dirname, "../src/features/map/generatedBounds.js");
  const constantsContent = `// Auto-generated by scripts/precalculate-metadata.js
export const BOUNDARY_BBOX = ${JSON.stringify(BOUNDARY_BBOX)};
export const LOCATION_BUFFER_BOUNDARY = ${JSON.stringify(LOCATION_BUFFER_BOUNDARY)};
`;
  await fs.writeFile(constantsPath, constantsContent);
  console.log(`Wrote constants to ${constantsPath}`);
}

precalculate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
