import { APP_PROFILE } from "../fab/profile";

export const TOUR_DEFINITIONS = APP_PROFILE.features?.tours?.definitions || [];
export const TOUR_STYLES = APP_PROFILE.features?.tours?.styles || {};

export * from "./tourDerivedData";
export * from "./tourRecordHarmonization";
