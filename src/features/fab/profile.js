import {
  createBasemapSpec,
  createOptimizationArtifactSpec,
  createOverlaySourceSpec,
} from "../map/engine/contracts";
import { BOUNDARY_BBOX, LOCATION_BUFFER_BOUNDARY } from "../map/generatedBounds";
import { FAB_TOUR_DEFINITIONS, FAB_TOUR_STYLES, enrichFabTourRecord } from "./tours";

const stripLeadingSlash = (value = "") => String(value).trim().replace(/^\/+/, "");
const stripTrailingSlash = (value = "") => String(value).trim().replace(/\/+$/, "");

const FAB_SITE_ROOT_URL = "https://www.albany.edu/arce";
const FAB_SITE_NAME = "Albany Rural Cemetery";
const FAB_ADMIN_SITE_NAME = "Albany Rural Cemetery Records Workspace";
const FAB_HOME_URL = `${FAB_SITE_ROOT_URL}/`;
const FAB_IMAGE_DIRECTORY = "images";
const FAB_NO_IMAGE_FILE_NAME = "no-image.jpg";
const FAB_BIOGRAPHY_IMAGE_HINT = "Tap the image to open the ARCE biography.";
const FAB_IOS_APP_STORE_URL = "https://apps.apple.com/us/app/albany-grave-finder/id6746413050";
const FAB_DEV_IMAGE_SERVER_ORIGIN = (process.env.REACT_APP_DEV_IMAGE_SERVER_ORIGIN || "")
  .trim()
  .replace(/\/+$/, "");

const buildFabSiteUrl = (path = "") => {
  const baseUrl = stripTrailingSlash(FAB_HOME_URL);
  const normalizedPath = stripLeadingSlash(path);

  return normalizedPath ? `${baseUrl}/${normalizedPath}` : `${baseUrl}/`;
};

const buildFabImageUrl = (fileName = "") => (
  buildFabSiteUrl(`${FAB_IMAGE_DIRECTORY}/${stripLeadingSlash(fileName)}`)
);

const FAB_NO_IMAGE_URL = buildFabImageUrl(FAB_NO_IMAGE_FILE_NAME);

const cleanFabValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeFabPageLink = (value = "") => {
  const normalized = cleanFabValue(value);
  if (!normalized || /^(none|unknown)$/i.test(normalized)) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const trimmed = normalized.replace(/^\/+/, "");
  if (/\.(?:jpe?g|png|gif|webp|svg)$/i.test(trimmed)) {
    return "";
  }

  if (/^[a-z]+:/i.test(trimmed)) {
    return trimmed;
  }

  if (/\.html?$/i.test(trimmed)) {
    return buildFabSiteUrl(trimmed);
  }

  return buildFabSiteUrl(`${trimmed}.html`);
};

const resolveFabBiographyLink = (record = {}) => (
  normalizeFabPageLink(record.biographyLink) || normalizeFabPageLink(record.Tour_Bio)
);

const resolveFabRecordImageUrl = (imageName) => {
  if (!imageName || imageName === "NONE") return FAB_NO_IMAGE_URL;

  const normalizedImageName = String(imageName).trim();
  const imageFileName = /\.[a-z0-9]+$/i.test(normalizedImageName)
    ? normalizedImageName
    : `${normalizedImageName}.jpg`;

  if (process.env.NODE_ENV === "development" && FAB_DEV_IMAGE_SERVER_ORIGIN) {
    return `${FAB_DEV_IMAGE_SERVER_ORIGIN}/src/data/images/${imageFileName}`;
  }

  return buildFabImageUrl(imageFileName);
};

const buildFabPopupRows = (record = {}, helpers = {}) => {
  const {
    buildLocationSummary = () => "",
    resolveRecordDates = () => ({ birth: "", death: "" }),
  } = helpers;
  const { birth, death } = resolveRecordDates(record);
  const title = cleanFabValue(record.Titles || record.extraTitle);
  const rank = cleanFabValue(record.Highest_Ra);
  const initialTerm = cleanFabValue(record.Initial_Te);
  const subsequentTerm = cleanFabValue(record.Subsequent);
  const unit = cleanFabValue(record.Unit);
  const location = cleanFabValue(buildLocationSummary(record));
  const headstone = cleanFabValue(record.Headstone_);
  const service = cleanFabValue(record.Service_Re);
  const headstoneLabel = headstone.toLowerCase().startsWith("headstone")
    ? headstone
    : `Headstone ${headstone}`;

  return [
    title ? { label: "Role", value: title } : null,
    rank && rank !== title ? { label: "Rank", value: rank } : null,
    initialTerm ? { label: "Initial term", value: initialTerm } : null,
    subsequentTerm ? { label: "Subsequent term", value: subsequentTerm } : null,
    unit ? { label: "Unit", value: unit } : null,
    location ? { label: "Location", value: location } : null,
    birth ? { label: "Born", value: birth } : null,
    death ? { label: "Died", value: death } : null,
    headstone ? { label: "Headstone", value: headstoneLabel } : null,
    service ? { label: "Service", value: service } : null,
  ].filter(Boolean);
};

