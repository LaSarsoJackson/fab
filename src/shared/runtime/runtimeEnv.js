/**
 * Runtime toggles are reserved for experiments or environment-only behavior.
 * Stable FAB product features should live in the app profile instead.
 */
const freezeArray = (values = []) => Object.freeze([...values]);

const createBooleanRuntimeFlag = (definition) => Object.freeze({
  ...definition,
  enabledQueryValues: freezeArray(definition.enabledQueryValues || []),
  disabledQueryValues: freezeArray(definition.disabledQueryValues || []),
});

export const RUNTIME_FEATURE_FLAGS = Object.freeze({
  fieldPackets: createBooleanRuntimeFlag({
    id: "fieldPackets",
    defaultValue: true,
    envKey: "REACT_APP_ENABLE_FIELD_PACKETS",
  }),
  customMapEngine: createBooleanRuntimeFlag({
    id: "customMapEngine",
    defaultValue: false,
    envKey: "REACT_APP_ENABLE_CUSTOM_MAP_ENGINE",
    queryParamName: "mapEngine",
    enabledQueryValues: ["custom"],
    disabledQueryValues: ["leaflet"],
    storageKey: "fab:enableCustomMapEngine",
  }),
});

export const ROUTING_PROVIDER_RUNTIME = Object.freeze({
  id: "routingProvider",
  defaultValue: "api",
  envKey: "REACT_APP_DEV_ROUTING_PROVIDER",
  queryParamName: "routing",
  storageKey: "fab:routingProvider",
  validValues: freezeArray(["api", "local", "valhalla"]),
  legacy: Object.freeze({
    envKey: "REACT_APP_ENABLE_CLIENT_SIDE_ROUTING",
    queryParamName: "clientSideRouting",
    storageKey: "fab:enableClientSideRouting",
  }),
});

export const DEFAULT_RUNTIME_FEATURE_FLAGS = Object.freeze({
  fieldPackets: RUNTIME_FEATURE_FLAGS.fieldPackets.defaultValue,
  customMapEngine: RUNTIME_FEATURE_FLAGS.customMapEngine.defaultValue,
  routingProvider: ROUTING_PROVIDER_RUNTIME.defaultValue,
});

export const formatRuntimeFlagQueryOverride = (flagDefinition = {}) => {
  const queryParamName = flagDefinition.queryParamName || "";
  if (!queryParamName) {
    return "";
  }

  const enabledValues = flagDefinition.enabledQueryValues?.join("|") || "";
  const disabledValues = flagDefinition.disabledQueryValues?.join("|") || "";

  return `${queryParamName}=${[enabledValues, disabledValues].filter(Boolean).join("|")}`;
};

const resolveBooleanFlag = (value, fallback = false) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const CUSTOM_MAP_ENGINE_FLAG = RUNTIME_FEATURE_FLAGS.customMapEngine;
const FIELD_PACKETS_FLAG = RUNTIME_FEATURE_FLAGS.fieldPackets;
const VALID_ROUTING_PROVIDERS = new Set(ROUTING_PROVIDER_RUNTIME.validValues);

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

