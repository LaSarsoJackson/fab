import { describe, expect, test } from "bun:test";
import { createMapStyle, MAP_LAYER_IDS } from "./mapStyle";

describe("cartographic style contract", () => {
  const style = createMapStyle();

  test("uses provider basemaps rather than local ortho exports", () => {
    expect(style.sources.imagery.tiles[0]).toContain("World_Imagery");
    expect(JSON.stringify(style)).not.toContain("/basemaps/");
  });

  test("keeps restrained hillshade and visible source attribution", () => {
    const layer = style.layers.find(({ id }) => id === MAP_LAYER_IDS.hillshade);
    expect(layer.paint["raster-opacity"]).toBeLessThanOrEqual(0.25);
    expect(style.sources.hillshade.attribution).toContain("Esri");
    expect(style.sources["osm-map"].attribution).toContain("OpenStreetMap");
  });

  test("keeps sections quiet until the visitor asks for them", () => {
    const layer = style.layers.find(({ id }) => id === MAP_LAYER_IDS.sections);
    expect(layer.layout.visibility).toBe("none");
  });

  test("gives tour clusters a distinct warm hierarchy color", () => {
    const layer = style.layers.find(({ id }) => id === MAP_LAYER_IDS.clusters);
    expect(style.sources.records.clusterProperties.tour_count).toBeDefined();
    expect(JSON.stringify(layer.paint["circle-color"])).toContain("#ad5a2a");
  });
});
