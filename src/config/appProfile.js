import { FAB_APP_PROFILE } from "../features/fab/profile";

export const APP_PROFILE = FAB_APP_PROFILE;
export const APP_DATA_MODULES = APP_PROFILE.dataModules || [];
export const APP_TOUR_FEATURE = APP_PROFILE.features?.tours || null;
export const APP_TOUR_DEFINITIONS = APP_TOUR_FEATURE?.definitions || [];
export const APP_TOUR_STYLES = APP_TOUR_FEATURE?.styles || {};

export const getAppFeature = (featureKey) => APP_PROFILE.features?.[featureKey] || null;
