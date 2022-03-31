import { React, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import Selector from "./Selector";
import geo_burials from "./data/tinyBurial.json";
import SearchBox from "./SearchBox";



export default function Map() {

  const geoData = geo_burials;
  //get state of search box button 
  const [filterText, setFilterText] = useState('');
  const [selection, setSelection] = useState(null)
  function filterGeo(feature) {
    console.log('feature', feature.properties.OBJECTID)
    console.log('selection', selection)

    if (selection) {
      if (feature.properties.OBJECTID === selection) {
        return true
      } else {
        return false
      }
    } else {
      // return true for all features if selection is false
      return true
    }

  }

  //https://github.com/roedit/react-leaflet-filter this 


  return (
    <div>
      <button onClick={() => setSelection(1)}>Coors Field</button>
      <SearchBox filterText={filterText} onFilterTextChange={setFilterText}></SearchBox>
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


        <MarkerClusterGroup
          disableClusteringAtZoom={21}
          removeOutsideVisibleBounds={true}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom={false}
          chunkedLoading={true}
        >
          <GeoJSON data={geoData} filter={filterGeo} />
        </MarkerClusterGroup>


      </MapContainer>
      <Selector>
      </Selector>

    </div>
  );
}
