import { describe, expect, test } from "bun:test";
import { createMapStyle, MAP_LAYER_IDS } from "./mapStyle";

describe("cartographic style contract", () => {
  const style = createMapStyle();

  test("uses one provider reference map rather than a basemap gallery", () => {
    expect(style.sources["osm-map"].tiles[0]).toContain("openstreetmap.org");
    expect(style.sources.imagery).toBeUndefined();
    expect(JSON.stringify(style)).not.toContain("/basemaps/");
  });

  test("keeps legible hillshade beneath the labeled reference map", () => {
    const layer = style.layers.find(({ id }) => id === MAP_LAYER_IDS.hillshade);
    const mapIndex = style.layers.findIndex(({ id }) => id === MAP_LAYER_IDS.map);
    const groundIndex = style.layers.findIndex(({ id }) => id === "cemetery-ground");
    const hillshadeIndex = style.layers.findIndex(({ id }) => id === MAP_LAYER_IDS.hillshade);
    const boundaryIndex = style.layers.findIndex(({ id }) => id === "cemetery-boundary");
    const roadsIndex = style.layers.findIndex(({ id }) => id === "cemetery-roads");
    const recordsIndex = style.layers.findIndex(({ id }) => id === MAP_LAYER_IDS.records);
    expect(style.sources.hillshade.type).toBe("raster-dem");
    expect(style.sources.hillshade.encoding).toBe("terrarium");
    expect(layer.type).toBe("hillshade");
    expect(layer.paint["hillshade-method"]).toBe("standard");
    expect(layer.paint["hillshade-exaggeration"]).toBeGreaterThanOrEqual(0.7);
    expect(layer.paint["hillshade-exaggeration"]).toBeLessThanOrEqual(0.95);
    expect(style.sources.hillshade.attribution).toContain("U.S. Geological Survey");
    expect(style.sources["osm-map"].attribution).toContain("OpenStreetMap");
    expect(hillshadeIndex).toBeLessThan(mapIndex);
    expect(mapIndex).toBeLessThan(groundIndex);
    expect(hillshadeIndex).toBeLessThan(boundaryIndex);
    expect(hillshadeIndex).toBeLessThan(roadsIndex);
    expect(hillshadeIndex).toBeLessThan(recordsIndex);
  });

  test("distinguishes cemetery paths from map context", () => {
    const casing = style.layers.find(({ id }) => id === "cemetery-road-casing");

    expect(casing.paint["line-color"]).toBe("#b64032");
    expect(casing.paint["line-opacity"]).toBeGreaterThanOrEqual(0.9);
  });

  test("keeps section polygons tappable while their shading is off", () => {
    const sectionIndex = style.layers.findIndex(({ id }) => id === MAP_LAYER_IDS.sections);
    const roadIndex = style.layers.findIndex(({ id }) => id === "cemetery-roads");
    const outlineIndex = style.layers.findIndex(({ id }) => id === MAP_LAYER_IDS.sectionOutlines);
    const selectedIndex = style.layers.findIndex(({ id }) => id === MAP_LAYER_IDS.selectedSection);
    const layer = style.layers[sectionIndex];
    const outlineLayer = style.layers[outlineIndex];

    expect(layer.layout?.visibility).not.toBe("none");
    expect(layer.paint["fill-opacity"]).toBe(0);
    expect(outlineLayer.layout.visibility).toBe("none");
    expect(sectionIndex).toBeLessThan(roadIndex);
    expect(outlineIndex).toBeGreaterThan(roadIndex);
    expect(selectedIndex).toBeGreaterThan(outlineIndex);
    expect(outlineLayer.paint["line-opacity"]).toBeGreaterThanOrEqual(0.8);
  });

  test("keeps individual graves and curated tour stops directly selectable", () => {
    const recordLayer = style.layers.find(({ id }) => id === MAP_LAYER_IDS.records);
    const tourLayer = style.layers.find(({ id }) => id === MAP_LAYER_IDS.tourRecords);

    expect(style.sources.records.cluster).toBeUndefined();
    expect(style.sources["tour-records"].cluster).toBeUndefined();
    expect(recordLayer.source).toBe("records");
    expect(tourLayer.source).toBe("tour-records");
    expect(tourLayer.paint["circle-color"]).toBe("#ad5a2a");
  });
});
