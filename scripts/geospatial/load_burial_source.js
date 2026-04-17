import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { APP_PROFILE } from "../../src/config/appProfile.js";
import {
  getOptimizationArtifactsByRole,
  getPreferredBuildSourceArtifact,
} from "../../src/features/map/engine/backend.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const GEOPARQUET_READER_PATH = path.join(
  REPO_ROOT,
  "scripts",
  "migrations",
  "geoparquet",
  "read_geoparquet.py"
);
const GEOSPATIAL_PYTHON_RESOLVER_PATH = path.join(
  REPO_ROOT,
  "scripts",
  "geospatial",
  "resolve_geospatial_python.sh"
);
const PYTHON_GEOJSON_BUFFER_BYTES = 512 * 1024 * 1024;
const GEOSPATIAL_PYTHON_REQUIREMENTS = "import geopandas, pyarrow, shapely";

const resolveBooleanFlag = (value, fallback = true) => {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return fallback;
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
};

const toAbsolutePath = (relativeOrAbsolutePath = "") => (
  path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(REPO_ROOT, relativeOrAbsolutePath)
);

export const getBurialGeoJsonPath = () => (
  toAbsolutePath(
    APP_PROFILE.dataModules.find((definition) => definition.id === APP_PROFILE.moduleIds.primaryRecord)?.sourcePath ||
      "src/data/Geo_Burials.json"
  )
);

export const getBurialGeoParquetCandidates = () => {
  const preferredBuildArtifact = getPreferredBuildSourceArtifact(APP_PROFILE, {
    sourceModuleId: APP_PROFILE.moduleIds.primaryRecord,
  });
  const configuredPaths = [
    preferredBuildArtifact?.format === "geoparquet" ? preferredBuildArtifact.filePath : "",
    ...getOptimizationArtifactsByRole(APP_PROFILE, "columnar-canonical")
      .filter((artifact) => artifact.sourceModuleId === APP_PROFILE.moduleIds.primaryRecord)
      .filter((artifact) => artifact.format === "geoparquet")
      .map((artifact) => artifact.filePath),
  ].filter(Boolean);

  const defaultPaths = [
    "src/data/Geo_Burials.parquet",
    "public/data/geo_burials.parquet",
  ];

  return Array.from(new Set([...configuredPaths, ...defaultPaths])).map(toAbsolutePath);
};

const loadGeoJsonFeatureCollection = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const resolveWorkingGeospatialPython = async () => {
  const configuredPython = process.env.FAB_GEOSPATIAL_PYTHON;
  const virtualEnvPython = process.env.VIRTUAL_ENV
    ? path.join(process.env.VIRTUAL_ENV, "bin", "python")
    : "";
  const candidatePythons = [
    configuredPython,
    virtualEnvPython,
    "/opt/anaconda3/bin/python",
    "/opt/homebrew/bin/python3.13",
    "/opt/homebrew/bin/python3.14",
    "python3",
    "python",
  ].filter(Boolean);

  for (const candidate of candidatePythons) {
    try {
      await execFileAsync(candidate, ["-c", GEOSPATIAL_PYTHON_REQUIREMENTS]);
      return candidate;
    } catch (_error) {
      // Try the next candidate.
    }
  }

  try {
    const { stdout } = await execFileAsync("bash", [GEOSPATIAL_PYTHON_RESOLVER_PATH]);
    const resolvedPython = stdout.trim();
    if (resolvedPython) {
      return resolvedPython;
    }
  } catch (_error) {
    // Fall through to the explicit error below.
  }

  throw new Error(
    "No Python interpreter with geopandas, pyarrow, and shapely was found. Set FAB_GEOSPATIAL_PYTHON or create a geospatial virtualenv."
  );
};

const loadGeoParquetFeatureCollection = async (filePath) => {
  const geospatialPython = await resolveWorkingGeospatialPython();
  const { stdout } = await execFileAsync(
    geospatialPython,
    [GEOPARQUET_READER_PATH, filePath],
    { maxBuffer: PYTHON_GEOJSON_BUFFER_BYTES }
  );
  return JSON.parse(stdout);
};

export async function loadBurialFeatureCollection(options = {}) {
  const preferGeoParquet = resolveBooleanFlag(
    options.preferGeoParquet ?? process.env.FAB_PREFER_GEOPARQUET,
    true
  );

  if (preferGeoParquet) {
    for (const candidatePath of getBurialGeoParquetCandidates()) {
      if (!(await fileExists(candidatePath))) {
        continue;
      }

      try {
        const featureCollection = await loadGeoParquetFeatureCollection(candidatePath);
        return {
          featureCollection,
          source: {
            format: "geoparquet",
            filePath: candidatePath,
            loader: "python-geopandas",
          },
        };
      } catch (error) {
        console.warn(
          `[geospatial] Falling back to GeoJSON because GeoParquet load failed for ${candidatePath}: ${error.message}`
        );
      }
    }
  }

  const geoJsonPath = getBurialGeoJsonPath();
  return {
    featureCollection: await loadGeoJsonFeatureCollection(geoJsonPath),
    source: {
      format: "geojson",
      filePath: geoJsonPath,
      loader: "json",
    },
  };
}