const resolveStickyRuntimeFlag = ({
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

const resolveCustomMapEngineFlag = (env) => resolveStickyRuntimeFlag({
  disabledQueryValues: CUSTOM_MAP_ENGINE_FLAG.disabledQueryValues,
  enabledQueryValues: CUSTOM_MAP_ENGINE_FLAG.enabledQueryValues,
  envValue: resolveBooleanFlag(
    env[CUSTOM_MAP_ENGINE_FLAG.envKey],
    CUSTOM_MAP_ENGINE_FLAG.defaultValue
  ),
  queryParamName: CUSTOM_MAP_ENGINE_FLAG.queryParamName,
  storageKey: CUSTOM_MAP_ENGINE_FLAG.storageKey,
});

const normalizeRoutingProvider = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return VALID_ROUTING_PROVIDERS.has(normalizedValue) ? normalizedValue : "";
};

const resolveLegacyClientSideRoutingOverride = (value) => {
  if (value === "true" || value === "1" || value === "local") {
    return "local";
  }

  if (value === "false" || value === "0" || value === "api") {
    return "api";
  }

  return "";
};

const resolveRoutingProviderFlag = (env, { isDev }) => {
  const envProvider = normalizeRoutingProvider(env[ROUTING_PROVIDER_RUNTIME.envKey]) || (
    resolveBooleanFlag(env[ROUTING_PROVIDER_RUNTIME.legacy.envKey], false)
      ? "local"
      : ROUTING_PROVIDER_RUNTIME.defaultValue
  );

  if (!isDev || typeof window === "undefined") {
    return isDev ? envProvider : ROUTING_PROVIDER_RUNTIME.defaultValue;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryProvider = normalizeRoutingProvider(
    searchParams.get(ROUTING_PROVIDER_RUNTIME.queryParamName)
  );
  if (queryProvider) {
    return queryProvider;
  }

  const legacyQueryProvider = resolveLegacyClientSideRoutingOverride(
    searchParams.get(ROUTING_PROVIDER_RUNTIME.legacy.queryParamName)
  );
  if (legacyQueryProvider) {
    return legacyQueryProvider;
  }

  const storedProvider = normalizeRoutingProvider(
    readStoredRuntimeOverride(ROUTING_PROVIDER_RUNTIME.storageKey)
  );
  if (storedProvider) {
    return storedProvider;
  }

  const legacyStoredProvider = resolveLegacyClientSideRoutingOverride(
    readStoredRuntimeOverride(ROUTING_PROVIDER_RUNTIME.legacy.storageKey)
  );
  if (legacyStoredProvider) {
    return legacyStoredProvider;
  }

  return envProvider;
};

export const getRuntimeEnv = (env = process.env) => {
  const appEnvironment = env.REACT_APP_ENVIRONMENT === "production"
    ? "production"
    : "development";
  const isDev = appEnvironment !== "production";
  const routingProvider = resolveRoutingProviderFlag(env, { isDev });
  const featureFlags = {
    fieldPackets: resolveBooleanFlag(
      env[FIELD_PACKETS_FLAG.envKey],
      DEFAULT_RUNTIME_FEATURE_FLAGS.fieldPackets
    ),
    customMapEngine: resolveCustomMapEngineFlag(env),
    routingProvider,
  };

  return {
    appEnvironment,
    isDev,
    featureFlags,
  };
};

export const isAdminStudioEnabled = (env = process.env) => (
  getRuntimeEnv(env).isDev
);

export const isFieldPacketsEnabled = (featureFlags = DEFAULT_RUNTIME_FEATURE_FLAGS) => (
  typeof featureFlags?.fieldPackets === "boolean"
    ? featureFlags.fieldPackets
    : RUNTIME_FEATURE_FLAGS.fieldPackets.defaultValue
);

export const isCustomMapEngineEnabled = (featureFlags = DEFAULT_RUNTIME_FEATURE_FLAGS) => (
  typeof featureFlags?.customMapEngine === "boolean"
    ? featureFlags.customMapEngine
    : RUNTIME_FEATURE_FLAGS.customMapEngine.defaultValue
);

export const getRuntimeRoutingProvider = (featureFlags = DEFAULT_RUNTIME_FEATURE_FLAGS) => {
  const provider = String(featureFlags?.routingProvider || "").trim().toLowerCase();
  return ROUTING_PROVIDER_RUNTIME.validValues.includes(provider)
    ? provider
    : ROUTING_PROVIDER_RUNTIME.defaultValue;
};

export const getMapEngineKind = (featureFlags = DEFAULT_RUNTIME_FEATURE_FLAGS) => (
  isCustomMapEngineEnabled(featureFlags) ? "custom" : "leaflet"
);

export const setStoredCustomMapEngineOverride = (isEnabled) => (
  writeStoredRuntimeOverride(
    CUSTOM_MAP_ENGINE_FLAG.storageKey,
    isEnabled ? "true" : "false"
  )
);

export const clearStoredCustomMapEngineOverride = () => (
  writeStoredRuntimeOverride(CUSTOM_MAP_ENGINE_FLAG.storageKey, null)
);

export const setStoredRoutingProviderOverride = (provider) => {
  const normalizedProvider = normalizeRoutingProvider(provider);
  if (!normalizedProvider) {
    return false;
  }

  const wroteProvider = writeStoredRuntimeOverride(
    ROUTING_PROVIDER_RUNTIME.storageKey,
    normalizedProvider
  );

  const wroteLegacyValue = writeStoredRuntimeOverride(
    ROUTING_PROVIDER_RUNTIME.legacy.storageKey,
    normalizedProvider === "local" ? "true" : "false"
  );

  return wroteProvider && wroteLegacyValue;
};

export const clearStoredRoutingProviderOverride = () => (
  writeStoredRuntimeOverride(ROUTING_PROVIDER_RUNTIME.storageKey, null) &&
  writeStoredRuntimeOverride(ROUTING_PROVIDER_RUNTIME.legacy.storageKey, null)
);

export const {
  appEnvironment: APP_ENVIRONMENT,
  isDev: IS_DEV,
  featureFlags: FEATURE_FLAGS,
} = getRuntimeEnv();
