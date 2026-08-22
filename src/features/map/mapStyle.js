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
  imagery: "basemap-imagery",
  hillshade: "terrain-hillshade",
  sections: "cemetery-sections",
  sectionOutlines: "cemetery-section-outlines",
  selectedSection: "selected-section",
  clusters: "record-clusters",
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
    imagery: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles © Esri, Vantor, Earthstar Geographics, and the GIS User Community",
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
    records: {
      type: "geojson",
      data: EMPTY_COLLECTION,
      cluster: true,
      clusterMaxZoom: 17,
      clusterRadius: 42,
    },
    "tour-records": { type: "geojson", data: EMPTY_COLLECTION },
    selected: { type: "geojson", data: EMPTY_COLLECTION },
  },
  layers: [
    {
      id: MAP_LAYER_IDS.map,
      type: "raster",
      source: "osm-map",
      paint: {
        "raster-opacity": 0.92,
        "raster-saturation": -0.55,
        "raster-contrast": -0.03,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.98,
      },
    },
    {
      id: MAP_LAYER_IDS.imagery,
      type: "raster",
      source: "imagery",
      layout: { visibility: "none" },
      paint: {
        "raster-saturation": -0.08,
        "raster-contrast": -0.05,
      },
    },
    {
      id: "cemetery-ground",
      type: "fill",
      source: "boundary",
      paint: {
        "fill-color": "#edf1e6",
        "fill-opacity": 0.18,
      },
    },
    {
      id: MAP_LAYER_IDS.hillshade,
      type: "hillshade",
      source: "hillshade",
      paint: {
        "hillshade-method": "igor",
        "hillshade-illumination-anchor": "map",
        "hillshade-illumination-direction": 315,
        "hillshade-exaggeration": 0.24,
        "hillshade-shadow-color": "rgba(38, 47, 41, 0.36)",
        "hillshade-highlight-color": "rgba(255, 255, 255, 0.08)",
        "hillshade-accent-color": "rgba(44, 57, 48, 0.2)",
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
        "line-color": "rgba(37,48,43,0.34)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.8, 18, 6],
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
      id: MAP_LAYER_IDS.clusters,
      type: "circle",
      source: "records",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#315f4c",
        "circle-radius": ["step", ["get", "point_count"], 17, 10, 20, 40, 24],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    },
    {
      id: MAP_LAYER_IDS.records,
      type: "circle",
      source: "records",
      filter: ["!", ["has", "point_count"]],
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
