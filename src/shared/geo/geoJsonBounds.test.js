import ProjectedSec75Headstones from "../../data/Projected_Sec75_Headstones.json";
import ProjectedSec49Headstones from "../../data/Projected_Sec49_Headstones.json";
import NotablesTour20 from "../../data/NotablesTour20.json";
import IndependenceTour20 from "../../data/IndependenceTour20.json";
import AfricanAmericanTour20 from "../../data/AfricanAmericanTour20.json";
import ArtistTour20 from "../../data/ArtistTour20.json";
import AssociationsTour20 from "../../data/AssociationsTour20.json";
import AuthorsPublishersTour20 from "../../data/AuthorsPublishersTour20.json";
import BusinessFinanceTour20 from "../../data/BusinessFinanceTour20.json";
import CivilWarTour20 from "../../data/CivilWarTour20.json";
import SocietyPillarsTour20 from "../../data/SocietyPillarsTour20.json";
import AlbanyMayors from "../../data/AlbanyMayors_fixed.json";
import GAR from "../../data/GAR_fixed.json";
import {
  getGeoJsonBounds,
  hasValidGeoJsonCoordinates,
  isLatLngBoundsExpressionValid,
} from "./geoJsonBounds";

const TOUR_DATASETS = [
  ["Lot7", "Soldier's Lot (Section 75, Lot 7)", ProjectedSec75Headstones],
  ["Sec49", "Section 49", ProjectedSec49Headstones],
  ["Notable", "Notables Tour 2020", NotablesTour20],
  ["Indep", "Independence Tour 2020", IndependenceTour20],
  ["Afr", "African American Tour 2020", AfricanAmericanTour20],
  ["Art", "Artists Tour 2020", ArtistTour20],
  ["Groups", "Associations, Societies, & Groups Tour 2020", AssociationsTour20],
  ["AuthPub", "Authors & Publishers Tour 2020", AuthorsPublishersTour20],
  ["Business", "Business & Finance Tour 2020", BusinessFinanceTour20],
  ["CivilWar", "Civil War Tour 2020", CivilWarTour20],
  ["Pillars", "Pillars of Society Tour 2020", SocietyPillarsTour20],
  ["MayorsOfAlbany", "Mayors of Albany", AlbanyMayors],
  ["GAR", "Grand Army of the Republic", GAR],
];

describe("geoJsonBounds", () => {
  test("returns finite bounds for Section 49", () => {
    const bounds = getGeoJsonBounds(ProjectedSec49Headstones);

    expect(isLatLngBoundsExpressionValid(bounds)).toBe(true);
    expect(bounds).toEqual([
      [42.709505611726321, -73.73506796773583],
      [42.710218212461292, -73.73417853605521],
    ]);
  });

  test("returns finite bounds for every bundled tour dataset", () => {
    TOUR_DATASETS.forEach(([key, name, dataset]) => {
      const bounds = getGeoJsonBounds(dataset);

      expect(isLatLngBoundsExpressionValid(bounds)).toBe(true);
      expect(bounds).not.toBeNull();
      expect(bounds[0][0]).toBeLessThanOrEqual(bounds[1][0]);
      expect(bounds[0][1]).toBeLessThanOrEqual(bounds[1][1]);
    });
  });

  test("ignores malformed coordinate pairs instead of producing invalid bounds", () => {
    const geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-73.73506796773583, 42.709590442672535],
          },
        },
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-1.7976931348623157e+308, 42.70616836452322],
          },
        },
      ],
    };

    expect(getGeoJsonBounds(geoJson)).toEqual([
      [42.709590442672535, -73.73506796773583],
      [42.709590442672535, -73.73506796773583],
    ]);
  });

  test("flags Section 49's known out-of-range records as invalid", () => {
    expect(hasValidGeoJsonCoordinates(ProjectedSec49Headstones.features[284])).toBe(false);
    expect(hasValidGeoJsonCoordinates(ProjectedSec49Headstones.features[377])).toBe(false);
  });
});
