import { getDataModule, loadDataModule } from "../fab/profile";

export const EMPTY_MAP_FEATURE_COLLECTION = Object.freeze({
  type: "FeatureCollection",
  features: Object.freeze([]),
});

export const getEmptyCoreMapData = () => ({
  boundaryData: EMPTY_MAP_FEATURE_COLLECTION,
  roadsData: EMPTY_MAP_FEATURE_COLLECTION,
  sectionsData: EMPTY_MAP_FEATURE_COLLECTION,
});

export const normalizeMapFeatureCollection = (featureCollection = {}) => ({
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
