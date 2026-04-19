/**
 * Feature flags default toward stable user-facing behavior, while unfinished
 * runtime experiments remain opt-in through env or query overrides.
 */
const resolveBooleanFlag = (value, fallback = false) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const CUSTOM_MAP_ENGINE_STORAGE_KEY = "fab:enableCustomMapEngine";
const ROUTING_PROVIDER_STORAGE_KEY = "fab:routingProvider";
const LEGACY_CLIENT_SIDE_ROUTING_STORAGE_KEY = "fab:enableClientSideRouting";
const VALID_ROUTING_PROVIDERS = new Set(["api", "local", "valhalla"]);

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

const buildStickyFlagResolver = ({
  disabledQueryValues,
  enabledQueryValues,
  envKey,
  queryParamName,
  storageKey,
}) => (env, fallback = false) => resolveStickyRuntimeFlag({
  disabledQueryValues,
  enabledQueryValues,
  envValue: resolveBooleanFlag(env[envKey], fallback),
  queryParamName,
  storageKey,
});

const resolveCustomMapEngineFlag = buildStickyFlagResolver({
  envKey: "REACT_APP_ENABLE_CUSTOM_MAP_ENGINE",
  queryParamName: "mapEngine",
  storageKey: CUSTOM_MAP_ENGINE_STORAGE_KEY,
  enabledQueryValues: ["custom"],
  disabledQueryValues: ["leaflet"],
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
  const envProvider = normalizeRoutingProvider(env.REACT_APP_DEV_ROUTING_PROVIDER) || (
    resolveBooleanFlag(env.REACT_APP_ENABLE_CLIENT_SIDE_ROUTING, false)
      ? "local"
      : "api"
  );

  if (!isDev || typeof window === "undefined") {
    return isDev ? envProvider : "api";
  }

  const searchParams = new URLSearchParams(window.location.search);
  const queryProvider = normalizeRoutingProvider(searchParams.get("routing"));
  if (queryProvider) {
    return queryProvider;
  }

  const legacyQueryProvider = resolveLegacyClientSideRoutingOverride(
    searchParams.get("clientSideRouting")
  );
  if (legacyQueryProvider) {
    return legacyQueryProvider;
  }

  const storedProvider = normalizeRoutingProvider(
    readStoredRuntimeOverride(ROUTING_PROVIDER_STORAGE_KEY)
  );
  if (storedProvider) {
    return storedProvider;
  }

  const legacyStoredProvider = resolveLegacyClientSideRoutingOverride(
    readStoredRuntimeOverride(LEGACY_CLIENT_SIDE_ROUTING_STORAGE_KEY)
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
    fieldPackets: resolveBooleanFlag(env.REACT_APP_ENABLE_FIELD_PACKETS, true),
    fabTours: resolveBooleanFlag(env.REACT_APP_ENABLE_FAB_TOURS, true),
    fabRecordPresentation: resolveBooleanFlag(env.REACT_APP_ENABLE_FAB_RECORD_PRESENTATION, true),
    customMapEngine: resolveCustomMapEngineFlag(env, false),
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

export const setStoredCustomMapEngineOverride = (isEnabled) => (
  writeStoredRuntimeOverride(
    CUSTOM_MAP_ENGINE_STORAGE_KEY,
    isEnabled ? "true" : "false"
  )
);

export const clearStoredCustomMapEngineOverride = () => (
  writeStoredRuntimeOverride(CUSTOM_MAP_ENGINE_STORAGE_KEY, null)
);

export const setStoredRoutingProviderOverride = (provider) => {
  const normalizedProvider = normalizeRoutingProvider(provider);
  if (!normalizedProvider) {
    return false;
  }

  const wroteProvider = writeStoredRuntimeOverride(
    ROUTING_PROVIDER_STORAGE_KEY,
    normalizedProvider
  );

  const wroteLegacyValue = writeStoredRuntimeOverride(
    LEGACY_CLIENT_SIDE_ROUTING_STORAGE_KEY,
    normalizedProvider === "local" ? "true" : "false"
  );

  return wroteProvider && wroteLegacyValue;
};

export const clearStoredRoutingProviderOverride = () => (
  writeStoredRuntimeOverride(ROUTING_PROVIDER_STORAGE_KEY, null) &&
  writeStoredRuntimeOverride(LEGACY_CLIENT_SIDE_ROUTING_STORAGE_KEY, null)
);

export const {
  appEnvironment: APP_ENVIRONMENT,
  isDev: IS_DEV,
  featureFlags: FEATURE_FLAGS,
} = getRuntimeEnv();
