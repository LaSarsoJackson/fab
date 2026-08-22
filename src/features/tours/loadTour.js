import { FAB_TOUR_DEFINITIONS } from "../fab/tours";
import { buildTourRecord } from "./tourRecords";
import { orderTourRecords } from "./tourOrdering";

const tourCache = new Map();

export const findTourDefinition = (value = "") => {
  const requested = String(value || "").trim().toLocaleLowerCase();
  if (!requested) return null;
  return FAB_TOUR_DEFINITIONS.find(({ key, name }) => (
    key.toLocaleLowerCase() === requested || name.toLocaleLowerCase() === requested
  )) || null;
};

export const loadTour = async (value) => {
  const definition = findTourDefinition(value);
  if (!definition) throw new Error(`Unknown cemetery tour: ${value}`);

  if (!tourCache.has(definition.key)) {
    const request = definition.load()
      .then((module) => {
        const collection = module.default || module;
        const records = (collection.features || [])
          .map((feature) => buildTourRecord(feature, {
            tourKey: definition.key,
            tourName: definition.name,
          }))
          .filter((record) => (
            Array.isArray(record.coordinates) &&
            record.coordinates.every(Number.isFinite)
          ));
        return {
          definition,
          records: orderTourRecords(records, definition),
        };
      })
      .catch((error) => {
        tourCache.delete(definition.key);
        throw error;
      });
    tourCache.set(definition.key, request);
  }

  return tourCache.get(definition.key);
};
