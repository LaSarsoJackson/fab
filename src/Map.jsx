import { React, useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Popup, Marker, GeoJSON, LayersControl, LayerGroup, useMap} from "react-leaflet";
//import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import geo_burials from "./data/Geo_Burials.json";
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';
import Button from '@mui/material/Button';
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";


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
  const [fullName, setfullName] = useState('');

  const onButtonClick = e => {
    const selectedNodes = gridRef.current.api.getSelectedNodes()
    const selectedData = selectedNodes.map(node => node.data)
    const selectedDataStringPresentation = selectedData.map(node => `${node.First_Name} ${node.Last_Name}`).join(' ')
    //const selectedDataStringPresentation = selectedData.map(node => `${node.Coordinates[0]} ${node.Coordinates[1]}`).join(', ')
    setfullName(selectedDataStringPresentation);
    setLat(selectedData[0].Coordinates[0]);
    setLng(selectedData[0].Coordinates[1]);
    console.log(lat, lng);
    //alert(`Selected nodes: ${selectedDataStringPresentation}`)
    //this should be refactored with the useEffect hook probably. 
    //i'm not sure how!
  }

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
    }, []);

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
        style={{ height: "50vh" }}
      >
        <LayersControl>
          <div className="buttonBox">
            <Button onClick={onButtonClick} className='button' variant="contained">Get selected burial: Lat {lat} Lng {lng} </Button>
          </div>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={25}
          />
          <LocationMarker></LocationMarker>
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

          {lat && lng && <Marker position={[lng, lat]}>
            <Popup>
              <div>
                <h1>
                  <span role="img" aria-label="burial">
                    {fullName}
                  </span>
                </h1>
              </div>
            </Popup>
          </Marker>}
        </LayersControl>
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
