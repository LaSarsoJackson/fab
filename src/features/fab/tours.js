import tourBiographyAliases from "../../data/TourBiographyAliases.json";
import {
  resolveBiographyReferenceFromAliases,
  resolvePortraitImageName,
} from "../tours/tourDerivedData";

export const FAB_TOUR_DEFINITIONS = [
  {
    key: "Lot7",
    name: "Soldier's Lot (Section 75, Lot 7)",
    fileName: "Projected_Sec75_Headstones.json",
    sourcePath: "src/data/Projected_Sec75_Headstones.json",
    load: () => import("../../data/Projected_Sec75_Headstones.json"),
  },
  {
    key: "Sec49",
    name: "Section 49",
    fileName: "Projected_Sec49_Headstones.json",
    sourcePath: "src/data/Projected_Sec49_Headstones.json",
    load: () => import("../../data/Projected_Sec49_Headstones.json"),
  },
  {
    key: "Notable",
    name: "Notables Tour 2020",
    fileName: "NotablesTour20.json",
    sourcePath: "src/data/NotablesTour20.json",
    load: () => import("../../data/NotablesTour20.json"),
  },
  {
    key: "Indep",
    name: "Independence Tour 2020",
    fileName: "IndependenceTour20.json",
    sourcePath: "src/data/IndependenceTour20.json",
    load: () => import("../../data/IndependenceTour20.json"),
  },
  {
    key: "Afr",
    name: "African American Tour 2020",
    fileName: "AfricanAmericanTour20.json",
    sourcePath: "src/data/AfricanAmericanTour20.json",
    load: () => import("../../data/AfricanAmericanTour20.json"),
  },
  {
    key: "Art",
    name: "Artists Tour 2020",
    fileName: "ArtistTour20.json",
    sourcePath: "src/data/ArtistTour20.json",
    load: () => import("../../data/ArtistTour20.json"),
  },
  {
    key: "Groups",
    name: "Associations, Societies, & Groups Tour 2020",
    fileName: "AssociationsTour20.json",
    sourcePath: "src/data/AssociationsTour20.json",
    load: () => import("../../data/AssociationsTour20.json"),
  },
  {
    key: "AuthPub",
    name: "Authors & Publishers Tour 2020",
    fileName: "AuthorsPublishersTour20.json",
    sourcePath: "src/data/AuthorsPublishersTour20.json",
    load: () => import("../../data/AuthorsPublishersTour20.json"),
  },
  {
    key: "Business",
    name: "Business & Finance Tour 2020",
    fileName: "BusinessFinanceTour20.json",
    sourcePath: "src/data/BusinessFinanceTour20.json",
    load: () => import("../../data/BusinessFinanceTour20.json"),
  },
  {
    key: "CivilWar",
    name: "Civil War Tour 2020",
    fileName: "CivilWarTour20.json",
    sourcePath: "src/data/CivilWarTour20.json",
    load: () => import("../../data/CivilWarTour20.json"),
  },
  {
    key: "Pillars",
    name: "Pillars of Society Tour 2020",
    fileName: "SocietyPillarsTour20.json",
    sourcePath: "src/data/SocietyPillarsTour20.json",
    load: () => import("../../data/SocietyPillarsTour20.json"),
  },
  {
    key: "MayorsOfAlbany",
    name: "Mayors of Albany",
    fileName: "AlbanyMayors_fixed.json",
    sourcePath: "src/data/AlbanyMayors_fixed.json",
    load: () => import("../../data/AlbanyMayors_fixed.json"),
  },
  {
    key: "GAR",
    name: "Grand Army of the Republic",
    fileName: "GAR_fixed.json",
    sourcePath: "src/data/GAR_fixed.json",
    load: () => import("../../data/GAR_fixed.json"),
  },
];

const FAB_TOUR_COLOR_OVERRIDES = {
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

export const FAB_TOUR_STYLES = Object.fromEntries(
  FAB_TOUR_DEFINITIONS.map((definition, index) => [
    definition.key,
    {
      name: definition.name,
      color: FAB_TOUR_COLOR_OVERRIDES[definition.key] || FALLBACK_TOUR_COLORS[index % FALLBACK_TOUR_COLORS.length],
    },
  ])
);

export const enrichFabTourRecord = (record = {}) => {
  const portraitImageName = resolvePortraitImageName(record);
  const biographyLink = resolveBiographyReferenceFromAliases(
    {
      ...record,
      portraitImageName,
    },
    tourBiographyAliases
  );

  return {
    portraitImageName,
    biographyLink,
  };
};
