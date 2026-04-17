import {
  getMapBackendDescriptor,
  getMapOverlaySourceSpecs,
  getOptimizationArtifactsByRole,
  getMapStorageStrategy,
} from "./backend";
import {
  MAP_LAYER_KINDS,
  MAP_RUNTIME_API_VERSION,
  MAP_RUNTIME_EVENTS,
} from "./contracts";

export const MAP_ENGINE_MANIFEST_VERSION = 1;

const CUSTOM_RUNTIME_KIND = "custom";
const LEAFLET_ADAPTER_KIND = "leaflet-adapter";

export const getMapEngineManifest = (appProfile = {}) => {
  const backendDescriptor = getMapBackendDescriptor(appProfile);
  const storageStrategy = getMapStorageStrategy(appProfile);
  const overlaySources = getMapOverlaySourceSpecs(appProfile);
  const searchArtifacts = getOptimizationArtifactsByRole(appProfile, "search-index");
  const deliveryArtifacts = getOptimizationArtifactsByRole(appProfile, "delivery-overlay");

  return {
    manifestVersion: MAP_ENGINE_MANIFEST_VERSION,
    engineId: `${appProfile.id || "app"}-custom-map-engine`,
    engineName: `${appProfile.productName || "App"} Custom Map Engine`,
    runtimeApiVersion: MAP_RUNTIME_API_VERSION,
    backendApiVersion: backendDescriptor.apiVersion,
    runtimeKinds: [CUSTOM_RUNTIME_KIND, LEAFLET_ADAPTER_KIND],
    runtimeEvents: [...MAP_RUNTIME_EVENTS],
    layerKinds: [...MAP_LAYER_KINDS],
    appNeeds: [
      {
        id: "burial-search-popup",
        label: "Burial search selection and popup inspection",
        status: "shipped",
        runtimeKinds: [CUSTOM_RUNTIME_KIND, LEAFLET_ADAPTER_KIND],
      },
      {
        id: "section-browse",
        label: "Section polygon browsing, scoped results, and section marker toggles",
        status: "shipped",
        runtimeKinds: [CUSTOM_RUNTIME_KIND, LEAFLET_ADAPTER_KIND],
      },
      {
        id: "tour-stops",
        label: "Tour stop selection and popup inspection",
        status: "shipped",
        runtimeKinds: [CUSTOM_RUNTIME_KIND, LEAFLET_ADAPTER_KIND],
      },
      {
        id: "mobile-selected-actions",
        label: "Mobile selected-person actions and bottom-sheet coordination",
        status: "shipped",
        runtimeKinds: [CUSTOM_RUNTIME_KIND, LEAFLET_ADAPTER_KIND],
      },
      {
        id: "deep-links",
        label: "Deep-link restoration into selected records and viewport state",
        status: "shipped",
        runtimeKinds: [CUSTOM_RUNTIME_KIND, LEAFLET_ADAPTER_KIND],
      },
      {
        id: "static-geoparquet-builds",
        label: "GeoParquet-backed static search-index and artifact generation",
        status: "shipped",
        runtimeKinds: ["build-backend"],
      },
      {
        id: "on-map-routing",
        label: "GraphHopper on-map routing",
        status: "adapter-backed",
        runtimeKinds: [LEAFLET_ADAPTER_KIND],
      },
      {
        id: "live-geolocation",
        label: "Live location controls and device geolocation",
        status: "adapter-backed",
        runtimeKinds: [LEAFLET_ADAPTER_KIND],
      },
      {
        id: "authoring-editing",
        label: "Interactive layer authoring, drawing, and editing",
        status: "deferred",
        runtimeKinds: [],
      },
    ],
    runtimeSelection: {
      featureFlag: "customMapEngine",
      envVar: "REACT_APP_ENABLE_CUSTOM_MAP_ENGINE",
      queryOverride: "mapEngine=custom|leaflet",
      stickyStorageKey: "fab:enableCustomMapEngine",
      defaultRuntimeKind: LEAFLET_ADAPTER_KIND,
    },
    basemapRegistry: {
      defaultBasemapId: appProfile.map?.defaultBasemapId || "",
      preferredDeliveryFormat: storageStrategy.preferredDeliveryFormat,
      overlaySourceIds: overlaySources.map((source) => source.id),
    },
    dataBackend: {
      ...backendDescriptor,
      sourceOfTruthFormat: storageStrategy.sourceOfTruthFormat,
      preferredBuildSourceFormat: storageStrategy.preferredBuildSourceFormat,
      searchArtifactIds: searchArtifacts.map((artifact) => artifact.id),
      deliveryArtifactIds: deliveryArtifacts.map((artifact) => artifact.id),
    },
    operationalCommands: {
      describe: "bun run describe:map-engine",
      buildData: "bun run build:data",
      buildGeoParquet: "bun run build:geoparquet",
      validateGeoParquet: "bun run validate:geoparquet",
      buildPmtiles: "bun run build:pmtiles",
      test: "bun run test",
      testE2E: "bun run test:e2e",
    },
  };
};
