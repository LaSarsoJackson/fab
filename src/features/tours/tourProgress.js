const TOUR_PROGRESS_KEY = "fab.tour-progress.v1";
const EMPTY_PROGRESS = Object.freeze({ tourKey: "", recordId: "", recordName: "" });

const clean = (value) => String(value || "").trim();

export const readTourProgress = (storage) => {
  try {
    const targetStorage = storage === undefined ? globalThis.localStorage : storage;
    const stored = JSON.parse(targetStorage?.getItem(TOUR_PROGRESS_KEY) || "null");
    const tourKey = clean(stored?.tourKey);
    if (!tourKey) return EMPTY_PROGRESS;
    return {
      tourKey,
      recordId: clean(stored?.recordId),
      recordName: clean(stored?.recordName),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
};

export const writeTourProgress = (progress, storage) => {
  const next = {
    tourKey: clean(progress?.tourKey),
    recordId: clean(progress?.recordId),
    recordName: clean(progress?.recordName),
  };
  if (!next.tourKey) return EMPTY_PROGRESS;
  try {
    const targetStorage = storage === undefined ? globalThis.localStorage : storage;
    targetStorage?.setItem(TOUR_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // Progress persistence is optional in restricted browser contexts.
  }
  return next;
};

export { TOUR_PROGRESS_KEY };
