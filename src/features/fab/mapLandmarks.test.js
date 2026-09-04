import { describe, expect, test } from "bun:test";
import { loadTour } from "../tours/loadTour";
import { MAP_LANDMARKS } from "./mapLandmarks";

describe("cemetery landmark labels", () => {
  test("open the same records and coordinates as the Notables Tour", async () => {
    const { records } = await loadTour("Notable");
    expect(MAP_LANDMARKS).toHaveLength(records.length);
    for (const landmark of MAP_LANDMARKS) {
      expect(landmark).toEqual(records.find(({ id }) => id === landmark.id));
    }
    expect(MAP_LANDMARKS.find(({ displayName }) => displayName === "President Chester A. Arthur")?.id)
      .toBe("tour:Notable:18:24:8");
  });
});
