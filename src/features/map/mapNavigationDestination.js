import { formatBrowseResultName } from "../browse/browseResults";
import { cleanRecordValue } from "./mapRecordPresentation";

const NAVIGATION_DESTINATION_STORAGE_KEY = "fab.navigationDestination.v1";

const isFiniteCoordinateValue = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  return Number.isFinite(Number(value));
};

export const hasBurialNavigationCoordinates = (burial) => (
  Array.isArray(burial?.coordinates) &&
  isFiniteCoordinateValue(burial.coordinates[0]) &&
  isFiniteCoordinateValue(burial.coordinates[1])
);

export const createNavigationDestinationRecord = (burial) => {
  if (!hasBurialNavigationCoordinates(burial)) {
    return null;
  }

  const displayName = formatBrowseResultName(burial);

  return {
    id: cleanRecordValue(burial.id) || `navigation:${burial.coordinates[0]},${burial.coordinates[1]}`,
    source: burial.source || "navigation",
    displayName,
    label: burial.label || displayName,
    fullName: burial.fullName || displayName,
    First_Name: burial.First_Name || "",
    Last_Name: burial.Last_Name || "",
    Section: burial.Section || burial.section || "",
    Lot: burial.Lot || burial.lot || "",
    Tier: burial.Tier || burial.tier || "",
    Grave: burial.Grave || burial.grave || "",
    Birth: burial.Birth || burial.birth || "",
    Death: burial.Death || burial.death || "",
    coordinates: [Number(burial.coordinates[0]), Number(burial.coordinates[1])],
    title: burial.title || burial.tourKey || "",
    tourKey: burial.tourKey || burial.title || "",
    tourName: burial.tourName || "",
    savedAt: Number.isFinite(Number(burial.savedAt)) ? Number(burial.savedAt) : Date.now(),
  };
};

export const readStoredNavigationDestination = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(NAVIGATION_DESTINATION_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    return createNavigationDestinationRecord(JSON.parse(storedValue));
  } catch (error) {
    console.warn("Unable to restore saved navigation destination:", error);
    return null;
  }
};

export const writeStoredNavigationDestination = (burial) => {
  if (typeof window === "undefined") {
    return null;
  }

  const destination = createNavigationDestinationRecord(burial);
  if (!destination) {
    return null;
  }

  try {
    window.localStorage.setItem(NAVIGATION_DESTINATION_STORAGE_KEY, JSON.stringify(destination));
  } catch (error) {
    console.warn("Unable to save navigation destination:", error);
  }

  return destination;
};

export const clearStoredNavigationDestination = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(NAVIGATION_DESTINATION_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear saved navigation destination:", error);
  }
};
