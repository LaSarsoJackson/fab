import React from "react";
import {MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import Selector from "./Selector";
//import seg from "./data/seg.json";
//import geo_burials from "./data/Geo_Burials.json";


//geo burials is a geojson file parsed as json, is very large, so might make sense to wait to load it



export default function Map() {
  //in the map setup, we're going to have a map container, a tile layer, and a marker cluster group
  //change the tile layer to a tile layer from a different source -- esri 
  //need to fix styling
  //add new headstones
  //add popups on graves
  //add some sort of selection mechanism -> maybe a new page? 
  return (
    //console.log(seg), 
    //console.log(geo_burials),
    <MapContainer className='map'
    center={[42.704180, -73.731980]}
    zoom={15}
    style={{ height: "100vh" }}
    > 
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={25}
      />
    <Selector></Selector>
      <MarkerClusterGroup 
                    disableClusteringAtZoom={21}
                    removeOutsideVisibleBounds={true}
                    showCoverageOnHover={ false}
                    spiderfyOnMaxZoom={false}
                    chunkedLoading={true}
                    >
     {/* <GeoJSON data={geo_burials} /> */} 
      </MarkerClusterGroup>

    </MapContainer>
  );
}
