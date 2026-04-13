import fs from 'fs/promises';
import path from 'path';
import * as turf from '@turf/turf';

import { TOUR_DEFINITIONS } from '../src/lib/tourDefinitions.js';
import { buildTourBrowseResult, buildBurialBrowseResult, formatBrowseResultName, buildBrowseSecondaryText } from '../src/lib/browseResults.js';
import { normalizeName } from '../src/lib/burialSearch.js';
import { buildTourLookup } from '../src/lib/tourMetadata.js';

const __dirname = new URL('.', import.meta.url).pathname;

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

  console.log('Loading Geo_Burials.json...');
  const rawBurials = await fs.readFile(path.join(__dirname, '../src/data/Geo_Burials.json'), 'utf8');
  const burialsData = JSON.parse(rawBurials);
  const burialFeatures = burialsData.features || [];
  console.log(`Loaded ${burialFeatures.length} burial features.`);

  const getTourName = (option = {}) => {
      // Mocked out simpler version since TOURS isn't loaded here but we don't strictly need it for matching
      return cleanValue(option.tourName || option.title || option.tourKey || '');
  };

  const matches = {};
  let matchCount = 0;

  console.log('Matching burials to tours...');
  for (let i = 0; i < burialFeatures.length; i++) {
    const feature = burialFeatures[i];
    const burialRecord = buildBurialBrowseResult(feature, { getTourName });
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
  const searchBurials = burialFeatures.map((feature) => {
    const props = feature.properties;
    const match = matches[buildBurialBrowseResult(feature, { getTourName }).id];

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
      tk: match ? match.tourKey : '',
      c: feature.geometry?.coordinates || null
    };
  });

  const searchOutputPath = path.join(__dirname, '../public/data/Search_Burials.json');
  try {
    const publicDataDir = path.join(__dirname, '../public/data');
    await fs.mkdir(publicDataDir, { recursive: true });
  } catch (err) {}
  await fs.writeFile(searchOutputPath, JSON.stringify(searchBurials));
  console.log(`Wrote minified search index to ${searchOutputPath}`);
  
  // Let's also precalculate constants like BBOX and Buffers
  console.log('Loading BOUNDARY_POLYGON for static boundary calculations...');
  const boundaryModule = await import('../src/data/ARC_Boundary.json');
  const BOUNDARY_POLYGON = boundaryModule.default?.features?.[0] || boundaryModule.features?.[0];
  
  const BOUNDARY_BBOX = turf.bbox(BOUNDARY_POLYGON);
  const LOCATION_BUFFER_BOUNDARY = turf.buffer(BOUNDARY_POLYGON, 8, { units: 'kilometers' });

  const constantsPath = path.join(__dirname, '../src/lib/constants.js');
  const constantsContent = `// Auto-generated by scripts/precalculate-metadata.js
export const BOUNDARY_BBOX = ${JSON.stringify(BOUNDARY_BBOX)};
export const LOCATION_BUFFER_BOUNDARY = ${JSON.stringify(LOCATION_BUFFER_BOUNDARY)};
`;
  await fs.writeFile(constantsPath, constantsContent);
  console.log(`Wrote constants to ${constantsPath}`);
}

precalculate().catch(console.error);
