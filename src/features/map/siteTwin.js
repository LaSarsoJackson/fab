export const EMPTY_SITE_TWIN_MANIFEST = {
  version: 1,
  status: "unbuilt",
  generatedAtUtc: "",
  terrainImage: null,
  graveCandidates: {
    url: "/data/site_twin/grave_candidates.geojson",
    count: 0,
  },
  sourceVintageNote: "",
  metrics: null,
};

export const DEFAULT_SITE_TWIN_DEBUG_STATE = {
  showSurface: true,
  showMonuments: true,
  surfaceOpacity: 0.92,
  monumentHeightScale: 1,
  minConfidence: 0,
  minHeightMeters: 0,
  knownHeadstonesOnly: false,
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const getQuantile = (values, quantile) => {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const position = clamp(quantile, 0, 1) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const weight = position - lowerIndex;
  return (
    (sortedValues[lowerIndex] * (1 - weight)) +
    (sortedValues[upperIndex] * weight)
  );
};

const normalizeFiniteValue = (value, fallback, minimum, maximum) => {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return fallback;
  }
  return clamp(nextValue, minimum, maximum);
};

const normalizeBounds = (bounds) => {
  if (!Array.isArray(bounds) || bounds.length !== 2) {
    return null;
  }

  const southWest = Array.isArray(bounds[0]) ? bounds[0] : [];
  const northEast = Array.isArray(bounds[1]) ? bounds[1] : [];
  if (southWest.length < 2 || northEast.length < 2) {
    return null;
  }

  const nextBounds = [
    [Number(southWest[0]), Number(southWest[1])],
    [Number(northEast[0]), Number(northEast[1])],
  ];

  if (nextBounds.flat().some((value) => !Number.isFinite(value))) {
    return null;
  }

  return nextBounds;
};

export const normalizeSiteTwinManifest = (manifest = {}) => {
  const terrainImage = manifest?.terrainImage
    ? {
        url: manifest.terrainImage.url || "",
        bounds: normalizeBounds(manifest.terrainImage.bounds),
        opacity: Number.isFinite(manifest.terrainImage.opacity)
          ? manifest.terrainImage.opacity
          : 0.84,
      }
    : null;

  return {
    ...EMPTY_SITE_TWIN_MANIFEST,
    ...manifest,
    version: Number.isFinite(manifest?.version) ? manifest.version : 1,
    status: manifest?.status || EMPTY_SITE_TWIN_MANIFEST.status,
    terrainImage: terrainImage?.url && terrainImage?.bounds ? terrainImage : null,
    graveCandidates: {
      ...EMPTY_SITE_TWIN_MANIFEST.graveCandidates,
      ...(manifest?.graveCandidates || {}),
    },
  };
};

export const normalizeSiteTwinFeatureCollection = (featureCollection = {}) => ({
  type: "FeatureCollection",
  features: Array.isArray(featureCollection?.features) ? featureCollection.features : [],
});

export const normalizeSiteTwinDebugState = (debugState = {}) => ({
  ...DEFAULT_SITE_TWIN_DEBUG_STATE,
  ...debugState,
  showSurface: debugState?.showSurface !== false,
  showMonuments: debugState?.showMonuments !== false,
  surfaceOpacity: normalizeFiniteValue(
    debugState?.surfaceOpacity,
    DEFAULT_SITE_TWIN_DEBUG_STATE.surfaceOpacity,
    0,
    1
  ),
  monumentHeightScale: normalizeFiniteValue(
    debugState?.monumentHeightScale,
    DEFAULT_SITE_TWIN_DEBUG_STATE.monumentHeightScale,
    0.5,
    3
  ),
  minConfidence: normalizeFiniteValue(
    debugState?.minConfidence,
    DEFAULT_SITE_TWIN_DEBUG_STATE.minConfidence,
    0,
    1
  ),
  minHeightMeters: normalizeFiniteValue(
    debugState?.minHeightMeters,
    DEFAULT_SITE_TWIN_DEBUG_STATE.minHeightMeters,
    0,
    2
  ),
  knownHeadstonesOnly: Boolean(debugState?.knownHeadstonesOnly),
});

export const isSiteTwinReady = (manifest = null) => (
  Boolean(
    manifest?.status === "ready" &&
    manifest?.terrainImage?.url &&
    manifest?.terrainImage?.bounds
  )
);

export const filterSiteTwinFeatureCollection = (featureCollection = {}, debugState = {}) => {
  const normalizedState = normalizeSiteTwinDebugState(debugState);
  const normalizedFeatureCollection = normalizeSiteTwinFeatureCollection(featureCollection);

  return {
    type: "FeatureCollection",
    features: normalizedFeatureCollection.features.filter((feature) => {
      const properties = feature?.properties || {};
      const confidence = Number(properties.confidence);
      const heightMeters = Number(properties.heightMeters);
      const knownHeadstone = Boolean(properties.knownHeadstone);

      if (normalizedState.knownHeadstonesOnly && !knownHeadstone) {
        return false;
      }
      if (Number.isFinite(confidence) && confidence < normalizedState.minConfidence) {
        return false;
      }
      if (Number.isFinite(heightMeters) && heightMeters < normalizedState.minHeightMeters) {
        return false;
      }

      return true;
    }),
  };
};

export const summarizeSiteTwinFeatureCollection = (featureCollection = {}) => {
  const normalizedFeatureCollection = normalizeSiteTwinFeatureCollection(featureCollection);
  const features = normalizedFeatureCollection.features;
  const confidenceValues = features
    .map((feature) => Number(feature?.properties?.confidence))
    .filter((value) => Number.isFinite(value));
  const heightValues = features
    .map((feature) => Number(feature?.properties?.heightMeters))
    .filter((value) => Number.isFinite(value));

  return {
    count: features.length,
    knownHeadstoneCount: features.filter((feature) => Boolean(feature?.properties?.knownHeadstone)).length,
    meanConfidence: confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0,
    heightP95Meters: getQuantile(heightValues, 0.95),
  };
};

export const buildSiteTwinPointEntries = (featureCollection = {}) => (
  normalizeSiteTwinFeatureCollection(featureCollection).features
    .filter(
      (feature) => (
        feature?.geometry?.type === "Point" &&
        Array.isArray(feature?.geometry?.coordinates) &&
        feature.geometry.coordinates.length >= 2
      )
    )
    .map((feature, index) => ({
      id: String(
        feature?.id ??
        feature?.properties?.id ??
        feature?.properties?.arcGeoId ??
        `site-twin-point-${index}`
      ),
      coordinates: feature.geometry.coordinates,
      record: {
        ...feature.properties,
        featureId: feature.id ?? null,
      },
    }))
);