const buildCoreDataModule = (definition) => ({
  group: "Core data",
  kind: "source",
  ...definition,
});

const CORE_DATA_MODULES = [
  buildCoreDataModule({
    id: "burials",
    label: "Burials",
    description: "Burial records used by search and map browsing.",
    fileName: "Geo_Burials.json",
    sourcePath: "src/data/Geo_Burials.json",
    load: () => import("../../data/Geo_Burials.json"),
  }),
  buildCoreDataModule({
    id: "sections",
    label: "Sections",
    description: "Cemetery section areas used for map browsing.",
    fileName: "ARC_Sections.json",
    sourcePath: "src/data/ARC_Sections.json",
    load: () => import("../../data/ARC_Sections.json"),
  }),
  buildCoreDataModule({
    id: "roads",
    label: "Roads",
    description: "Cemetery road paths used for map orientation and directions.",
    fileName: "ARC_Roads.json",
    sourcePath: "src/data/ARC_Roads.json",
    load: () => import("../../data/ARC_Roads.json"),
  }),
  buildCoreDataModule({
    id: "boundary",
    label: "Boundary",
    description: "Cemetery boundary used for map limits and location checks.",
    fileName: "ARC_Boundary.json",
    sourcePath: "src/data/ARC_Boundary.json",
    load: () => import("../../data/ARC_Boundary.json"),
  }),
];

const TOUR_MODULES = FAB_TOUR_DEFINITIONS.map((definition) => ({
  id: `tour:${definition.key}`,
  label: definition.name,
  description: "Tour stops shown in browsing and map details.",
  group: "Tours",
  kind: "tour",
  tourKey: definition.key,
  fileName: definition.fileName,
  sourcePath: definition.sourcePath,
  load: definition.load,
}));

const MAP_BASEMAPS = [
  {
    id: "imagery",
    label: "Imagery",
    type: "raster-xyz",
    urlTemplate: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
  },
  {
    id: "streets",
    label: "Streets",
    type: "raster-xyz",
    urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
  },
  {
    id: "burials-pmtiles",
    label: "Burial Detail",
    type: "pmtiles-vector",
    urlTemplate: "/data/geo_burials.pmtiles",
    rasterFallbackUrlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 22,
    tileSize: 256,
  },
].map(createBasemapSpec);

const MAP_OVERLAY_SOURCES = [
  {
    id: "roads",
    label: "Roads",
    type: "geojson",
    format: "geojson",
    sourceModuleId: "roads",
    status: "active",
  },
  {
    id: "boundary",
    label: "Boundary",
    type: "geojson",
    format: "geojson",
    sourceModuleId: "boundary",
    status: "active",
  },
  {
    id: "sections",
    label: "Sections",
    type: "geojson",
    format: "geojson",
    sourceModuleId: "sections",
    status: "active",
  },
  {
    id: "burials-pmtiles",
    label: "Burial Detail Layer",
    type: "pmtiles-vector",
    format: "pmtiles-vector",
    publicPath: "/data/geo_burials.pmtiles",
    dataLayer: "burials",
    buildCommand: "bun run build:pmtiles",
    status: "experimental",
  },
  {
    id: "site-twin-manifest",
    label: "Site Twin Manifest",
    type: "json",
    format: "json",
    publicPath: "/data/site_twin/manifest.json",
    buildCommand: "bun run build:site-twin:terrain",
    status: "experimental",
  },
].map(createOverlaySourceSpec);

