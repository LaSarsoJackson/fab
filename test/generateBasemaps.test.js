import { describe, expect, test } from "bun:test";

import {
  assertBasemapDownloadUrlAllowed,
  normalizeDownloadUrl,
} from "../scripts/generate-basemaps.js";

const SOURCE_EXPORT_URL = "https://orthos.its.ny.gov/arcgis/rest/services/wms/Latest/MapServer/export";

describe("generate-basemaps", () => {
  test("normalizes legacy http basemap download URLs to https", () => {
    expect(normalizeDownloadUrl("http://orthos.its.ny.gov/arcgis/rest/output/map.jpg")).toBe(
      "https://orthos.its.ny.gov/arcgis/rest/output/map.jpg"
    );
  });

  test("allows same-origin https basemap download URLs", () => {
    expect(() => {
      assertBasemapDownloadUrlAllowed(
        "https://orthos.its.ny.gov/arcgis/rest/directories/arcgisoutput/export.jpg",
        SOURCE_EXPORT_URL
      );
    }).not.toThrow();
  });

  test("rejects cross-origin or non-https basemap download URLs", () => {
    expect(() => {
      assertBasemapDownloadUrlAllowed("https://example.com/export.jpg", SOURCE_EXPORT_URL);
    }).toThrow("unexpected download URL");

    expect(() => {
      assertBasemapDownloadUrlAllowed("http://orthos.its.ny.gov/arcgis/rest/output/export.jpg", SOURCE_EXPORT_URL);
    }).toThrow("unexpected download URL");
  });
});
