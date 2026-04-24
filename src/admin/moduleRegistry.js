import { APP_PROFILE } from "../features/fab/profile";

export const DATA_MODULES = APP_PROFILE.dataModules || [];

export const getDataModule = (moduleId) => (
  DATA_MODULES.find((definition) => definition.id === moduleId) || null
);

export const loadDataModule = async (moduleDefinition) => {
  const loaded = await moduleDefinition.load();
  return loaded.default || loaded;
};

export const getTourModuleDefinitions = () => (
  DATA_MODULES.filter((definition) => definition.kind === "tour")
);
