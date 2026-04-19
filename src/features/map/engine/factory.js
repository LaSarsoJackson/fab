import {
  CUSTOM_MAP_RUNTIME_KIND,
  LEAFLET_ADAPTER_RUNTIME_KIND,
  MAP_RUNTIME_KINDS,
} from "./contracts";
import { createCustomMapRuntime } from "./customRuntime";
import { createLeafletMapRuntime } from "./leafletRuntime";

const resolveLeafletMap = (options = {}) => (
  options.leafletMap ||
  options.rawMap ||
  options.map ||
  null
);

const MAP_RUNTIME_FACTORIES = {
  [CUSTOM_MAP_RUNTIME_KIND]: (options = {}) => createCustomMapRuntime(options),
  [LEAFLET_ADAPTER_RUNTIME_KIND]: (options = {}) => {
    const leafletMap = resolveLeafletMap(options);
    if (!leafletMap) {
      throw new Error(
        "createMapRuntime('leaflet-adapter') requires { leafletMap }, { rawMap }, or { map }."
      );
    }

    return createLeafletMapRuntime(leafletMap);
  },
};

export const getMapRuntimeFactory = (runtimeKind = "") => (
  MAP_RUNTIME_FACTORIES[runtimeKind] || null
);

export const supportsMapRuntimeKind = (runtimeKind = "") => (
  MAP_RUNTIME_KINDS.includes(runtimeKind)
);

export const createMapRuntime = (runtimeKind = "", options = {}) => {
  const factory = getMapRuntimeFactory(runtimeKind);
  if (!factory) {
    throw new Error(
      `Unsupported map runtime kind "${runtimeKind}". Supported kinds: ${MAP_RUNTIME_KINDS.join(", ")}.`
    );
  }

  return factory(options);
};
