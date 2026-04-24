import React from "react";
import { TileLayer } from "react-leaflet";

export const isLeafletRasterBasemap = (basemap) => (
  basemap?.type === "raster-xyz" &&
  typeof basemap?.urlTemplate === "string" &&
  basemap.urlTemplate.length > 0
);

export const LeafletBasemapLayer = ({ basemap, keepBuffer = 1 }) => {
  if (!isLeafletRasterBasemap(basemap)) {
    return null;
  }

  return (
    <TileLayer
      key={basemap.id || basemap.urlTemplate}
      url={basemap.urlTemplate}
      minZoom={basemap.minZoom}
      maxZoom={basemap.maxZoom}
      maxNativeZoom={basemap.maxZoom}
      tileSize={basemap.tileSize || 256}
      attribution={basemap.attribution || ""}
      keepBuffer={keepBuffer}
      updateWhenIdle
      updateWhenZooming={false}
    />
  );
};

