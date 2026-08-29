import boundary from "../../data/ARC_Boundary.json";
import roads from "../../data/ARC_Roads.json";
import sections from "../../data/ARC_Sections.json";
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
  selectedSection: "selected-section",
  records: "records",
  tourRecords: "tour-records",
  selectedRecord: "selected-record",
});

export const createMapStyle = () => ({
  version: 8,
  sources: {
    "reference-map": {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Powered by <a href=\"https://www.esri.com/\">Esri</a> | HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, © OpenStreetMap contributors, and the GIS User Community",
      maxzoom: 19,
    },
    hillshade: {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      encoding: "terrarium",
      attribution: "Terrain data courtesy of <a href=\"https://www.usgs.gov/3d-elevation-program\">U.S. Geological Survey</a>",
      maxzoom: 15,
    },
    boundary: { type: "geojson", data: boundary },
    roads: { type: "geojson", data: roads },
    sections: { type: "geojson", data: sections },
    records: { type: "geojson", data: EMPTY_COLLECTION },
    "tour-records": { type: "geojson", data: EMPTY_COLLECTION },
    selected: { type: "geojson", data: EMPTY_COLLECTION },
  },
  layers: [
    {
      id: MAP_LAYER_IDS.hillshade,
      type: "hillshade",
      source: "hillshade",
      paint: {
        "hillshade-method": "standard",
        "hillshade-illumination-anchor": "map",
        "hillshade-illumination-direction": 315,
        "hillshade-exaggeration": 0.9,
        "hillshade-shadow-color": "#243c32",
        "hillshade-highlight-color": "#fffdf4",
        "hillshade-accent-color": "#425b4f",
      },
    },
    {
      id: MAP_LAYER_IDS.map,
      type: "raster",
      source: "reference-map",
      paint: {
        "raster-opacity": 0.78,
        "raster-saturation": -0.18,
        "raster-contrast": 0.02,
        "raster-brightness-min": 0.04,
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
      layout: { visibility: "none" },
      paint: {
        "fill-color": "#d9a441",
        "fill-opacity": 0.18,
      },
    },
    {
      id: "cemetery-road-casing",
      type: "line",
      source: "roads",
      paint: {
        "line-color": "#b64032",
        "line-opacity": 0.92,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2.4, 18, 7],
      },
    },
    {
      id: "cemetery-roads",
      type: "line",
      source: "roads",
      paint: {
        "line-color": "#f8f6ef",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 18, 4],
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
