import { describe, expect, test } from "bun:test";
import { formatRecordLocation, inflateBurialRow, recordsToFeatureCollection } from "./burialRecords";

describe("burial record delivery shape", () => {
  const row = {
    i: 12,
    f: "Jane",
    l: "Doe",
    s: "4",
    lo: "8",
    g: "2",
    t: "0",
    b: "1900",
    d: "1980",
    tk: "Notable",
    tn: "Notables Tour 2020",
    p: "Doe12a.jpg",
    u: "Doe12",
    x: "Cemetery historian",
    c: [-73.73, 42.7],
  };

  test("inflates the compact generated row at the UI boundary", () => {
    const record = inflateBurialRow(row);
    expect(record).toMatchObject({
      id: "12",
      displayName: "Jane Doe",
      section: "4",
      tourName: "Notables Tour 2020",
      portraitImageName: "Doe12a.jpg",
      biographyLink: "Doe12",
      extraTitle: "Cemetery historian",
    });
    expect(formatRecordLocation(record)).toBe("Section 4 · Lot 8 · Grave 2");
  });

  test("creates renderer-neutral GeoJSON", () => {
    const collection = recordsToFeatureCollection([inflateBurialRow(row)]);
    expect(collection.features[0]).toMatchObject({
      id: "12",
      geometry: { type: "Point", coordinates: [-73.73, 42.7] },
    });
  });
});
