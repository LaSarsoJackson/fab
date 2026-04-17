import fs from "fs/promises";

import { APP_PROFILE } from "../../src/config/appProfile.js";
import { getPreferredBuildSourceArtifact } from "../../src/features/map/engine/backend.js";
import {
  getBurialGeoJsonPath,
  getBurialGeoParquetCandidates,
  loadBurialFeatureCollection,
} from "./load_burial_source.js";

const CANONICAL_PROPERTY_KEYS = [
  "OBJECTID",
  "First_Name",
  "Last_Name",
  "Section",
  "Lot",
  "Tier",
  "Grave",
  "Birth",
  "Death",
];

const COORDINATE_PRECISION = 9;

const normalizeScalar = (value) => {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value;
};

const normalizeCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return coordinates;
  }

  return coordinates.map((entry) => {
    if (Array.isArray(entry)) {
      return normalizeCoordinates(entry);
    }
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return Number(entry.toFixed(COORDINATE_PRECISION));
    }
    return entry;
  });
};

const canonicalizeFeature = (feature = {}) => {
  const properties = feature.properties || {};
  const objectId = normalizeScalar(properties.OBJECTID);

  return {
    objectId: objectId == null ? null : String(objectId),
    properties: CANONICAL_PROPERTY_KEYS.reduce((result, key) => ({
      ...result,
      [key]: normalizeScalar(properties[key]),
    }), {}),
    geometry: {
      type: feature.geometry?.type || null,
      coordinates: normalizeCoordinates(feature.geometry?.coordinates ?? null),
    },
  };
};

const getCanonicalFeatureMap = (featureCollection = {}) => {
  const features = Array.isArray(featureCollection.features) ? featureCollection.features : [];
  return new Map(features.map((feature) => {
    const canonicalFeature = canonicalizeFeature(feature);
    return [canonicalFeature.objectId, canonicalFeature];
  }));
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
};

const main = async () => {
  const geoJsonPath = getBurialGeoJsonPath();
  const geoParquetCandidates = getBurialGeoParquetCandidates();
  const existingGeoParquetPath = (await Promise.all(
    geoParquetCandidates.map(async (candidatePath) => ({
      candidatePath,
      exists: await fileExists(candidatePath),
    }))
  )).find((entry) => entry.exists)?.candidatePath;

  if (!existingGeoParquetPath) {
    console.error("GeoParquet validation failed: no GeoParquet source artifact is present.");
    console.error(`Expected one of: ${geoParquetCandidates.join(", ")}`);
    process.exit(1);
  }

  const [geoJsonSource, geoParquetSource] = await Promise.all([
    loadBurialFeatureCollection({ preferGeoParquet: false }),
    loadBurialFeatureCollection({ preferGeoParquet: true }),
  ]);

  if (geoParquetSource.source.format !== "geoparquet") {
    console.error("GeoParquet validation failed: the preferred-source loader did not resolve to a GeoParquet artifact.");
    process.exit(1);
  }

  const geoJsonMap = getCanonicalFeatureMap(geoJsonSource.featureCollection);
  const geoParquetMap = getCanonicalFeatureMap(geoParquetSource.featureCollection);

  if (geoJsonMap.size !== geoParquetMap.size) {
    console.error(
      `GeoParquet validation failed: feature count mismatch (${geoJsonMap.size} GeoJSON vs ${geoParquetMap.size} GeoParquet).`
    );
    process.exit(1);
  }

  for (const [objectId, geoJsonFeature] of geoJsonMap.entries()) {
    const geoParquetFeature = geoParquetMap.get(objectId);

    if (!geoParquetFeature) {
      console.error(`GeoParquet validation failed: missing OBJECTID ${objectId} in GeoParquet source.`);
      process.exit(1);
    }

    const left = JSON.stringify(geoJsonFeature);
    const right = JSON.stringify(geoParquetFeature);
    if (left !== right) {
      console.error(`GeoParquet validation failed: canonical mismatch for OBJECTID ${objectId}.`);
      console.error(`GeoJSON: ${left}`);
      console.error(`GeoParquet: ${right}`);
      process.exit(1);
    }
  }

  const preferredBuildArtifact = getPreferredBuildSourceArtifact(APP_PROFILE, {
    sourceModuleId: APP_PROFILE.moduleIds.primaryRecord,
  });

  console.log("GeoParquet validation passed.");
  console.log(`GeoJSON source: ${geoJsonPath}`);
  console.log(`GeoParquet source: ${existingGeoParquetPath}`);
  console.log(`Preferred build artifact: ${preferredBuildArtifact?.id || "none"} (${preferredBuildArtifact?.format || "unknown"})`);
  console.log(`Verified ${geoJsonMap.size} burial features with canonical property and geometry parity.`);
};

void main().catch((error) => {
  console.error("GeoParquet validation failed:", error);
  process.exit(1);
});
