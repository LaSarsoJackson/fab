import {
  DEFAULT_ROUTING_PROVIDER,
  normalizeRoutingProvider,
  ROUTING_QUERY_PARAMS,
  VALID_ROUTING_PROVIDERS,
} from "../routing";

/**
 * Runtime feature flags are reserved for stable product behavior that may be
 * enabled or disabled per deployment. Development-only tools live in
 * DEVELOPMENT_SURFACES so admin, renderer, and artifact experiments are not
 * mistaken for shipped product features.
 */
const freezeArray = (values = []) => Object.freeze([...values]);

const createBooleanRuntimeToggle = (definition) => Object.freeze({
  ...definition,
  enabledQueryValues: freezeArray(definition.enabledQueryValues || []),
  disabledQueryValues: freezeArray(definition.disabledQueryValues || []),
});

export const RUNTIME_FEATURE_FLAGS = Object.freeze({
  fieldPackets: createBooleanRuntimeToggle({
    id: "fieldPackets",
    defaultValue: true,
    envKey: "REACT_APP_ENABLE_FIELD_PACKETS",
  }),
});

export const DEVELOPMENT_SURFACES = Object.freeze({
  adminStudio: createBooleanRuntimeToggle({
    id: "adminStudio",
    defaultValue: true,
  }),
  customMapEngine: createBooleanRuntimeToggle({
    id: "customMapEngine",
    defaultValue: false,
    envKey: "REACT_APP_ENABLE_CUSTOM_MAP_ENGINE",
    queryParamName: ROUTING_QUERY_PARAMS.mapEngine,
    enabledQueryValues: ["custom"],
    disabledQueryValues: ["leaflet"],
    storageKey: "fab:dev:customMapEngine",
  }),
  pmtilesExperiment: createBooleanRuntimeToggle({
    id: "pmtilesExperiment",
    defaultValue: false,
    storageKey: "fab:dev:pmtilesExperiment",
  }),
  siteTwinDebug: createBooleanRuntimeToggle({
    id: "siteTwinDebug",
    defaultValue: true,
  }),
});

export const DEVELOPMENT_ROUTING_PROVIDER = Object.freeze({
  id: "routingProvider",
  defaultValue: DEFAULT_ROUTING_PROVIDER,
  envKey: "REACT_APP_DEV_ROUTING_PROVIDER",
  queryParamName: ROUTING_QUERY_PARAMS.routingProvider,
  storageKey: "fab:dev:routingProvider",
  validValues: freezeArray(VALID_ROUTING_PROVIDERS),
});

export const DEFAULT_RUNTIME_FEATURE_FLAGS = Object.freeze({
  fieldPackets: RUNTIME_FEATURE_FLAGS.fieldPackets.defaultValue,
});

export const DEFAULT_DEVELOPMENT_SURFACES = Object.freeze({
  adminStudio: false,
  customMapEngine: DEVELOPMENT_SURFACES.customMapEngine.defaultValue,
  pmtilesExperiment: DEVELOPMENT_SURFACES.pmtilesExperiment.defaultValue,
  siteTwinDebug: false,
  routingProvider: DEVELOPMENT_ROUTING_PROVIDER.defaultValue,
});

const DEVELOPMENT_SURFACE_BY_ID = new Map(
  Object.values(DEVELOPMENT_SURFACES).map((surface) => [surface.id, surface])
);

export const formatRuntimeToggleQueryOverride = (toggleDefinition = {}) => {
  const queryParamName = toggleDefinition.queryParamName || "";
  if (!queryParamName) {
    return "";
  }

  const enabledValues = toggleDefinition.enabledQueryValues?.join("|") || "";
  const disabledValues = toggleDefinition.disabledQueryValues?.join("|") || "";

  return `${queryParamName}=${[enabledValues, disabledValues].filter(Boolean).join("|")}`;
};

const resolveBooleanFlag = (value, fallback = false) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const FIELD_PACKETS_FLAG = RUNTIME_FEATURE_FLAGS.fieldPackets;
const CUSTOM_MAP_ENGINE_SURFACE = DEVELOPMENT_SURFACES.customMapEngine;
const PMTILES_EXPERIMENT_SURFACE = DEVELOPMENT_SURFACES.pmtilesExperiment;

const readStoredRuntimeOverride = (storageKey) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage?.getItem?.(storageKey) ?? null;
  } catch (_error) {
    return null;
  }
};

const writeStoredRuntimeOverride = (storageKey, value) => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    if (value === null) {
      window.localStorage?.removeItem?.(storageKey);
      return true;
    }

    window.localStorage?.setItem?.(storageKey, value);
    return true;
  } catch (_error) {
    return false;
  }
};