const MAP_OPTIMIZATION_ARTIFACTS = [
  {
    id: "burials-source-geojson",
    label: "Burials GeoJSON source",
    role: "source-of-truth",
    format: "geojson",
    sourceModuleId: "burials",
    filePath: "src/data/Geo_Burials.json",
    buildCommand: "",
    status: "active",
    notes: "Checked-in source data still used as the baseline fallback.",
  },
  {
    id: "burials-source-geoparquet",
    label: "Burials GeoParquet source",
    role: "columnar-canonical",
    format: "geoparquet",
    sourceModuleId: "burials",
    filePath: "src/data/Geo_Burials.parquet",
    buildCommand: "bun run build:geoparquet",
    status: "optional",
    notes: "Preferred build-time source when present; should remain a 1:1 replacement for the GeoJSON record model.",
  },
  {
    id: "burials-search-index",
    label: "Burials search index",
    role: "search-index",
    format: "json",
    sourceModuleId: "burials",
    publicPath: "/data/Search_Burials.json",
    filePath: "public/data/Search_Burials.json",
    buildCommand: "bun run build:data",
    status: "active",
    notes: "Runtime-minified payload consumed by the search and browse UI.",
  },
  {
    id: "burials-pmtiles",
    label: "Burial detail tile archive",
    role: "delivery-overlay",
    format: "pmtiles-vector",
    sourceModuleId: "burials",
    publicPath: "/data/geo_burials.pmtiles",
    filePath: "public/data/geo_burials.pmtiles",
    buildCommand: "bun run build:pmtiles",
    status: "experimental",
    notes: "Tile package for the burial detail preview layer.",
  },
  {
    id: "site-twin-manifest",
    label: "Ground model manifest",
    role: "delivery-overlay",
    format: "json",
    sourceModuleId: "burials",
    publicPath: "/data/site_twin/manifest.json",
    filePath: "public/data/site_twin/manifest.json",
    buildCommand: "bun run build:site-twin:terrain",
    status: "experimental",
    notes: "Manifest for the cemetery ground model and candidate marker overlays.",
  },
  {
    id: "site-twin-grave-candidates",
    label: "Ground model grave candidates",
    role: "delivery-overlay",
    format: "geojson",
    sourceModuleId: "burials",
    publicPath: "/data/site_twin/grave_candidates.geojson",
    filePath: "public/data/site_twin/grave_candidates.geojson",
    buildCommand: "bun run build:site-twin:terrain",
    status: "experimental",
    notes: "Candidate marker points sampled from terrain and burial geometry.",
  },
].map(createOptimizationArtifactSpec);

