import { APP_TOUR_STYLES } from "../../config/appProfile";

export const TOUR_STYLES = APP_TOUR_STYLES;

export const getTourStyle = (tourKey = "") => TOUR_STYLES[tourKey] || null;