const resolveStickyRuntimeToggle = ({
  disabledQueryValues,
  enabledQueryValues,
  envValue,
  queryParamName,
  storageKey,
}) => {
  if (typeof window === "undefined") {
    return envValue;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const runtimeOverride = searchParams.get(queryParamName);

  if (enabledQueryValues.includes(runtimeOverride)) {
    return true;
  }

  if (disabledQueryValues.includes(runtimeOverride)) {
    return false;
  }

  const storedOverride = readStoredRuntimeOverride(storageKey);
  if (storedOverride === "true" || storedOverride === "false") {
    return resolveBooleanFlag(storedOverride, envValue);
  }

  return envValue;
};

const resolveCustomMapEngineSurface = (env) => resolveStickyRuntimeToggle({
  disabledQueryValues: CUSTOM_MAP_ENGINE_SURFACE.disabledQueryValues,
  enabledQueryValues: CUSTOM_MAP_ENGINE_SURFACE.enabledQueryValues,
  envValue: resolveBooleanFlag(
    env[CUSTOM_MAP_ENGINE_SURFACE.envKey],
    CUSTOM_MAP_ENGINE_SURFACE.defaultValue
  ),
  queryParamName: CUSTOM_MAP_ENGINE_SURFACE.queryParamName,
  storageKey: CUSTOM_MAP_ENGINE_SURFACE.storageKey,
});

const resolveStoredDevelopmentSurface = (surfaceDefinition) => {
  const storedOverride = readStoredRuntimeOverride(surfaceDefinition.storageKey);

  if (storedOverride === "true" || storedOverride === "false") {
    return resolveBooleanFlag(storedOverride, surfaceDefinition.defaultValue);
  }

  return Boolean(surfaceDefinition.defaultValue);
};

const resolveDevelopmentRoutingProvider = (env, { isDev }) => {
  const envProvider = normalizeRoutingProvider(env[DEVELOPMENT_ROUTING_PROVIDER.envKey]) ||
    DEVELOPMENT_ROUTING_PROVIDER.defaultValue;

  if (!isDev || typeof window === "undefined") {
    return isDev ? envProvider : DEVELOPMENT_ROUTING_PROVIDER.defaultValue;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryProvider = normalizeRoutingProvider(
    searchParams.get(DEVELOPMENT_ROUTING_PROVIDER.queryParamName)
  );
  if (queryProvider) {
    return queryProvider;
  }

  const storedProvider = normalizeRoutingProvider(
    readStoredRuntimeOverride(DEVELOPMENT_ROUTING_PROVIDER.storageKey)
  );
  if (storedProvider) {
    return storedProvider;
  }

  return envProvider;
};

export const getRuntimeEnv = (env = process.env) => {
  const appEnvironment = env.REACT_APP_ENVIRONMENT === "production"
    ? "production"
    : "development";
  const isDev = appEnvironment !== "production";
  const featureFlags = {
    fieldPackets: resolveBooleanFlag(
      env[FIELD_PACKETS_FLAG.envKey],
      DEFAULT_RUNTIME_FEATURE_FLAGS.fieldPackets
    ),
  };
  const devSurfaces = isDev
    ? {
      adminStudio: DEVELOPMENT_SURFACES.adminStudio.defaultValue,
      customMapEngine: resolveCustomMapEngineSurface(env),
      pmtilesExperiment: resolveStoredDevelopmentSurface(PMTILES_EXPERIMENT_SURFACE),
      siteTwinDebug: DEVELOPMENT_SURFACES.siteTwinDebug.defaultValue,
      routingProvider: resolveDevelopmentRoutingProvider(env, { isDev }),
    }
    : { ...DEFAULT_DEVELOPMENT_SURFACES };

  return {
    appEnvironment,
    isDev,
    featureFlags,
    devSurfaces,
  };
};

export const isAdminStudioEnabled = (env = process.env) => (
  Boolean(getRuntimeEnv(env).devSurfaces.adminStudio)
);

export const isFieldPacketsEnabled = (featureFlags = DEFAULT_RUNTIME_FEATURE_FLAGS) => (
  typeof featureFlags?.fieldPackets === "boolean"
    ? featureFlags.fieldPackets
    : RUNTIME_FEATURE_FLAGS.fieldPackets.defaultValue
);

export const isDevelopmentSurfaceEnabled = (
  devSurfaces = DEFAULT_DEVELOPMENT_SURFACES,
  surfaceId = ""
) => {
  const surfaceDefinition = DEVELOPMENT_SURFACE_BY_ID.get(surfaceId);
  if (!surfaceDefinition) {
    return false;
  }

  return typeof devSurfaces?.[surfaceDefinition.id] === "boolean"
    ? devSurfaces[surfaceDefinition.id]
    : surfaceDefinition.defaultValue;
};

export const getDevelopmentRoutingProvider = (devSurfaces = DEFAULT_DEVELOPMENT_SURFACES) => {
  const provider = String(devSurfaces?.routingProvider || "").trim().toLowerCase();
  return DEVELOPMENT_ROUTING_PROVIDER.validValues.includes(provider)
    ? provider
    : DEVELOPMENT_ROUTING_PROVIDER.defaultValue;
};

export const getMapEngineKind = (devSurfaces = DEFAULT_DEVELOPMENT_SURFACES) => (
  isDevelopmentSurfaceEnabled(devSurfaces, DEVELOPMENT_SURFACES.customMapEngine.id)
    ? "custom"
    : "leaflet"
);

export const setStoredDevelopmentSurfaceOverride = (surfaceId, isEnabled) => {
  const surfaceDefinition = DEVELOPMENT_SURFACE_BY_ID.get(surfaceId);
  if (!surfaceDefinition?.storageKey) {
    return false;
  }

  return writeStoredRuntimeOverride(surfaceDefinition.storageKey, isEnabled ? "true" : "false");
};

export const clearStoredDevelopmentSurfaceOverride = (surfaceId) => {
  const surfaceDefinition = DEVELOPMENT_SURFACE_BY_ID.get(surfaceId);
  if (!surfaceDefinition?.storageKey) {
    return false;
  }

  return writeStoredRuntimeOverride(surfaceDefinition.storageKey, null);
};

export const setStoredDevelopmentRoutingProvider = (provider) => {
  const normalizedProvider = normalizeRoutingProvider(provider);
  if (!normalizedProvider) {
    return false;
  }

  return writeStoredRuntimeOverride(
    DEVELOPMENT_ROUTING_PROVIDER.storageKey,
    normalizedProvider
  );
};

export const clearStoredDevelopmentRoutingProvider = () => (
  writeStoredRuntimeOverride(DEVELOPMENT_ROUTING_PROVIDER.storageKey, null)
);

const hasIdleCallback = () => (
  typeof window !== "undefined" &&
  typeof window.requestIdleCallback === "function"
);

export const scheduleIdleTask = (
  callback,
  {
    timeout = 1000,
    fallbackDelay = 16,
  } = {}
) => {
  if (typeof callback !== "function") {
    return null;
  }

  if (hasIdleCallback()) {
    return {
      type: "idle",
      id: window.requestIdleCallback(() => {
        callback();
      }, { timeout }),
    };
  }

  return {
    type: "timeout",
    id: setTimeout(() => {
      callback();
    }, fallbackDelay),
  };
};

export const cancelIdleTask = (handle) => {
  if (!handle) {
    return;
  }

  if (handle.type === "idle" && hasIdleCallback()) {
    window.cancelIdleCallback(handle.id);
    return;
  }

  clearTimeout(handle.id);
};

export const buildPublicAssetUrl = (
  path,
  publicUrl = process.env.PUBLIC_URL || ""
) => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return `${publicUrl}${normalizedPath}`;
};

const resolveDocument = (documentOverride) => {
  if (documentOverride) {
    return documentOverride;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return document;
};

export const setDocumentMetaContent = (selector, content, documentOverride) => {
  const targetDocument = resolveDocument(documentOverride);
  if (!targetDocument) {
    return;
  }

  const element = targetDocument.querySelector(selector);
  if (!element) {
    return;
  }

  element.setAttribute("content", content);
};

export const syncDocumentMetadata = ({
  title,
  description,
  url = "",
} = {}, documentOverride) => {
  const targetDocument = resolveDocument(documentOverride);
  if (!targetDocument) {
    return;
  }

  if (typeof title === "string") {
    targetDocument.title = title;
    setDocumentMetaContent('meta[property="og:title"]', title, targetDocument);
    setDocumentMetaContent('meta[name="twitter:title"]', title, targetDocument);
  }

  if (typeof description === "string") {
    setDocumentMetaContent('meta[name="description"]', description, targetDocument);
    setDocumentMetaContent('meta[property="og:description"]', description, targetDocument);
    setDocumentMetaContent('meta[name="twitter:description"]', description, targetDocument);
  }

  if (typeof url === "string") {
    setDocumentMetaContent('meta[property="og:url"]', url, targetDocument);
  }
};

export const {
  appEnvironment: APP_ENVIRONMENT,
  isDev: IS_DEV,
  featureFlags: FEATURE_FLAGS,
  devSurfaces: DEV_SURFACES,
} = getRuntimeEnv();
