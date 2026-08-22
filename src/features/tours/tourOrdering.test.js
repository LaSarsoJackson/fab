import { describe, expect, test } from "bun:test";
import { orderTourRecords } from "./tourOrdering";

const record = (id, coordinates) => ({ id, coordinates });

describe("orderTourRecords", () => {
  test("keeps the authored first stop and walks to the nearest remaining stop", () => {
    const records = [
      record("start", [-73.731, 42.708]),
      record("far", [-73.735, 42.708]),
      record("near", [-73.7311, 42.708]),
      record("last", [-73.7312, 42.708]),
    ];

    expect(orderTourRecords(records, { kind: "tour" }).map(({ id }) => id))
      .toEqual(["start", "near", "last", "far"]);
  });

  test("uses source order for collections and untyped definitions", () => {
    const records = [
      record("first", [-73.731, 42.708]),
      record("second", [-73.735, 42.708]),
      record("third", [-73.7311, 42.708]),
    ];

    expect(orderTourRecords(records, { kind: "collection" })).toBe(records);
    expect(orderTourRecords(records)).toBe(records);
  });

  test("breaks equal-distance ties by source order", () => {
    const records = [
      record("start", [-73.731, 42.708]),
      record("east", [-73.7309, 42.708]),
      record("west", [-73.7311, 42.708]),
    ];

    expect(orderTourRecords(records, { kind: "tour" }).map(({ id }) => id))
      .toEqual(["start", "east", "west"]);
  });

  test("does not change short tours", () => {
    const records = [
      record("first", [-73.731, 42.708]),
      record("second", [-73.735, 42.708]),
    ];

    expect(orderTourRecords(records, { kind: "tour" })).toBe(records);
  });
});
