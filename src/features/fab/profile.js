import { BOUNDARY_BBOX, LOCATION_BUFFER_BOUNDARY } from "../map/generatedBounds";
import { FAB_TOUR_DEFINITIONS, FAB_TOUR_STYLES, enrichFabTourRecord } from "./tours";

/**
 * FAB-specific product profile. Keep Albany Rural Cemetery URLs, branding,
 * source modules, map defaults, and record presentation callbacks here instead
 * of scattering hardcoded app assumptions through shared modules.
 */
const stripLeadingSlash = (value = "") => String(value).trim().replace(/^\/+/, "");
const stripTrailingSlash = (value = "") => String(value).trim().replace(/\/+$/, "");
const createBasemapSpec = (definition) => Object.freeze({ ...definition });
const createOverlaySourceSpec = (definition) => Object.freeze({ ...definition });
const createOptimizationArtifactSpec = (definition) => Object.freeze({ ...definition });
const createBoundsFromBbox = ([west, south, east, north]) => Object.freeze([
  Object.freeze([south, west]),
  Object.freeze([north, east]),
]);
const padLatLngBounds = (bounds, { latitude = 0, longitude = 0 } = {}) => Object.freeze([
  Object.freeze([bounds[0][0] - latitude, bounds[0][1] - longitude]),
  Object.freeze([bounds[1][0] + latitude, bounds[1][1] + longitude]),
]);

const FAB_SITE_ROOT_URL = "https://www.albany.edu/arce";
const FAB_SITE_NAME = "Albany Rural Cemetery";
const FAB_HOME_URL = `${FAB_SITE_ROOT_URL}/`;
const FAB_IMAGE_DIRECTORY = "images";
const FAB_NO_IMAGE_FILE_NAME = "no-image.jpg";
// Profile-owned copy and URLs are used by both the web shell and the hosted
// native wrapper, so keep them centralized instead of duplicating constants in
// app components.
const FAB_BIOGRAPHY_IMAGE_HINT = "Tap the image to open the ARCE biography.";
const FAB_IOS_APP_STORE_URL = "https://apps.apple.com/us/app/albany-grave-finder/id6746413050";
const FAB_DEV_IMAGE_SERVER_ORIGIN = (process.env.REACT_APP_DEV_IMAGE_SERVER_ORIGIN || "")
  .trim()
  .replace(/\/+$/, "");
const NYS_ORTHO_LATEST_EXPORT_URL = "https://orthos.its.ny.gov/arcgis/rest/services/wms/Latest/MapServer/export";
const CEMETERY_BOUNDARY_BOUNDS = createBoundsFromBbox(BOUNDARY_BBOX);
const CEMETERY_DEFAULT_VIEW_BOUNDS = padLatLngBounds(CEMETERY_BOUNDARY_BOUNDS, {
  latitude: 0.001,
  longitude: 0.001,
});
const CEMETERY_PADDED_BOUNDARY_BOUNDS = padLatLngBounds(CEMETERY_BOUNDARY_BOUNDS, {
  latitude: 0.01,
  longitude: 0.01,
});
const CEMETERY_ORTHO_OVERVIEW_BOUNDS = Object.freeze([
  Object.freeze([42.66, -73.82]),
  Object.freeze([42.75, -73.64]),
]);
const CEMETERY_ORTHO_DETAIL_BOUNDS = padLatLngBounds(CEMETERY_BOUNDARY_BOUNDS, {
  latitude: 0.015,
  longitude: 0.015,
});
const ESRI_WORLD_IMAGERY_BASEMAP = Object.freeze({
  id: "esri-world-imagery-fallback",
  type: "raster-xyz",
  urlTemplate: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  minZoom: 0,
  maxNativeZoom: 19,
  maxZoom: 20,
  tileSize: 256,
  attribution: "Esri World Imagery",
});

export const FAB_BASEMAP_IMAGE_EXPORTS = Object.freeze([
  Object.freeze({
    id: "overview",
    imageUrl: "/basemaps/albany-rural-cemetery-nys-ortho-overview.jpg",
    outputPath: "public/basemaps/albany-rural-cemetery-nys-ortho-overview.jpg",
    bounds: CEMETERY_ORTHO_OVERVIEW_BOUNDS,
    sourceExportUrl: NYS_ORTHO_LATEST_EXPORT_URL,
    maxImageDimension: 4096,
  }),
  Object.freeze({
    id: "cemetery-detail",
    imageUrl: "/basemaps/albany-rural-cemetery-nys-ortho-latest.jpg",
    outputPath: "public/basemaps/albany-rural-cemetery-nys-ortho-latest.jpg",
    bounds: CEMETERY_ORTHO_DETAIL_BOUNDS,
    sourceExportUrl: NYS_ORTHO_LATEST_EXPORT_URL,
    maxImageDimension: 4096,
  }),
]);

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

  // Biography fields are inconsistent: some contain a full URL, some contain a
  // slug, and some accidentally contain an image filename. Only page-like
  // values should become external biography links.
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
    // Local development serves checked-in image assets from a companion Python
    // server because Create React App does not expose src/data files publicly.
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

  // Popup rows intentionally stay profile-owned because these labels reflect
  // Albany Rural Cemetery source fields, not generic map presentation rules.
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
  // Data modules are the profile-level source registry used by runtime loading,
  // artifact generation, and contributor docs.
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
  // Basemap specs are data, not rendering code. Map chrome consumes these
  // profile entries so new sources can be reviewed without touching Leaflet
  // lifecycle code.
  {
    id: "imagery",
    label: "Imagery",
    type: "image-overlay",
    fallbackRaster: ESRI_WORLD_IMAGERY_BASEMAP,
    imageOverlays: FAB_BASEMAP_IMAGE_EXPORTS.map((exportDefinition, index) => ({
      id: exportDefinition.id,
      imageUrl: exportDefinition.imageUrl,
      bounds: exportDefinition.bounds,
      zIndex: index + 1,
    })),
    attribution: "NYS ITS Geospatial Services",
    minZoom: 0,
    maxZoom: 20,
  },
  {
    id: "streets",
    label: "Streets",
    type: "raster-xyz",
    urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 0,
    maxNativeZoom: 19,
    maxZoom: 20,
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
].map(createOverlaySourceSpec);

