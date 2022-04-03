import { React, useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Popup, Marker, GeoJSON, LayersControl, LayerGroup, useMap } from "react-leaflet";
//import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import geo_burials from "./data/Geo_Burials.json";
//eventually you should move this to an async thing so that you cna hydrate the map with the data

import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';
import Button from '@mui/material/Button';
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";


const columns = [
  { field: 'OBJECTID', sortable: true, filter: true , hide: true  },
  {
    field: 'First_Name', sortable: true, filter: true, checkboxSelection: true,
  },
  {
    field: 'Last_Name', sortable: true, filter: true
  },
  {
    field: 'Section', sortable: true, filter: true
  },
  {
    field: 'Lot', sortable: true, filter: true
  },
  {
    field: 'Pvt_Pub', sortable: true, filter: true, hide: true 
  },
  {
    field: 'Tier', sortable: true, filter: true
  },
  {
    field: 'Grave', sortable: true, filter: true
  },
  {
    field: 'Sec_Disp', sortable: true, filter: true, hide: true 
  },
  {
    field: 'ARC_GeoID', sortable: true, filter: true
  },
  {
    field: 'Birth', sortable: true, filter: true
  },
  {
    field: 'Death', sortable: true, filter: true
  },
  {
    field: 'Geotype', sortable: true, filter: true, hide: true 
  },
  {
    field: 'Coordinates', sortable: true, filter: true, hide: true 
  },
];
let geo_burials_rows = [];
for (let i = 0; i < geo_burials.features.length; i++) {
  let feature = geo_burials.features[i];
  let row = {
    OBJECTID: feature.properties.OBJECTID,
    First_Name: feature.properties.First_Name,
    Last_Name: feature.properties.Last_Name,
    Section: feature.properties.Section,
    Lot: feature.properties.Lot,
    Pvt_Pub: feature.properties.Pvt_Pub,
    Tier: feature.properties.Tier,
    Grave: feature.properties.Grave,
    Sec_Disp: feature.properties.Sec_Disp,
    ARC_GeoID: feature.properties.ARC_GeoID,
    Birth: feature.properties.Birth,
    Death: feature.properties.Death,
    Geotype: feature.geometry.type,
    Coordinates: feature.geometry.coordinates,
  };
  geo_burials_rows.push(row);
}


export default function Map() {
  const gridRef = useRef(null);
  const [subsetData, setSubsetData] = useState([]); //this is the data that is selected

  const displaySubset = subsetData.map((data, index) => 
  {
    return (
      <Marker key={index} position={[data.Coordinates[1], data.Coordinates[0]]}>
        <Popup>
          <div>
            <h3>{data.First_Name} {data.Last_Name}</h3>
            <p>Section: {data.Section}</p>
            <p>Lot: {data.Lot}</p>
            <p>Tier: {data.Tier}</p>
            <p>Grave: {data.Grave}</p>
            <p>Birth: {data.Birth}</p>
            <p>Death: {data.Death}</p>
          </div>
        </Popup>
      </Marker>
    )
  })


  
  const onButtonClick = e => {
    const selectedNodes = gridRef.current.api.getSelectedNodes()
    if (selectedNodes.length > 0) {
      //alert('Please select only one row')
      setSubsetData(selectedNodes.map(node => node.data))
      //console.log(subsetData); //this is the data that is selected
      //const selectedData = selectedNodes.map(node => node.data)
      //setSubsetData(selectedData)
    } else if (selectedNodes.length === 0) {
      alert('Please select a row')
    } 
  };


  //what did you see John lombardi? when did you see it?
  //https://stackoverflow.com/questions/71121283/passing-data-to-leaflet-from-ag-grid-programmitically


  //https://codesandbox.io/s/how-to-set-the-map-to-a-geolocation-on-map-load-with-react-leaflet-v3-uvkpz?file=/src/Maps.jsx
  function LocationMarker() {
    const [position, setPosition] = useState(null);

    const map = useMap();

    useEffect(() => {
      map.locate().on("locationfound", function (e) {
        setPosition(e.latlng);
        map.flyTo(e.latlng, map.getZoom());
      });
    }, [map]);

    return position === null ? null : (
      <Marker position={position}>
        <Popup>You are here</Popup>
      </Marker>
    );
  }

  return (

    <div>
      <MapContainer
        center={[42.704180, -73.731980]}
        zoom={14}
        style={{ height: "60vh" }}
      >
        <LayersControl>
          <div className="buttonBox">
            <Button onClick={onButtonClick} className='button' variant="contained">
              Get selected burial:
            </Button>
          </div>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={25}
          />
          {/*<LocationMarker></LocationMarker>*/}
          <LayerGroup>
            <LayersControl.Overlay name="Roads">
              <GeoJSON data={ARC_Roads}></GeoJSON>
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay name="Boundary">
              <GeoJSON data={ARC_Boundary}></GeoJSON>
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay name="Sections">
              <GeoJSON data={ARC_Sections}
                onEachFeature={(feature, layer) => {
                  layer.bindTooltip(`<h3>${feature.properties.Section_Di}</h3>`, { permanent: true, direction: 'center' });
                }}>
              </GeoJSON>
            </LayersControl.Overlay>
          </LayerGroup>
          <div>  
            {displaySubset}
          </div>
        
          {/*
            lat && lng && valueI === 999 && 
            <Marker position={[lng, lat]}>
              <Popup>
                <div>
                  <h1>
                    <span role="img" aria-label="burial">
                      {fullName}
                    </span>
                  </h1>
                </div>
              </Popup>
            </Marker>
              */}
        </LayersControl>
      </MapContainer>

      <div className="ag-theme-alpine" style={{ height: '40vh' }}>
        <AgGridReact
          ref={gridRef}
          pagination={true}
          paginationAutoPageSize={true}
          rowData={geo_burials_rows}
          columnDefs={columns}
          rowSelection="multiple">
        </AgGridReact>

      </div>
    </div>
  );
}
