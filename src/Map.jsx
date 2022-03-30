import React from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import Selector from "./Selector";
import geo_burials from "./data/Geo_Burials.json";
import SearchBox from "./SearchBox";

//this is the data we're going to use
//in the map setup, we're going to have a map container, a tile layer, and a marker cluster group
//change the tile layer to a tile layer from a different source -- esri 
//need to fix styling
//add new headstones
//add popups on graves
//add some sort of selection mechanism -> maybe a new page? 


export default function Map() {

  const geoData = geo_burials;

  return (
    <div>
      <SearchBox></SearchBox>
      <MapContainer className='map'
        center={[42.704180, -73.731980]}
        zoom={15}
        style={{ height: "50vh" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={25}
        />

        {/*
       <MarkerClusterGroup 
                    disableClusteringAtZoom={21}
                    removeOutsideVisibleBounds={true}
                    showCoverageOnHover={ false}
                    spiderfyOnMaxZoom={false}
                    chunkedLoading={true}
                    >
       <GeoJSON data={geoData} />
      </MarkerClusterGroup>
    */}

      </MapContainer>
      <Selector>
      </Selector>

    </div>
  );
}
