import React from "react";
import { GeoJSON } from "react-leaflet";

const GEOJSON_DATA_KEYS = new WeakMap();
let nextGeoJsonDataKey = 1;

export const getLeafletGeoJsonDataKey = (featureCollection) => {
  if (!featureCollection || typeof featureCollection !== "object") {
    return "empty";
  }

  let dataKey = GEOJSON_DATA_KEYS.get(featureCollection);

  if (!dataKey) {
    dataKey = `geojson-${nextGeoJsonDataKey++}`;
    GEOJSON_DATA_KEYS.set(featureCollection, dataKey);
  }

  return dataKey;
};

export const LeafletGeoJsonLayer = ({ layerId, data, ...geoJsonProps }) => (
  <GeoJSON
    key={`${layerId}:${getLeafletGeoJsonDataKey(data)}`}
    data={data}
    {...geoJsonProps}
  />
);
