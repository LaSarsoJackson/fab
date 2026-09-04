import notables from "../../data/NotablesTour20.json";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";
import { buildTourRecord } from "../tours/tourRecords";
import { FAB_TOUR_DEFINITIONS } from "./tours";

const definition = FAB_TOUR_DEFINITIONS.find(({ key }) => key === "Notable");

// Use the same names, positions, and record links as the published tour.
export const MAP_LANDMARKS = notables.features
  .map((feature) => buildTourRecord(feature, {
    tourKey: definition.key,
    tourName: definition.name,
  }))
  .filter(({ coordinates }) => isCoordinatePairValid(coordinates));
