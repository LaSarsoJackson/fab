import { describe, expect, test } from "bun:test";
import { readTourProgress, TOUR_PROGRESS_KEY, writeTourProgress } from "./tourProgress";

const createStorage = (initialValue = null) => {
  let value = initialValue;
  return {
    getItem: (key) => key === TOUR_PROGRESS_KEY ? value : null,
    setItem: (key, nextValue) => {
      if (key === TOUR_PROGRESS_KEY) value = nextValue;
    },
  };
};

describe("tour progress", () => {
  test("stores only the current tour and place identity", () => {
    const storage = createStorage();
    writeTourProgress({
      tourKey: "Notable",
      recordId: "tour:Notable:1:18:93",
      recordName: "James Hall",
      ignored: "not persisted",
    }, storage);

    expect(readTourProgress(storage)).toEqual({
      tourKey: "Notable",
      recordId: "tour:Notable:1:18:93",
      recordName: "James Hall",
    });
  });

  test("ignores malformed or incomplete saved progress", () => {
    expect(readTourProgress(createStorage("not json"))).toEqual({
      tourKey: "",
      recordId: "",
      recordName: "",
    });
    expect(readTourProgress(createStorage(JSON.stringify({ recordId: "orphan" })))).toEqual({
      tourKey: "",
      recordId: "",
      recordName: "",
    });
  });
});
