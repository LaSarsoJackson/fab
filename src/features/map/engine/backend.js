export const MAP_BACKEND_API_VERSION = 1;

const DEFAULT_STORAGE_STRATEGY = {
  sourceOfTruthFormat: "geojson",
  preferredBuildSourceFormat: "geojson",
  preferredDeliveryFormat: "json",
  preferredSearchFormat: "json",
  migrationGoal: "",
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const hasFilePath = (artifact) => typeof artifact?.filePath === "string" && artifact.filePath.length > 0;

const createFormatRanker = (preferredFormats = []) => {
  const normalizedPreferredFormats = toArray(preferredFormats).filter(Boolean);

  return (format = "") => {
    const index = normalizedPreferredFormats.indexOf(format);
    return index === -1 ? normalizedPreferredFormats.length : index;
  };
};

export const getMapStorageStrategy = (appProfile = {}) => ({
  ...DEFAULT_STORAGE_STRATEGY,
  ...(appProfile.map?.storageStrategy || {}),
});

export const getMapBasemapSpecs = (appProfile = {}) => toArray(appProfile.map?.basemaps);

export const getMapOverlaySourceSpecs = (appProfile = {}) => toArray(appProfile.map?.overlaySources);

export const getMapOptimizationArtifactSpecs = (appProfile = {}) => (
  toArray(appProfile.map?.optimizationArtifacts)
);

export const getOverlaySourceById = (appProfile = {}, overlaySourceId = "") => (
  getMapOverlaySourceSpecs(appProfile).find((source) => source.id === overlaySourceId) || null
);

export const getOptimizationArtifactById = (appProfile = {}, artifactId = "") => (
  getMapOptimizationArtifactSpecs(appProfile).find((artifact) => artifact.id === artifactId) || null
);

export const getOptimizationArtifactsByRole = (appProfile = {}, role = "") => (
  getMapOptimizationArtifactSpecs(appProfile).filter((artifact) => artifact.role === role)
);

export const getPreferredBuildSourceArtifact = (appProfile = {}, options = {}) => {
  const storageStrategy = getMapStorageStrategy(appProfile);
  const sourceModuleId = options.sourceModuleId || "";
  const candidateArtifacts = getMapOptimizationArtifactSpecs(appProfile).filter((artifact) => {
    const isSourceArtifact = artifact.role === "columnar-canonical" || artifact.role === "source-of-truth";
    const matchesSourceModule = !sourceModuleId || artifact.sourceModuleId === sourceModuleId;
    return isSourceArtifact && matchesSourceModule && hasFilePath(artifact);
  });

  const getFormatRank = createFormatRanker([
    storageStrategy.preferredBuildSourceFormat,
    storageStrategy.sourceOfTruthFormat,
  ]);

  const statusRank = {
    active: 0,
    optional: 1,
    experimental: 2,
  };

  const sortedArtifacts = [...candidateArtifacts].sort((left, right) => {
    const formatDelta = getFormatRank(left.format) - getFormatRank(right.format);
    if (formatDelta !== 0) {
      return formatDelta;
    }

    const statusDelta = (statusRank[left.status] ?? 99) - (statusRank[right.status] ?? 99);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return left.id.localeCompare(right.id);
  });

  return sortedArtifacts[0] || null;
};

export const getMapBackendDescriptor = (appProfile = {}) => {
  const storageStrategy = getMapStorageStrategy(appProfile);
  const basemaps = getMapBasemapSpecs(appProfile);
  const overlaySources = getMapOverlaySourceSpecs(appProfile);
  const optimizationArtifacts = getMapOptimizationArtifactSpecs(appProfile);

  return {
    apiVersion: MAP_BACKEND_API_VERSION,
    storageStrategy,
    basemapTypes: Array.from(new Set(basemaps.map((basemap) => basemap.type).filter(Boolean))),
    overlayFormats: Array.from(new Set(overlaySources.map((source) => source.format || source.type).filter(Boolean))),
    artifactFormats: Array.from(new Set(optimizationArtifacts.map((artifact) => artifact.format).filter(Boolean))),
    preferredBuildArtifact: getPreferredBuildSourceArtifact(appProfile),
  };
};
