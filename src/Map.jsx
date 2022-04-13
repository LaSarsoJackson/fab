import { React, useState, useRef } from "react";
import { MapContainer, Popup, Marker, GeoJSON, LayersControl, LayerGroup } from "react-leaflet";
//import MarkerClusterGroup from "react-leaflet-markercluster";
import "./index.css";
import geo_burials from "./data/Geo_Burials.json";
//eventually you should move this to an async thing so that you could hydrate the map with the data
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-material.css';
import Button from '@mui/material/Button';
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import { BasemapLayer } from "react-esri-leaflet";
import PinDropIcon from '@mui/icons-material/PinDrop';


<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" />

const columns = [
  { field: 'OBJECTID', sortable: true, hide: true },
  {
    field: 'First_Name', sortable: true, checkboxSelection: true, headerName: 'First Name',
  },
  {
    field: 'Last_Name', sortable: true, headerName: 'Last Name',
  },
  {
    field: 'Birth', sortable: true,
  },
  {
    field: 'Death', sortable: true,
  },
  {
    field: 'Section', sortable: true,
  },
  {
    field: 'Lot', sortable: true,
  },
  {
    field: 'Pvt_Pub', sortable: true, hide: true
  },
  {
    field: 'Tier', sortable: true,
  },
  {
    field: 'Grave', sortable: true,
  },
  {
    field: 'Sec_Disp', sortable: true, hide: true
  },
  {
    field: 'ARC_GeoID', sortable: true, headerName: 'GeoID',
  },
  {
    field: 'Geotype', sortable: true, hide: true
  },
  {
    field: 'Coordinates', sortable: true, hide: true
  },
];

const defaultColDef = {
  // set filtering on for all columns
  filter: true,
  floatingFilter: true,
};

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
  const {BaseLayer} = LayersControl;
  const displaySubset = subsetData.map((data, index) => {
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
      setSubsetData(selectedNodes.map(node => node.data))
    } else if (selectedNodes.length === 0) {
      //alert('Please select a row')
      setSubsetData(selectedNodes.map(node => node.data))
    }
  };

  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [status, setStatus] = useState('Find me');
  var exteriorStyle = {
    "color": "#ffffff",
    "weight": 1.5,
    "fillOpacity": .08
};

  const onLocateMarker = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser');
    } else {
      setStatus('Locating...');
      navigator.geolocation.watchPosition((position) => {
        setStatus('Find me');
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
      }, () => {
        setStatus('Unable to retrieve your location');
      });
    }
  }

  const clearMap = () => {
    setSubsetData([]);
    //deselect all ag-grid rows
    gridRef.current.api.deselectAll();
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
            <Button onClick={clearMap} className='button' variant="contained">
             Clear selected rows
  </Button>
  </div> 
          <div className="buttonBox2">
            <Button onClick={onLocateMarker} className='locate-button' variant='contained' color='secondary' size='small' startIcon={<PinDropIcon/>}>
              {status}
              {lat && lng && <Marker position={[lat, lng]}>
                <Popup>
                  <div>
                    You are here.
                  </div>
                </Popup></Marker>}
            </Button>
          </div>
          <BaseLayer name="Imagery">
            <BasemapLayer name='Imagery' center={[42.704180, -73.731980]}
              zoom={14}></BasemapLayer>
          </BaseLayer>
          <BaseLayer checked name="ImageryClarity">
            <BasemapLayer name='ImageryClarity' center={[42.704180, -73.731980]}
              zoom={14}></BasemapLayer>
          </BaseLayer>
          <BaseLayer name='Streets'>
            <BasemapLayer name='Streets' center={[42.704180, -73.731980]}
              zoom={14}></BasemapLayer>
          </BaseLayer>
          <LayerGroup>
            <LayersControl.Overlay name="Roads">
              <GeoJSON data={ARC_Roads} ></GeoJSON>
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay checked name="Boundary">
              <GeoJSON data={ARC_Boundary} style={exteriorStyle}></GeoJSON>
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
        </LayersControl>
      </MapContainer>

      <div className="ag-theme-material" style={{ height: '40vh' }}>
        <AgGridReact
          defaultColDef={defaultColDef}
          onRowSelected={onButtonClick}
          rowDeselection={true}
          ref={gridRef}
          pagination={true}
          paginationAutoPageSize={true}
          rowData={geo_burials_rows}
          columnDefs={columns}
          columnHoverHighlight={true}
          rowSelection="multiple">
        </AgGridReact>
      </div>
    </div>
  );
}