const MAP_OPTIMIZATION_ARTIFACTS = [
  // These entries document which checked-in/generated map artifacts are active
  // today and which optional formats are build-time accelerators only.
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
].map(createOptimizationArtifactSpec);

export const APP_PROFILE = {
  id: "fab",
  productName: "FAB",
  brand: {
    appName: FAB_SITE_NAME,
    mapLoadingTitle: FAB_SITE_NAME,
    mapLoadingMessage: "Loading map experience…",
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
    tourMatchesFilePath: "src/data/TourMatches.json",
    generatedConstantsFilePath: "src/features/map/generatedBounds.js",
  },
  map: {
    center: [42.704180, -73.731980],
    zoom: 14,
    defaultViewBounds: CEMETERY_DEFAULT_VIEW_BOUNDS,
    paddedBoundaryBounds: CEMETERY_PADDED_BOUNDARY_BOUNDS,
    locationBufferBoundary: LOCATION_BUFFER_BOUNDARY,
    locationMessages: {
      inactive: "Location inactive",
      active: "Location active",
      locating: "Locating...",
      // Surfaced while the high-accuracy attempt has timed out or returned an
      // "unavailable" error and the shell is retrying with a coarse network
      // fallback. Users in weak-signal areas (canopy, large trees) need to
      // know we have not given up yet.
      weakSignal: "GPS signal is weak, still trying...",
      // Surfaced when only a coarse (network/Wi-Fi or low-accuracy GPS) fix
      // has been accepted. The shell continues watching for a better fix.
      approximate: "Approximate location (improving signal...)",
      unsupported: "GPS is not supported in this browser. Search by name or section, or use Open in Maps.",
      unavailable: "GPS is unavailable. Check signal and permissions, or search by name or section.",
      permissionDenied: "Location permission denied. Enable it in your browser/OS settings, or search by name or section.",
      outOfBounds: `Location is outside cemetery range. Search still works; use Open in Maps for off-site directions.`,
      routeLocationRequired: `Route on Map needs your current location near ${FAB_SITE_NAME}. Use Open in Maps for directions from farther away.`,
    },
    defaultBasemapId: "imagery",
    basemaps: MAP_BASEMAPS,
    overlaySources: MAP_OVERLAY_SOURCES,
    storageStrategy: {
      sourceOfTruthFormat: "geojson",
      preferredBuildSourceFormat: "geoparquet",
      preferredDeliveryFormat: "json",
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
export const EMPTY_MAP_FEATURE_COLLECTION = Object.freeze({
  type: "FeatureCollection",
  features: Object.freeze([]),
});

export const getDataModule = (moduleId) => (
  DATA_MODULES.find((definition) => definition.id === moduleId) || null
);

export const loadDataModule = async (moduleDefinition) => {
  const loaded = await moduleDefinition.load();
  return loaded.default || loaded;
};

export const getEmptyCoreMapData = () => ({
  boundaryData: EMPTY_MAP_FEATURE_COLLECTION,
  roadsData: EMPTY_MAP_FEATURE_COLLECTION,
  sectionsData: EMPTY_MAP_FEATURE_COLLECTION,
});

export const normalizeMapFeatureCollection = (featureCollection = {}) => ({
  // Leaflet and feature helpers expect an array even when a load fails or a
  // profile module returns a bare object.
  type: "FeatureCollection",
  ...featureCollection,
  features: Array.isArray(featureCollection?.features) ? featureCollection.features : [],
});

const getRequiredMapDataModule = (moduleId, resolveModule) => {
  const moduleDefinition = resolveModule(moduleId);

  if (!moduleDefinition) {
    throw new Error(`Missing required map data module: ${moduleId}`);
  }

  return moduleDefinition;
};

export const loadCoreMapData = async (
  appProfile,
  {
    resolveModule = getDataModule,
    loadModule = loadDataModule,
  } = {}
) => {
  const moduleIds = appProfile?.moduleIds || {};
  const boundaryModule = getRequiredMapDataModule(moduleIds.boundary, resolveModule);
  const roadsModule = getRequiredMapDataModule(moduleIds.roads, resolveModule);
  const sectionsModule = getRequiredMapDataModule(moduleIds.sections, resolveModule);

  const [boundaryData, roadsData, sectionsData] = await Promise.all([
    loadModule(boundaryModule),
    loadModule(roadsModule),
    loadModule(sectionsModule),
  ]);

  return {
    boundaryData: normalizeMapFeatureCollection(boundaryData),
    roadsData: normalizeMapFeatureCollection(roadsData),
    sectionsData: normalizeMapFeatureCollection(sectionsData),
  };
};

export const getTourModuleDefinitions = () => (
  DATA_MODULES.filter((definition) => definition.kind === "tour")
);
