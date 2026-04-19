import { describe, expect, test } from "bun:test";

import {
  formatModuleCount,
  getGridColumns,
  getSearchKeys,
  groupModulesByGroup,
  updateSetMembership,
  upsertDraftSnapshot,
} from "../src/admin/adminAppState";
import { buildModuleSnapshot, getAdminRowIdField } from "../src/admin/geoJsonData";

const adminRowIdField = getAdminRowIdField();

const pointModuleDefinition = {
  id: "burials",
  label: "Burials",
};

const pointFeatureCollection = {
  type: "FeatureCollection",
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
        Titles: "Founder",
        Tour_Bio: "Historic figure",
        ARC_GeoID: "A-1",
        Notes: "North edge",
        Epitaph: "Remembered",
        Occupation: "Teacher",
        Status: "Active",
        Family: "Tracy",
        Nickname: "Annie",
        ExtraA: "A",
        ExtraB: "B",
        ExtraC: "C",
      },
      geometry: {
        type: "Point",
        coordinates: [-73.733659, 42.711919],
      },
    },
  ],
};

const geoJsonModuleDefinition = {
  id: "roads",
  label: "Roads",
};

const geoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        OBJECTID: 10,
        Name: "Main Path",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.73, 42.71],
          [-73.72, 42.72],
        ],
      },
    },
  ],
};

describe("admin app state helpers", () => {
  test("selects prioritized search keys before fallback fields", () => {
    const snapshot = buildModuleSnapshot(pointModuleDefinition, pointFeatureCollection);

    expect(getSearchKeys(snapshot)).toEqual([
      "First_Name",
      "Last_Name",
      "Section",
      "Lot",
      "Tier",
      "Grave",
      "Titles",
      "Tour_Bio",
      "ARC_GeoID",
      "OBJECTID",
      "Epitaph",
      "ExtraA",
      "ExtraB",
      "ExtraC",
      "Family",
      "Nickname",
      "Notes",
    ]);
  });

  test("builds grid columns without hidden or raw geometry-json fields", () => {
    const snapshot = buildModuleSnapshot(geoJsonModuleDefinition, geoJsonFeatureCollection);
    const columns = getGridColumns(snapshot);

    expect(columns.map((column) => column.field)).toEqual([
      "__geometry_type",
      "OBJECTID",
      "Name",
    ]);
    expect(columns[0].minWidth).toBe(130);
    expect(columns[1].valueGetter({ row: snapshot.rows[0] })).toBe(10);
  });

  test("formats module counts with a safe empty fallback", () => {
    const snapshot = buildModuleSnapshot(pointModuleDefinition, pointFeatureCollection);

    expect(formatModuleCount(snapshot)).toBe("1 records");
    expect(formatModuleCount(null)).toBe("Not loaded");
  });

  test("updates set membership without mutating the previous set", () => {
    const original = new Set(["burials"]);
    const added = updateSetMembership(original, "roads", true);
    const removed = updateSetMembership(original, "burials", false);

    expect(Array.from(original)).toEqual(["burials"]);
    expect(Array.from(added)).toEqual(["burials", "roads"]);
    expect(Array.from(removed)).toEqual([]);
  });

  test("upserts draft rows and extends the snapshot schema for new fields", () => {
    const snapshot = buildModuleSnapshot(pointModuleDefinition, pointFeatureCollection);
    const updated = upsertDraftSnapshot(snapshot, {
      [adminRowIdField]: snapshot.rows[0][adminRowIdField],
      First_Name: "Anne",
      Notes: "Updated note",
    });
    const inserted = upsertDraftSnapshot(snapshot, {
      [adminRowIdField]: "burials:feature:new",
      First_Name: "New",
      Last_Name: "Record",
      Legacy_Id: "L-1",
    });

    expect(updated.rows[0].First_Name).toBe("Anne");
    expect(updated.rows[0].Notes).toBe("Updated note");
    expect(inserted.rows).toHaveLength(2);
    expect(inserted.rows[1].Legacy_Id).toBe("L-1");
    expect(inserted.schema.some((field) => field.key === "Legacy_Id")).toBe(true);
  });

  test("groups modules by their declared group", () => {
    expect(groupModulesByGroup([
      { id: "burials", group: "Map layers" },
      { id: "roads", group: "Map layers" },
      { id: "tours", group: "Tours" },
    ])).toEqual({
      "Map layers": [
        { id: "burials", group: "Map layers" },
        { id: "roads", group: "Map layers" },
      ],
      Tours: [
        { id: "tours", group: "Tours" },
      ],
    });
  });
});
