import { React, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker } from "react-leaflet";
//import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import geo_burials from "./data/Geo_Burials.json";
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';


const columns = [
  { field: 'OBJECTID', sortable: true, filter: true, checkboxSelection: true },
  {
    field: 'First_Name', sortable: true, filter: true
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
    field: 'Pvt_Pub', sortable: true, filter: true
  },
  {
    field: 'Tier', sortable: true, filter: true
  },
  {
    field: 'Grave', sortable: true, filter: true
  },
  {
    field: 'Sec_Disp', sortable: true, filter: true
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
    field: 'Geotype', sortable: true, filter: true
  },
  {
    field: 'Coordinates', sortable: true, filter: true
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
  //const [coordinates, setCoordinates] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const onButtonClick = e => {
    const selectedNodes = gridRef.current.api.getSelectedNodes()
    const selectedData = selectedNodes.map(node => node.data)
    //const selectedDataStringPresentation = selectedData.map(node => `${node.Coordinates[0]} ${node.Coordinates[1]}`).join(', ')
    setLat(selectedData[0].Coordinates[0]); 
    setLng(selectedData[0].Coordinates[1]);
    console.log(lat, lng);
    //alert(`Selected nodes: ${selectedDataStringPresentation}`)

    //this should be refactored with the useEffect hook probably. 
    //i'm not sure how!
  }

//what did you see John lombardi? when did you see it?
//https://stackoverflow.com/questions/71121283/passing-data-to-leaflet-from-ag-grid-programmitically

  return (
    <div>
      <button onClick={onButtonClick}>Get selected burial: Lat {lat} Lng {lng} </button>
      <MapContainer className='map'
        center={[42.704180, -73.731980]}
        zoom={14}
        style={{ height: "50vh" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={25}
        />
        {lat && lng && <Marker position={[lng, lat]}>
            <div>
              <h1>
                <span role="img" aria-label="burial">
                  💀
                </span>
              </h1>
            </div>
          </Marker>

        }

      </MapContainer>
      <div className="ag-theme-alpine" style={{ height: '50vh' }}>
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