export const APP_PROFILE = {
  id: "fab",
  productName: "FAB",
  brand: {
    appName: FAB_SITE_NAME,
    adminName: FAB_ADMIN_SITE_NAME,
    mapLoadingTitle: FAB_SITE_NAME,
    mapLoadingMessage: "Loading map experience…",
    adminLoadingTitle: FAB_ADMIN_SITE_NAME,
    adminLoadingMessage: "Loading records workspace…",
  },
  shell: {
    homeUrl: FAB_HOME_URL,
    headerEyebrow: FAB_SITE_NAME,
    headerTitle: "Burial Finder",
    documentTitle: "Albany Rural Cemetery Burial Finder",
    description: "Installable burial locator for Albany Rural Cemetery with fast search, tours, navigation, and shareable map links.",
    manifestName: "Albany Rural Cemetery Burial Finder",
    manifestShortName: "Burial Finder",
    noScriptMessage: "You need to enable JavaScript to run the ARC Find-A-Burial App.",
  },
  distribution: {
    iosAppStoreUrl: FAB_IOS_APP_STORE_URL,
  },
  labels: {
    primaryRecordSingular: "burial",
    primaryRecordPlural: "burial records",
    unknownPrimaryRecord: "Unknown burial",
    defaultTourLocationLabel: "Tour location",
    defaultRecordSourceLabel: "Burial record",
  },
  fieldAliases: {
    primaryRecord: {
      objectId: ["OBJECTID", "id"],
      firstName: ["First_Name"],
      lastName: ["Last_Name"],
      fullName: ["Full_Name"],
      section: ["Section"],
      lot: ["Lot"],
      tier: ["Tier"],
      grave: ["Grave"],
      row: ["Row"],
      position: ["Position"],
      birth: ["Birth"],
      death: ["Death"],
      title: ["title", "tourKey"],
      tourKey: ["tourKey", "title"],
      tourName: ["tourName"],
      extraTitle: ["Titles", "extraTitle"],
    },
    tourRecord: {
      objectId: ["OBJECTID", "id"],
      firstName: ["First_Name", "First_name"],
      lastName: ["Last_Name"],
      fullName: ["Full_Name"],
      section: ["Section", "ARC_Secton"],
      lot: ["Lot", "ARC_Lot"],
      tier: ["Tier"],
      grave: ["Grave"],
      row: ["Row"],
      position: ["Position"],
      birth: ["Birth"],
      death: ["Death"],
      title: ["title", "Tour_ID"],
      tourKey: ["tourKey", "title", "Tour_ID"],
      tourName: ["tourName", "Tour_Name"],
      extraTitle: ["Titles", "extraTitle"],
    },
  },
  moduleIds: {
    primaryRecord: "burials",
    boundary: "boundary",
    sections: "sections",
    roads: "roads",
  },
  artifacts: {
    searchIndexPublicPath: "/data/Search_Burials.json",
    searchIndexFilePath: "public/data/Search_Burials.json",
    siteTwinManifestPublicPath: "/data/site_twin/manifest.json",
    tourMatchesFilePath: "src/data/TourMatches.json",
    generatedConstantsFilePath: "src/features/map/generatedBounds.js",
  },
  devStorageKeys: {
    siteTwinDebug: "fab:dev:siteTwinDebugState",
  },
  map: {
    center: [42.704180, -73.731980],
    zoom: 14,
    defaultViewBounds: [
      [42.694180, -73.741980],
      [42.714180, -73.721980],
    ],
    paddedBoundaryBounds: [
      [BOUNDARY_BBOX[1] - 0.01, BOUNDARY_BBOX[0] - 0.01],
      [BOUNDARY_BBOX[3] + 0.01, BOUNDARY_BBOX[2] + 0.01],
    ],
    locationBufferBoundary: LOCATION_BUFFER_BOUNDARY,
    locationMessages: {
      inactive: "Location inactive",
      active: "Location active",
      locating: "Locating...",
      unsupported: "Geolocation is not supported by your browser",
      unavailable: "Unable to retrieve your location",
      outOfBounds: `You must be within 5 miles of ${FAB_SITE_NAME}`,
    },
    defaultBasemapId: "imagery",
    basemaps: MAP_BASEMAPS,
    overlaySources: MAP_OVERLAY_SOURCES,
    siteTwin: {
      manifestPublicPath: "/data/site_twin/manifest.json",
      graveCandidatesPublicPath: "/data/site_twin/grave_candidates.geojson",
      defaultVisible: false,
    },
    storageStrategy: {
      sourceOfTruthFormat: "geojson",
      preferredBuildSourceFormat: "geoparquet",
      preferredDeliveryFormat: "pmtiles-vector",
      preferredSearchFormat: "json",
      migrationGoal: "Treat GeoParquet as a build-time 1:1 replacement for GeoJSON while preserving the existing runtime API and generated artifacts.",
    },
    optimizationArtifacts: MAP_OPTIMIZATION_ARTIFACTS,
  },
  dataModules: [
    ...CORE_DATA_MODULES,
    ...TOUR_MODULES,
  ],
  features: {
    tours: {
      label: "Tour",
      definitions: FAB_TOUR_DEFINITIONS,
      styles: FAB_TOUR_STYLES,
      enrichRecord: enrichFabTourRecord,
    },
    recordPresentation: {
      defaultSourceLabel: "Burial record",
      noImageUrl: FAB_NO_IMAGE_URL,
      biographyImageHint: FAB_BIOGRAPHY_IMAGE_HINT,
      resolveBiographyLink: resolveFabBiographyLink,
      resolveImageUrl: resolveFabRecordImageUrl,
      buildPopupRows: buildFabPopupRows,
    },
  },
};

export const DATA_MODULES = APP_PROFILE.dataModules || [];
export const TOUR_DEFINITIONS = APP_PROFILE.features?.tours?.definitions || [];
export const TOUR_STYLES = APP_PROFILE.features?.tours?.styles || {};

export const getDataModule = (moduleId) => (
  DATA_MODULES.find((definition) => definition.id === moduleId) || null
);

export const loadDataModule = async (moduleDefinition) => {
  const loaded = await moduleDefinition.load();
  return loaded.default || loaded;
};

export const getTourModuleDefinitions = () => (
  DATA_MODULES.filter((definition) => definition.kind === "tour")
);
