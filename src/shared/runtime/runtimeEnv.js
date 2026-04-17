/**
 * Feature flags default toward visibility in development so unfinished flows
 * can be exercised locally, but stay opt-in in production.
 */
const resolveBooleanFlag = (value, fallback = false) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const CUSTOM_MAP_ENGINE_STORAGE_KEY = "fab:enableCustomMapEngine";

const readStoredRuntimeOverride = (storageKey) => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage?.getItem?.(storageKey) ?? null;
  } catch (error) {
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
  } catch (error) {
    return false;
  }
};

const resolveCustomMapEngineFlag = (env, fallback = false) => {
  const envValue = resolveBooleanFlag(env.REACT_APP_ENABLE_CUSTOM_MAP_ENGINE, fallback);

  if (typeof window === "undefined") {
    return envValue;
  }

  // Runtime overrides are intentionally ordered from most explicit to least
  // explicit so a one-off URL can beat sticky local dev preferences.
  const searchParams = new URLSearchParams(window.location.search);
  const runtimeOverride = searchParams.get("mapEngine");

  if (runtimeOverride === "custom") {
    return true;
  }

  if (runtimeOverride === "leaflet") {
    return false;
  }

  const storedOverride = readStoredRuntimeOverride(CUSTOM_MAP_ENGINE_STORAGE_KEY);
  if (storedOverride === "true" || storedOverride === "false") {
    return resolveBooleanFlag(storedOverride, envValue);
  }

  return envValue;
};

export const getRuntimeEnv = (env = process.env) => {
  const appEnvironment = env.REACT_APP_ENVIRONMENT === "production"
    ? "production"
    : "development";
  const isDev = appEnvironment !== "production";
  const featureFlags = {
    fieldPackets: resolveBooleanFlag(env.REACT_APP_ENABLE_FIELD_PACKETS, isDev),
    fabTours: resolveBooleanFlag(env.REACT_APP_ENABLE_FAB_TOURS, true),
    fabRecordPresentation: resolveBooleanFlag(env.REACT_APP_ENABLE_FAB_RECORD_PRESENTATION, true),
    customMapEngine: resolveCustomMapEngineFlag(env, false),
  };

  return {
    appEnvironment,
    isDev,
    featureFlags,
  };
};

export const setStoredCustomMapEngineOverride = (isEnabled) => (
  writeStoredRuntimeOverride(
    CUSTOM_MAP_ENGINE_STORAGE_KEY,
    isEnabled ? "true" : "false"
  )
);

export const clearStoredCustomMapEngineOverride = () => (
  writeStoredRuntimeOverride(CUSTOM_MAP_ENGINE_STORAGE_KEY, null)
);

export const {
  appEnvironment: APP_ENVIRONMENT,
  isDev: IS_DEV,
  featureFlags: FEATURE_FLAGS,
} = getRuntimeEnv();
