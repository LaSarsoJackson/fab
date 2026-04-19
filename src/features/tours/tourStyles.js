import { APP_PROFILE } from "../../config/appProfile";

export const TOUR_STYLES = APP_PROFILE.features?.tours?.styles || {};

export const getTourStyle = (tourKey = "") => TOUR_STYLES[tourKey] || null;
