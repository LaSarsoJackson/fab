import { describe, expect, test } from "bun:test";

import { mergeImportedRows } from "../src/admin/excel";
import {
  buildModuleSnapshot,
  materializeSnapshotForExport,
  serializeSnapshotToFeatureCollection,
} from "../src/admin/geoJsonData";

const moduleDefinition = {
  id: "burials",
  label: "Burials",
};

const sourceFeatureCollection = {
  type: "FeatureCollection",
  name: "Geo_Burials",
  crs: {
    type: "name",
    properties: {
      name: "urn:ogc:def:crs:OGC:1.3:CRS84",
    },
  },
  features: [
    {
      type: "Feature",
      properties: {
        OBJECTID: 1,
        First_Name: "Anna",
        Last_Name: "Tracy",
        Section: 99,
        Lot: 18,
        Tier: 0,
        Grave: 0,
      },
      geometry: {
        type: "Point",
        coordinates: [-73.733659, 42.711919],
      },
    },
    {
      type: "Feature",
      properties: {
        OBJECTID: 2,
        First_Name: "Thomas",
        Last_Name: "Tracy",
        Section: 99,
        Lot: 18,
        Tier: 0,
        Grave: 1,
      },
      geometry: {
        type: "Point",
        coordinates: [-73.73366, 42.71192],
      },
    },
  ],
};

describe("admin geojson helpers", () => {
  test("builds a point-mode snapshot and preserves source metadata on export", () => {
    const snapshot = buildModuleSnapshot(moduleDefinition, sourceFeatureCollection);
    const serialized = serializeSnapshotToFeatureCollection(snapshot);

    expect(snapshot.geometryMode).toBe("point");
    expect(snapshot.primaryKey).toBe("OBJECTID");
    expect(snapshot.rows[0].longitude).toBe(-73.733659);
    expect(snapshot.rows[0].latitude).toBe(42.711919);
    expect(serialized.name).toBe("Geo_Burials");
    expect(serialized.crs).toEqual(sourceFeatureCollection.crs);
    expect(serialized.features[0].properties.First_Name).toBe("Anna");
  });

  test("merges workbook rows and assigns new primary keys during export materialization", () => {
    const snapshot = buildModuleSnapshot(moduleDefinition, sourceFeatureCollection);
    const merged = mergeImportedRows(snapshot, [
      {
        __admin_row_id: snapshot.rows[0].__admin_row_id,
        First_Name: "Anne",
      },
      {
        First_Name: "New",
        Last_Name: "Burial",
        Section: 75,
        Lot: 7,
        Tier: 0,
        Grave: 2,
        longitude: -73.72,
        latitude: 42.72,
      },
    ]);
    const materialized = materializeSnapshotForExport(merged);
    const serialized = serializeSnapshotToFeatureCollection(materialized);

    expect(serialized.features).toHaveLength(3);
    expect(serialized.features[0].properties.First_Name).toBe("Anne");
    expect(serialized.features[2].properties.OBJECTID).toBe(3);
    expect(serialized.features[2].geometry.coordinates).toEqual([-73.72, 42.72]);
  });
});
