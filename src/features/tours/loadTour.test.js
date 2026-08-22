import { describe, expect, test } from "bun:test";
import { loadTour } from "./loadTour";

describe("loadTour ordering", () => {
  test("orders authored stops without changing their stable record IDs", async () => {
    const { records } = await loadTour("Notable");

    expect(records).toHaveLength(38);
    expect(records.slice(0, 3).map(({ id }) => id)).toEqual([
      "tour:Notable:1:18:93",
      "tour:Notable:2:18:105",
      "tour:Notable:55:18:31",
    ]);
    expect(new Set(records.map(({ id }) => id)).size).toBe(records.length);
  });

  test("leaves collection source order intact", async () => {
    const { records } = await loadTour("Lot7");

    expect(records.slice(0, 3).map(({ id }) => id)).toEqual([
      "tour:Lot7:1",
      "tour:Lot7:2",
      "tour:Lot7:3",
    ]);
  });

  test("does not infer an itinerary for a collection definition", async () => {
    const { records } = await loadTour("GAR");

    expect(records.slice(0, 3).map(({ id }) => id)).toEqual([
      "tour:GAR:Henry  Hallenbeck",
      "tour:GAR:William J. Clapper",
      "tour:GAR:William  Martin, Sr.",
    ]);
  });
});
