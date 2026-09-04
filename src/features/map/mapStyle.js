import boundary from "../../data/ARC_Boundary.json";
import roads from "../../data/ARC_Roads.json";
import sections from "../../data/ARC_Sections.json";
import { MAP_LANDMARKS } from "../fab/mapLandmarks";
import { recordsToFeatureCollection } from "../locator/burialRecords";
import { BOUNDARY_BBOX } from "./generatedBounds";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

export const CEMETERY_VIEW = Object.freeze({
  bounds: BOUNDARY_BBOX,
  center: [-73.73198, 42.70418],
  zoom: 14,
});

export const MAP_LAYER_IDS = Object.freeze({
  map: "basemap-map",
  hillshade: "terrain-hillshade",
  sections: "cemetery-sections",
  sectionOutlines: "cemetery-section-outlines",
  sectionLabels: "cemetery-section-labels",
  selectedSection: "selected-section",
  landmarkLabels: "cemetery-landmark-labels",
  records: "records",
  tourRecords: "tour-records",
  selectedRecord: "selected-record",
});

export const createMapStyle = () => ({
  version: 8,
  sources: {
    "osm-map": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
      maxzoom: 19,
    },
    hillshade: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Terrain sources: Esri, Vantor, Airbus DS, <a href=\"https://www.usgs.gov/3d-elevation-program\">U.S. Geological Survey</a>, NGA, NASA, CGIAR, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen, Rijkswaterstaat, GSA, Geoland, FEMA, Intermap, and the GIS user community",
      maxzoom: 16,
    },
    boundary: { type: "geojson", data: boundary },
    roads: { type: "geojson", data: roads },
    sections: { type: "geojson", data: sections },
    landmarks: { type: "geojson", data: recordsToFeatureCollection(MAP_LANDMARKS) },
    records: { type: "geojson", data: EMPTY_COLLECTION },
    "tour-records": { type: "geojson", data: EMPTY_COLLECTION },
    selected: { type: "geojson", data: EMPTY_COLLECTION },
  },
  layers: [
    {
      id: "map-background",
      type: "background",
      paint: { "background-color": "#f6f5ef" },
    },
    {
      id: MAP_LAYER_IDS.hillshade,
      type: "raster",
      source: "hillshade",
      paint: {
        "raster-opacity": 1,
        "raster-saturation": -1,
      },
    },
    {
      id: MAP_LAYER_IDS.map,
      type: "raster",
      source: "osm-map",
      paint: {
        "raster-opacity": 0.38,
        "raster-saturation": -0.8,
        "raster-contrast": 0,
        "raster-brightness-min": 0,
        "raster-brightness-max": 1,
      },
    },
    {
      id: "cemetery-ground",
      type: "fill",
      source: "boundary",
      paint: {
        "fill-color": "#fffdf7",
        "fill-opacity": 0.06,
      },
    },
    {
      id: "cemetery-boundary-halo",
      type: "line",
      source: "boundary",
      paint: {
        "line-color": "rgba(255,255,255,0.9)",
        "line-width": 5,
        "line-blur": 1,
      },
    },
    {
      id: "cemetery-boundary",
      type: "line",
      source: "boundary",
      paint: {
        "line-color": "#315f4c",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.4, 18, 2.6],
      },
    },
    {
      id: MAP_LAYER_IDS.sections,
      type: "fill",
      source: "sections",
      paint: {
        "fill-color": "#d9a441",
        // Transparent polygons remain available for section taps.
        "fill-opacity": 0,
      },
    },
    {
      id: "cemetery-road-casing",
      type: "line",
      source: "roads",
      paint: {
        "line-color": "#fffdf7",
        "line-opacity": 1,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3.5, 18, 7],
      },
    },
    {
      id: "cemetery-roads",
      type: "line",
      source: "roads",
      paint: {
        "line-color": "#b64032",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.8, 18, 3.5],
      },
    },
    {
      id: MAP_LAYER_IDS.sectionOutlines,
      type: "line",
      source: "sections",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#6f531b",
        "line-opacity": 0.88,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 18, 2.2],
      },
    },
    {
      id: MAP_LAYER_IDS.selectedSection,
      type: "line",
      source: "sections",
      layout: { visibility: "none" },
      filter: ["==", ["to-string", ["get", "Section"]], ""],
      paint: {
        "line-color": "#8d5317",
        "line-width": 3,
      },
    },
    {
      id: "cemetery-road-labels",
      type: "symbol",
      source: "roads",
      minzoom: 15,
      filter: ["!=", ["coalesce", ["get", "Cemetery_R"], ""], ""],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 250,
        "text-field": ["get", "Cemetery_R"],
        "text-font": ["Arial"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15, 12, 18, 14],
        "text-padding": 8,
      },
      paint: {
        "text-color": "#49342c",
        "text-halo-color": "#fffdf7",
        "text-halo-width": 2,
      },
    },
    {
      id: MAP_LAYER_IDS.sectionLabels,
      type: "symbol",
      source: "sections",
      layout: {
        visibility: "none",
        "text-field": ["concat", "Section ", ["to-string", ["get", "Section"]]],
        "text-font": ["Arial"],
        "text-size": 13,
        "text-padding": 10,
      },
      paint: {
        "text-color": "#684818",
        "text-halo-color": "#fffdf7",
        "text-halo-width": 2,
      },
    },
    {
      id: MAP_LAYER_IDS.landmarkLabels,
      type: "symbol",
      source: "landmarks",
      minzoom: 15.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Arial"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 15.5, 13, 18, 15],
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.5,
        "text-max-width": 10,
        "text-padding": 6,
      },
      paint: {
        "text-color": "#263b30",
        "text-halo-color": "#fffdf7",
        "text-halo-width": 2,
      },
    },
    {
      id: MAP_LAYER_IDS.records,
      type: "circle",
      source: "records",
      paint: {
        "circle-color": "#315f4c",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 5, 18, 8],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
    {
      id: MAP_LAYER_IDS.tourRecords,
      type: "circle",
      source: "tour-records",
      paint: {
        "circle-color": "#ad5a2a",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 6, 18, 9],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
    {
      id: MAP_LAYER_IDS.selectedRecord,
      type: "circle",
      source: "selected",
      paint: {
        "circle-color": "#d04d35",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 7, 18, 11],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    },
  ],
});
