import { TOUR_DEFINITIONS } from "./tourDefinitions";

const TOUR_COLOR_OVERRIDES = {
  Lot7: "#7587ff",
  Sec49: "#75ff87",
  Notable: "#ff7700",
  Indep: "#7700ff",
  Afr: "#eedd00",
  Art: "#ff4277",
  Groups: "#86cece",
  AuthPub: "#996038",
  Business: "#558e76",
  CivilWar: "#a0a0a0",
  Pillars: "#d10008",
  MayorsOfAlbany: "#ff00dd",
  GAR: "#000080",
};

const FALLBACK_TOUR_COLORS = [
  "#2f6f8f",
  "#8a5a44",
  "#5c7a29",
  "#935f2e",
  "#6b6d76",
];

export const TOUR_STYLES = Object.fromEntries(
  TOUR_DEFINITIONS.map((definition, index) => [
    definition.key,
    {
      name: definition.name,
      color: TOUR_COLOR_OVERRIDES[definition.key] || FALLBACK_TOUR_COLORS[index % FALLBACK_TOUR_COLORS.length],
    },
  ])
);

export const getTourStyle = (tourKey = "") => TOUR_STYLES[tourKey] || null;
