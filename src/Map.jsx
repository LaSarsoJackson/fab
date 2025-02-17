import { React, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, Popup, Marker, GeoJSON, LayersControl, LayerGroup, useMap } from "react-leaflet";
import L from 'leaflet';
import "./index.css";
import 'leaflet.markercluster/dist/leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'lrm-graphhopper';
import geo_burials from "./data/Geo_Burials.json";
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-material.css';
import Button from '@mui/material/Button';

// Import local GeoJSON files
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import Sec75_Headstones from "./data/Projected_Sec75_Headstones.json";
import Sec49_Headstones from "./data/Projected_Sec49_Headstones.json";
import NotablesTour from "./data/NotablesTour20.json";
import IndependenceTour from "./data/IndependenceTour20.json";
import AfricanAmericanTour from "./data/AfricanAmericanTour20.json";
import ArtistTour from "./data/ArtistTour20.json";
import AssociationsTour from "./data/AssociationsTour20.json";
import AuthorsTour from "./data/AuthorsPublishersTour20.json";
import BusinessTour from "./data/BusinessFinanceTour20.json";
import CivilWarTour from "./data/CivilWarTour20.json";
import PillarsTour from "./data/SocietyPillarsTour20.json";
import MayorsTour from "./data/AlbanyMayors_fixed.json";
import GARTour from "./data/GAR_fixed.json";
import PinDropIcon from '@mui/icons-material/PinDrop';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import * as turf from '@turf/turf';
import { BasemapLayer } from 'react-esri-leaflet';
import { 
  Autocomplete, 
  TextField, 
  Paper, 
  InputAdornment, 
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Box,
  Typography,
  ButtonGroup
} from '@mui/material';
import { divIcon } from 'leaflet';
import HomeIcon from '@mui/icons-material/Home';

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

// Custom Zoom Control Component
function CustomZoomControl() {
  const map = useMap();
  
  return (
    <Paper 
      elevation={3}
      sx={{
        position: 'absolute',
        top: '80px',
        right: '10px',
        zIndex: 1000,
      }}
    >
      <ButtonGroup
        orientation="vertical"
        variant="contained"
        size="small"
      >
        <IconButton onClick={() => map.zoomIn()} size="small">
          <AddIcon />
        </IconButton>
        <IconButton onClick={() => map.zoomOut()} size="small">
          <RemoveIcon />
        </IconButton>
      </ButtonGroup>
    </Paper>
  );
}

// MapBounds component to restrict zoom and pan
function MapBounds() {
  const map = useMap();
  const boundaryPolygon = ARC_Boundary.features[0];
  
  useEffect(() => {
    // Calculate the bounds of the boundary polygon
    const bounds = turf.bbox(boundaryPolygon);
    
    // Add significant padding to the bounds (about 1km)
    const padding = 0.01; // roughly 1km in decimal degrees
    const southWest = [bounds[1] - padding, bounds[0] - padding];
    const northEast = [bounds[3] + padding, bounds[2] + padding];
    
    const paddedBounds = [southWest, northEast];
    
    // Set less restrictive bounds
    map.setMaxBounds(paddedBounds);
    map.setMinZoom(13);
    map.setMaxZoom(25);

    // Initial fit to bounds, but don't force recenter after
    map.once('load', () => {
      map.fitBounds(paddedBounds);
    });
  }, [map, boundaryPolygon]);
  
  return null;
}

// Create a custom component for the vector basemap
function VectorBasemap({ name }) {
  return <BasemapLayer name={name} maxZoom={25} maxNativeZoom={19} />;
}

// Add this after the VectorBasemap component and before the Map component
function MapController({ selectedBurials, hoveredIndex }) {
  const map = useMap();
  
  useEffect(() => {
    // Store the map instance in the window for access from outside
    window.mapInstance = map;
  }, [map]);
  
  return null;
}

// Add this before the Map component
const MARKER_COLORS = [
  '#e41a1c', // red
  '#377eb8', // blue
  '#4daf4a', // green
  '#984ea3', // purple
  '#ff7f00', // orange
  '#ffff33', // yellow
  '#a65628', // brown
  '#f781bf', // pink
  '#999999'  // grey
];

// Add this before the Map component
const ZOOM_LEVEL = 18;

// Add before the Map component
const createNumberedIcon = (number, isHighlighted = false) => {
  const colorIndex = (number - 1) % MARKER_COLORS.length;
  const color = MARKER_COLORS[colorIndex];
  
  return divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: ${isHighlighted ? '32px' : '24px'};
        height: ${isHighlighted ? '32px' : '24px'};
        border-radius: 50%;
        border: ${isHighlighted ? '3px' : '2px'} solid white;
        box-shadow: ${isHighlighted ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)'};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isHighlighted ? '16px' : '14px'};
        transition: all 0.2s ease;
      ">
        ${number}
      </div>
    `,
    iconSize: [isHighlighted ? 32 : 24, isHighlighted ? 32 : 24],
    iconAnchor: [isHighlighted ? 16 : 12, isHighlighted ? 16 : 12],
    popupAnchor: [0, isHighlighted ? -16 : -12]
  });
};

// Add this before the Map component
const createUniqueKey = (burial, index) => {
  // Create a unique key combining multiple properties
  return `${burial.OBJECTID}_${burial.Section}_${burial.Lot}_${burial.Grave}_${index}`;
};

// Add before the Map component
const UNIQUE_SECTIONS = Array.from(new Set(geo_burials.features.map(f => f.properties.Section))).sort((a, b) => {
  // Handle special case for section 100A
  if (a === '100A') return 1;
  if (b === '100A') return -1;
  return a - b;
});

// Add Routing Control Component
function RoutingControl({ from, to }) {
  const map = useMap();
  const [routingError, setRoutingError] = useState(null);
  
  useEffect(() => {
    if (!from || !to) return;

    // Check if API key is available
    const apiKey = process.env.REACT_APP_GRAPHHOPPER_API_KEY;
    if (!apiKey) {
      console.error('GraphHopper API key not found in environment variables');
      setRoutingError('Configuration error: API key not found');
      return;
    }

    const routingControl = L.Routing.control({
      router: new L.Routing.GraphHopper(apiKey, {
        urlParameters: {
          vehicle: 'foot'  // Set to pedestrian routing
        }
      }),
      waypoints: [
        L.latLng(from[0], from[1]),
        L.latLng(to[0], to[1])
      ],
      createMarker: function() { return null; }, // Don't create markers - we already have them
      lineOptions: {
        styles: [
          {color: '#0066CC', opacity: 0.8, weight: 5},
          {color: '#ffffff', opacity: 0.3, weight: 7}
        ]
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      useZoomParameter: true,
      show: false // Hide the instruction panel
    }).addTo(map);

    // Add error handling
    routingControl.on('routingerror', (e) => {
      console.error('Routing error:', e);
      setRoutingError('Unable to calculate route. Please try again.');
      
      // Remove the control after error
      map.removeControl(routingControl);
    });

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, from, to]);

  // Show error message if there's a routing error
  if (routingError) {
    return (
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px',
          backgroundColor: '#f44336',
          color: 'white',
        }}
      >
        <Typography>{routingError}</Typography>
      </Paper>
    );
  }

  return null;
}

// Update tour marker styles to match ARCE Leaflet
const TOURS = {
  Lot7: { name: "Soldier's Lot (Section 75, Lot 7)", color: '#7587ff' },
  Sec49: { name: "Section 49", color: '#75ff87' },
  Notable: { name: "Notables Tour 2020", color: '#ff7700' },
  Indep: { name: "Independence Tour 2020", color: '#7700ff' },
  Afr: { name: "African American Tour 2020", color: '#eedd00' },
  Art: { name: "Artists Tour 2020", color: '#ff4277' },
  Groups: { name: "Associations, Societies, & Groups Tour 2020", color: '#86cece' },
  AuthPub: { name: "Authors & Publishers Tour 2020", color: '#996038' },
  Business: { name: "Business & Finance Tour 2020", color: '#558e76' },
  CivilWar: { name: "Civil War Tour 2020", color: '#a0a0a0' },
  Pillars: { name: "Pillars of Society Tour 2020", color: '#d10008' },
  MayorsOfAlbany: { name: "Mayors of Albany", color: '#ff00dd' },
  GAR: { name: "Grand Army of the Republic", color: '#000080' }
};

// Define styles
const exteriorStyle = {
  color: "#ffffff",
  weight: 1.5,
  fillOpacity: .08
};

const roadStyle = {
  color: '#000000',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.1
};

// Move DefaultExtentButton outside BurialMap component
function DefaultExtentButton() {
  const map = useMap();
  
  const handleClick = () => {
    const defaultBounds = [
      [42.694180, -73.741980], // Southwest corner
      [42.714180, -73.721980]  // Northeast corner
    ];
    map.fitBounds(defaultBounds);
  };
  
  return (
    <Paper 
      elevation={3}
      sx={{
        position: 'absolute',
        top: '150px',
        right: '10px',
        zIndex: 1000,
      }}
    >
      <IconButton onClick={handleClick} size="small" title="Return to Default Extent">
        <HomeIcon />
      </IconButton>
    </Paper>
  );
}

// Move TourFilter outside BurialMap component and remove useMap dependency
function TourFilter({ overlayMaps, setShowAllBurials, onTourSelect }) {
  return (
    <Autocomplete
      options={Object.keys(TOURS)}
      getOptionLabel={(option) => TOURS[option].name}
      onChange={(event, newValue) => {
        setShowAllBurials(true);
        // Pass null to clear the tour, or the tour name to select it
        const layerName = newValue ? TOURS[newValue].name : null;
        onTourSelect(layerName);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Tour"
          size="small"
          fullWidth
        />
      )}
      renderOption={(props, option) => (
        <li {...props}>
          <Box
            component="span"
            sx={{
              width: 14,
              height: 14,
              mr: 1,
              borderRadius: '50%',
              backgroundColor: TOURS[option].color,
              display: 'inline-block'
            }}
          />
          {TOURS[option].name}
        </li>
      )}
    />
  );
}

// Update MapTourController to handle tour clearing
function MapTourController({ selectedTour, overlayMaps }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !overlayMaps) return;

    // Remove all tour layers first
    Object.entries(overlayMaps).forEach(([name, layer]) => {
      if (name.includes('Tour') || name.includes('Lot 7') || name.includes('Section 49') || 
          name.includes('Mayors') || name.includes('GAR')) {
        map.removeLayer(layer);
      }
    });

    // Add only the selected tour layer if it exists
    if (selectedTour) {
      Object.entries(overlayMaps).forEach(([name, layer]) => {
        if (name === selectedTour) {
          map.addLayer(layer);
        }
      });
    }
  }, [map, selectedTour, overlayMaps]);
  
  return null;
}

// Add CSS styles for popup images and markers
const popupImageStyle = {
  maxWidth: '200px',
  maxHeight: '200px',
  border: '2px solid #ccc',
  borderRadius: '4px',
  margin: '8px 0'
};

// Update marker styles
const markerStyle = {
  radius: 8,
  fillColor: "#ff7800",
  color: "#000",
  weight: 1,
  opacity: 1,
  fillOpacity: 0.8
};

const tourMarkerStyle = {
  radius: 10,
  weight: 3,
  opacity: 0.9,
  fillOpacity: 0.7,
  className: 'tour-marker'
};

// Update the getImagePath function
const getImagePath = (imageName) => {
  if (!imageName || imageName === "NONE") return 'https://www.albany.edu/arce/images/no-image.jpg';
  
  if (process.env.NODE_ENV === 'development') {
    // Local development path using Python server
    return `http://localhost:8000/src/data/images/${imageName}`;
  }
  // Production path
  return `https://www.albany.edu/arce/images/${imageName}`;
};

// Add this helper function before the BurialMap component
const createTourMarker = (tourKey) => {
  const tourInfo = TOURS[tourKey];
  if (!tourInfo) return null;

  return (feature, latlng) => {
    if (feature.geometry.type === 'Point') {
      const icon = L.divIcon({
        className: 'tour-marker',
        html: `<div style="
          width: 12px;
          height: 12px;
          background-color: ${tourInfo.color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });
      return L.marker(latlng, { icon });
    }
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: tourInfo.color,
      color: '#ffffff',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.7
    });
  };
};

// Helper function to create consistent popup content
const createTourPopupContent = (feature, tourKey) => {
  let content = `<dl class="popup-content">`;
  
  // Add name
  content += `<dt><b>${feature.properties.Full_Name}</b></dt><hr>`;
  
  // Add titles if available
  if (feature.properties.Titles) {
    content += `<dt>${feature.properties.Titles}</dt>`;
  }
  
  // Add biography link text
  content += `<dt>(Click image to view detailed biography)</dt>`;
  
  // Add image if available
  if (feature.properties.Bio_Portra && feature.properties.Bio_Portra !== "NONE") {
    content += `
      <dt>
        <a href="https://www.albany.edu/arce/${feature.properties.Tour_Bio}.html" target="_blank">
          <img 
            src="${getImagePath(feature.properties.Bio_Portra)}"
            style="max-width:200px; max-height:200px; border:2px solid #ccc; border-radius:4px; margin:8px 0;"
            loading="lazy"
            onerror="this.onerror=null; this.src='https://www.albany.edu/arce/images/no-image.jpg';"
          />
        </a>
      </dt>`;
  }
  
  content += '</dl>';
  return content;
};

export default function BurialMap() {
  // Move all state declarations inside the component
  const [featuresLayer, setFeaturesLayer] = useState(null);
  const [featuresLayer2, setFeaturesLayer2] = useState(null);
  const [featuresLayer3, setFeaturesLayer3] = useState(null);
  const [featuresLayer4, setFeaturesLayer4] = useState(null);
  const [featuresLayer5, setFeaturesLayer5] = useState(null);
  const [featuresLayer6, setFeaturesLayer6] = useState(null);
  const [featuresLayer7, setFeaturesLayer7] = useState(null);
  const [featuresLayer8, setFeaturesLayer8] = useState(null);
  const [featuresLayer9, setFeaturesLayer9] = useState(null);
  const [featuresLayer10, setFeaturesLayer10] = useState(null);
  const [featuresLayer11, setFeaturesLayer11] = useState(null);
  const [featuresLayer12, setFeaturesLayer12] = useState(null);
  const [featuresLayer13, setFeaturesLayer13] = useState(null);
  const [overlayMaps, setOverlayMaps] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [status, setStatus] = useState('Find me');
  const [selectedBurials, setSelectedBurials] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentSelection, setCurrentSelection] = useState(null);
  const [showAllBurials, setShowAllBurials] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [lotTierFilter, setLotTierFilter] = useState('');
  const [filterType, setFilterType] = useState('lot');
  const [currentZoom, setCurrentZoom] = useState(14);
  const [routingDestination, setRoutingDestination] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);

  const { BaseLayer } = LayersControl;
  const markerClusterRef = useRef(null);
  const markersRef = useRef(new Map());

  // Define feature handlers
  const onEachLot7Feature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Lot7');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Lot7";
    }
  }, []);

  const onEachSec49Feature = useCallback((feature, layer) => {
    if (feature.properties) {
      const content = createTourPopupContent(feature, 'Sec49');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Sec49";
    }
  }, []);

  const onEachNotableFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Notable');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Notable";
    }
  }, []);

  const onEachIndepFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Indep');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Indep";
    }
  }, []);

  const onEachAAFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Afr');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Afr";
    }
  }, []);

  const onEachArtistFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Art');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Art";
    }
  }, []);

  const onEachAssociationFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Groups');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Groups";
    }
  }, []);

  const onEachAuthorFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'AuthPub');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "AuthPub";
    }
  }, []);

  const onEachBusinessFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Business');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Business";
    }
  }, []);

  const onEachCivilWarFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'CivilWar');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "CivilWar";
    }
  }, []);

  const onEachMayorFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'MayorsOfAlbany');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "MayorsOfAlbany";
    }
  }, []);

  const onEachGARFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'GAR');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "GAR";
    }
  }, []);

  const onEachPillarFeature = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Full_Name) {
      const content = createTourPopupContent(feature, 'Pillars');
      layer.bindPopup(content, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      feature.properties.title = "Pillars";
    }
  }, []);

  const onEachSection = useCallback((feature, layer) => {
    if (feature.properties && feature.properties.Section) {
      layer.on('mouseover', () => {
        layer.setStyle({ weight: 6 });
      });
      layer.on('mouseout', () => {
        layer.setStyle({ weight: 2 });
      });
      const list = `<dl><dt><b>Section ${feature.properties.Section}</b></dt></dl>`;
      layer.bindPopup(list);
    }
  }, []);

  // Move useEffect for loading GeoJSON data inside component
  useEffect(() => {
    try {
      // Create feature layers using imported data
      const layers = {
        lot7: L.geoJSON(Sec75_Headstones, { 
          pointToLayer: createTourMarker('Lot7'),
          onEachFeature: onEachLot7Feature 
        }),
        sec49: L.geoJSON(Sec49_Headstones, { 
          pointToLayer: createTourMarker('Sec49'),
          onEachFeature: onEachSec49Feature 
        }),
        notables: L.geoJSON(NotablesTour, { 
          pointToLayer: createTourMarker('Notable'),
          onEachFeature: onEachNotableFeature 
        }),
        independence: L.geoJSON(IndependenceTour, { 
          pointToLayer: createTourMarker('Indep'),
          onEachFeature: onEachIndepFeature 
        }),
        africanAmerican: L.geoJSON(AfricanAmericanTour, { 
          pointToLayer: createTourMarker('Afr'),
          onEachFeature: onEachAAFeature 
        }),
        artist: L.geoJSON(ArtistTour, { 
          pointToLayer: createTourMarker('Art'),
          onEachFeature: onEachArtistFeature 
        }),
        associations: L.geoJSON(AssociationsTour, { 
          pointToLayer: createTourMarker('Groups'),
          onEachFeature: onEachAssociationFeature 
        }),
        authors: L.geoJSON(AuthorsTour, { 
          pointToLayer: createTourMarker('AuthPub'),
          onEachFeature: onEachAuthorFeature 
        }),
        business: L.geoJSON(BusinessTour, { 
          pointToLayer: createTourMarker('Business'),
          onEachFeature: onEachBusinessFeature 
        }),
        civilWar: L.geoJSON(CivilWarTour, { 
          pointToLayer: createTourMarker('CivilWar'),
          onEachFeature: onEachCivilWarFeature 
        }),
        pillars: L.geoJSON(PillarsTour, { 
          pointToLayer: createTourMarker('Pillars'),
          onEachFeature: onEachPillarFeature 
        }),
        mayors: L.geoJSON(MayorsTour, { 
          pointToLayer: createTourMarker('MayorsOfAlbany'),
          onEachFeature: onEachMayorFeature 
        }),
        gar: L.geoJSON(GARTour, { 
          pointToLayer: createTourMarker('GAR'),
          onEachFeature: onEachGARFeature 
        }),
        boundary: L.geoJSON(ARC_Boundary, { style: exteriorStyle }),
        roads: L.geoJSON(ARC_Roads, { style: roadStyle }),
        sections: L.geoJSON(ARC_Sections, { onEachFeature: onEachSection })
      };

      // Set feature layers
      setFeaturesLayer(layers.lot7);
      setFeaturesLayer2(layers.sec49);
      setFeaturesLayer3(layers.notables);
      setFeaturesLayer4(layers.independence);
      setFeaturesLayer5(layers.africanAmerican);
      setFeaturesLayer6(layers.artist);
      setFeaturesLayer7(layers.associations);
      setFeaturesLayer8(layers.authors);
      setFeaturesLayer9(layers.business);
      setFeaturesLayer10(layers.civilWar);
      setFeaturesLayer11(layers.pillars);
      setFeaturesLayer12(layers.mayors);
      setFeaturesLayer13(layers.gar);

      // Create overlay maps
      const newOverlayMaps = {
        "Soldier's Lot (Section 75, Lot 7)": layers.lot7,
        "Section 49": layers.sec49,
        "Notables Tour 2020": layers.notables,
        "Independence Tour 2020": layers.independence,
        "African American Tour 2020": layers.africanAmerican,
        "Artists Tour 2020": layers.artist,
        "Associations, Societies, & Groups Tour 2020": layers.associations,
        "Authors & Publishers Tour 2020": layers.authors,
        "Business & Finance Tour 2020": layers.business,
        "Civil War Tour 2020": layers.civilWar,
        "Pillars of Society Tour 2020": layers.pillars,
        "Mayors of Albany": layers.mayors,
        "Grand Army of the Republic": layers.gar,
        "Albany Rural Cemetery Boundary": layers.boundary,
        "Albany Rural Cemetery Roads": layers.roads,
        "Section Boundaries": layers.sections
      };

      setOverlayMaps(newOverlayMaps);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
    }
  }, [onEachLot7Feature, onEachSec49Feature, onEachNotableFeature, onEachIndepFeature, 
      onEachAAFeature, onEachArtistFeature, onEachAssociationFeature, onEachAuthorFeature,
      onEachBusinessFeature, onEachCivilWarFeature, onEachPillarFeature, onEachMayorFeature,
      onEachGARFeature, onEachSection]);

  // Adjust zoom levels
  const ZOOM_LEVELS = {
    SECTION: 16,    // Show section info
    CLUSTER: 17,    // Show clusters
    INDIVIDUAL: 20  // Show individual markers
  };

  // Create searchable options from burial data with enhanced search capabilities
  const searchOptions = useMemo(() => 
    geo_burials.features.map(feature => ({
      label: `${feature.properties.First_Name} ${feature.properties.Last_Name}`,
      searchableLabel: `${feature.properties.First_Name} ${feature.properties.Last_Name} (Section ${feature.properties.Section}, Lot ${feature.properties.Lot})`,
      key: `${feature.properties.OBJECTID}_${feature.properties.First_Name}_${feature.properties.Last_Name}_Section${feature.properties.Section}_Lot${feature.properties.Lot}`,
      ...feature.properties,
      coordinates: feature.geometry.coordinates
    })).filter(option => option.First_Name || option.Last_Name)
  , []);

  // Filter burials based on section/lot/tier
  const filteredBurials = useMemo(() => {
    if (!showAllBurials || !sectionFilter) return [];
    
    return geo_burials.features.filter(feature => {
      const props = feature.properties;
      
      // Always require a section filter
      if (props.Section !== sectionFilter) {
        return false;
      }
      
      // Apply lot/tier filter if present
      if (lotTierFilter) {
        if (filterType === 'lot' && props.Lot !== lotTierFilter) {
          return false;
        }
        if (filterType === 'tier' && props.Tier !== lotTierFilter) {
          return false;
        }
      }
      
      return true;
    }).map(feature => ({
      ...feature.properties,
      coordinates: feature.geometry.coordinates
    }));
  }, [showAllBurials, sectionFilter, lotTierFilter, filterType]);

  // Update location tracking to be live
  const onLocateMarker = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser');
      return;
    }

    // Clear any existing watch
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }

    setStatus('Locating...');
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const point = turf.point([position.coords.longitude, position.coords.latitude]);
        const boundaryPolygon = ARC_Boundary.features[0];
        const bufferedBoundary = turf.buffer(boundaryPolygon, 8, { units: 'kilometers' });
        const isWithinBuffer = turf.booleanPointInPolygon(point, bufferedBoundary);
        
        if (isWithinBuffer) {
          setStatus('Location active');
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
        } else {
          setStatus('You must be within 5 miles of Albany Rural Cemetery');
          setLat(null);
          setLng(null);
        }
      },
      (error) => {
        setStatus('Unable to retrieve your location');
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
    setWatchId(id);
  };

  // Cleanup geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Function to start routing to a burial
  const startRouting = (burial) => {
    if (!lat || !lng) {
      setStatus('Please enable location tracking first');
      return;
    }
    setRoutingDestination([burial.coordinates[1], burial.coordinates[0]]);
  };

  // Function to stop routing
  const stopRouting = () => {
    setRoutingDestination(null);
  };

  // Enhance the smart search function to include tour searches
  const smartSearch = (options, searchInput) => {
    const input = searchInput.toLowerCase().trim();
    if (!input) return [];

    // Check if input is a year (4 digits)
    const yearPattern = /^\d{4}$/;
    if (yearPattern.test(input)) {
      return options.filter(option => 
        (option.Birth && option.Birth.includes(input)) ||
        (option.Death && option.Death.includes(input))
      );
    }

    // Check if input is looking for section (e.g., "section 1" or "sec 1")
    const sectionPattern = /^(section|sec)\s*([a-zA-Z0-9]+)$/i;
    const sectionMatch = input.match(sectionPattern);
    if (sectionMatch) {
      const sectionQuery = sectionMatch[2];
      return options.filter(option => 
        option.Section && option.Section.toString().toLowerCase() === sectionQuery.toLowerCase()
      );
    }

    // Check if input is looking for lot (e.g., "lot 123")
    const lotPattern = /^lot\s*(\d+)$/i;
    const lotMatch = input.match(lotPattern);
    if (lotMatch) {
      const lotQuery = lotMatch[1];
      return options.filter(option => 
        option.Lot && option.Lot.toString() === lotQuery
      );
    }

    // Check if input is looking for a tour (e.g., "notable tour", "civil war tour", etc.)
    const tourPattern = /^(.*?)\s*tour$/i;
    const tourMatch = input.match(tourPattern);
    if (tourMatch) {
      const tourQuery = tourMatch[1].toLowerCase();
      return options.filter(option => {
        if (!option.title) return false;
        const tourName = TOURS[option.title]?.name.toLowerCase() || '';
        return tourName.includes(tourQuery);
      });
    }

    // Check if input matches any tour keywords
    const tourKeywords = Object.values(TOURS).map(tour => tour.name.toLowerCase());
    const matchesTour = tourKeywords.some(keyword => keyword.includes(input));
    if (matchesTour) {
      return options.filter(option => {
        if (!option.title) return false;
        const tourName = TOURS[option.title]?.name.toLowerCase() || '';
        return tourName.includes(input);
      });
    }

    // Check if input is just a number (assume it could be section, lot, or year)
    const numberPattern = /^\d+$/;
    if (numberPattern.test(input)) {
      return options.filter(option => 
        (option.Section && option.Section.toString() === input) ||
        (option.Lot && option.Lot.toString() === input) ||
        (option.Birth && option.Birth.includes(input)) ||
        (option.Death && option.Death.includes(input))
      );
    }

    // Default: search by name and tour information
    return options.filter(option => {
      const nameMatch = option.searchableLabel.toLowerCase().includes(input);
      const tourMatch = option.title && TOURS[option.title]?.name.toLowerCase().includes(input);
      return nameMatch || tourMatch;
    });
  };

  const handleSearch = (event, value) => {
    if (value) {
      if (typeof value === 'string') {
        // If it's a string, find the matching burial
        const matches = smartSearch(searchOptions, value);
        if (matches.length > 0) {
          addToResults(matches[0]);
        }
      } else {
        addToResults(value);
      }
    }
  };

  const addToResults = (burial) => {
    if (burial && !selectedBurials.some(b => b.OBJECTID === burial.OBJECTID)) {
      setSelectedBurials(prev => [...prev, burial]);
      setCurrentSelection(null);
      setInputValue('');
      
      // Only pan to location when adding
      if (window.mapInstance) {
        window.mapInstance.panTo([burial.coordinates[1], burial.coordinates[0]], {
          duration: 1.5
        });
      }
    }
  };

  const removeFromResults = (objectId) => {
    setSelectedBurials(prev => prev.filter(burial => burial.OBJECTID !== objectId));
  };

  const clearSearch = () => {
    setSelectedBurials([]);
    setInputValue('');
    setCurrentSelection(null);
  };

  const handleResultClick = (burial, index) => {
    if (window.mapInstance) {
      const map = window.mapInstance;
      map.flyTo(
        [burial.coordinates[1], burial.coordinates[0]],
        ZOOM_LEVEL,
        {
          duration: 1.5,
          easeLinearity: 0.25
        }
      );
    }
  };

  const handleMarkerClick = (burial, index) => {
    if (window.mapInstance) {
      const map = window.mapInstance;
      // Just pan for marker clicks
      map.panTo([burial.coordinates[1], burial.coordinates[0]], {
        duration: 1.5
      });
    }
  };
const createClusterGroup = useCallback(() => {
  return L.markerClusterGroup({
    maxClusterRadius: 70,
    disableClusteringAtZoom: 21,
    spiderfyOnMaxZoom: false,
    removeOutsideVisibleBounds: true,
    chunkedLoading: true,
    chunkInterval: 200,
    chunkDelay: 50,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div style="
          background-color: rgba(0,123,255,0.6);
          border: none;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
        ">${count}</div>`,
        className: 'custom-cluster-icon',
        iconSize: [30, 30]
      });
    }
  });
}, []);


  // Add CSS styles for markers and clusters
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-popup {
        max-width: 300px !important;
      }
      
      .custom-popup img {
        display: block;
        max-width: 200px;
        max-height: 200px;
        margin: 8px auto;
        border: 2px solid #ccc;
        border-radius: 4px;
      }
      
      .marker-cluster {
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        width: 40px;
        height: 40px;
        margin-left: -20px;
        margin-top: -20px;
        text-align: center;
        font-weight: bold;
        font-size: 14px;
        color: #fff;
        text-shadow: 0 0 2px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .tour-marker {
        transition: all 0.3s ease;
      }
      
      .tour-marker:hover {
        transform: scale(1.2);
      }
      
      .tour-marker div {
        transition: all 0.3s ease;
      }
      
      .tour-marker:hover div {
        transform: scale(1.2);
        box-shadow: 0 0 8px rgba(0,0,0,0.6);
      }
      
      .custom-cluster {
        background: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Update filtered burials marker creation
  useEffect(() => {
    if (!window.mapInstance || !showAllBurials || !sectionFilter) return;

    if (markerClusterRef.current) {
      markerClusterRef.current.clearLayers();
      window.mapInstance.removeLayer(markerClusterRef.current);
    }

    const clusterGroup = createClusterGroup();
    markerClusterRef.current = clusterGroup;

    filteredBurials.forEach(burial => {
      const marker = L.circleMarker([burial.coordinates[1], burial.coordinates[0]], {
        ...markerStyle,
        radius: 6
      });

      const popupContent = `
        <div class="custom-popup">
          <h3>${burial.First_Name} ${burial.Last_Name}</h3>
          <p>Section: ${burial.Section}</p>
          <p>Lot: ${burial.Lot}</p>
          <p>Tier: ${burial.Tier}</p>
          <p>Grave: ${burial.Grave}</p>
          <p>Birth: ${burial.Birth}</p>
          <p>Death: ${burial.Death}</p>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });

      clusterGroup.addLayer(marker);
    });

    window.mapInstance.addLayer(clusterGroup);

    return () => {
      if (markerClusterRef.current) {
        window.mapInstance.removeLayer(markerClusterRef.current);
      }
    };
  }, [filteredBurials, showAllBurials, sectionFilter, createClusterGroup]);

  // Handle map zoom changes
  const handleZoomEnd = useCallback((e) => {
    const map = e.target;
    setCurrentZoom(map.getZoom());
  }, []);

  // Add zoom handler to map
  useEffect(() => {
    if (!window.mapInstance) return;
    
    window.mapInstance.on('zoomend', handleZoomEnd);
    
    return () => {
      window.mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [handleZoomEnd]);

  const handleTourSelect = useCallback((tourName) => {
    setSelectedTour(tourName);
  }, []);

  return (
    <div className="map-container">
      {/* Left sidebar with search and filters */}
      <Paper 
        elevation={3}
        className="left-sidebar"
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Autocomplete
              freeSolo
              options={searchOptions}
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option;
                }
                return option.searchableLabel || '';
              }}
              onChange={handleSearch}
              value={currentSelection || null}
              inputValue={inputValue}
              onInputChange={(event, newInputValue, reason) => {
                setInputValue(newInputValue);
                if (reason === 'clear') {
                  setCurrentSelection(null);
                }
              }}
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search by name, year, section, tour..."
                  variant="outlined"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) => {
                return smartSearch(options, inputValue).slice(0, 100);
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.key}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="body1">
                      {option.First_Name} {option.Last_Name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Section {option.Section}, Lot {option.Lot}
                        {option.Birth && ` • Born ${option.Birth}`}
                        {option.Death && ` • Died ${option.Death}`}
                      </Typography>
                      {option.title && (
                        <Typography 
                          variant="body2"
                          sx={{
                            color: 'white',
                            backgroundColor: TOURS[option.title]?.color || 'grey',
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            ml: 'auto'
                          }}
                        >
                          {TOURS[option.title]?.name || option.title}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </li>
              )}
            />
            {currentSelection && (
              <IconButton 
                onClick={() => addToResults(currentSelection)}
                color="primary"
                size="small"
                sx={{ alignSelf: 'center' }}
              >
                <AddIcon />
              </IconButton>
            )}
          </Box>
          
          {/* Section Filter */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filter by Section
            </Typography>
            <Autocomplete
              options={UNIQUE_SECTIONS}
              value={sectionFilter || null}
              onChange={(event, newValue) => {
                setSectionFilter(newValue || '');
                if (newValue && !showAllBurials) {
                  setShowAllBurials(true);
                }
                if (newValue && window.mapInstance) {
                  // Find the section in ARC_Sections and zoom to it
                  const section = ARC_Sections.features.find(f => f.properties.Section === newValue);
                  if (section) {
                    const layer = L.geoJSON(section);
                    const bounds = layer.getBounds();
                    window.mapInstance.fitBounds(bounds, {
                      padding: [50, 50],
                      maxZoom: ZOOM_LEVELS.CLUSTER
                    });
                  }
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Section"
                  size="small"
                  fullWidth
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  Section {option}
                </li>
              )}
              getOptionLabel={(option) => `Section ${option}`}
              isOptionEqualToValue={(option, value) => option === value}
            />
          </Box>

          {/* Show All Burials Toggle - Only show when a section is selected */}
          {sectionFilter && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant={showAllBurials ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                fullWidth
                onClick={() => setShowAllBurials(!showAllBurials)}
                startIcon={showAllBurials ? <RemoveIcon /> : <AddIcon />}
              >
                {showAllBurials ? 'Hide Section Burials' : 'Show Section Burials'}
              </Button>
            </Box>
          )}

          {/* Filters - only shown when a section is selected */}
          {sectionFilter && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Filter Section {sectionFilter} Burials
              </Typography>
              
              {/* Lot/Tier Toggle */}
              <ButtonGroup 
                fullWidth 
                size="small" 
                sx={{ mt: 1 }}
              >
                <Button
                  variant={filterType === 'lot' ? 'contained' : 'outlined'}
                  onClick={() => setFilterType('lot')}
                >
                  Lot
                </Button>
                <Button
                  variant={filterType === 'tier' ? 'contained' : 'outlined'}
                  onClick={() => setFilterType('tier')}
                >
                  Tier
                </Button>
              </ButtonGroup>
              
              {/* Lot/Tier Filter */}
              <TextField
                fullWidth
                size="small"
                label={filterType === 'lot' ? 'Lot Number' : 'Tier Number'}
                value={lotTierFilter}
                onChange={(e) => setLotTierFilter(e.target.value)}
                margin="dense"
              />
              
              {/* Clear Filters */}
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                onClick={() => {
                  setLotTierFilter('');
                  setFilterType('lot');
                  setSectionFilter('');
                  setShowAllBurials(false);
                  // Reset map view to original bounds
                  if (window.mapInstance) {
                    const bounds = turf.bbox(ARC_Boundary.features[0]);
                    const padding = 0.01; // roughly 1km in decimal degrees
                    const southWest = [bounds[1] - padding, bounds[0] - padding];
                    const northEast = [bounds[3] + padding, bounds[2] + padding];
                    window.mapInstance.fitBounds([southWest, northEast]);
                  }
                }}
              >
                Clear Filters
              </Button>
            </Box>
          )}
          
          {/* Tour Filter */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filter by Tour
            </Typography>
            <TourFilter 
              overlayMaps={overlayMaps} 
              setShowAllBurials={setShowAllBurials} 
              onTourSelect={handleTourSelect}
            />
          </Box>
          
          {/* Location Button */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button 
              onClick={onLocateMarker} 
              variant='contained' 
              color='secondary' 
              size='small' 
              startIcon={<PinDropIcon />}
              sx={{ flex: 1 }}
            >
              {status}
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Search Results */}
        {selectedBurials.length > 0 && (
          <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Search Results ({selectedBurials.length})</Typography>
              <IconButton onClick={clearSearch} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <List>
              {selectedBurials.map((burial, index) => (
                <ListItem 
                  key={createUniqueKey(burial, index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleResultClick(burial, index)}
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: hoveredIndex === index ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      aria-label="remove" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromResults(burial.OBJECTID);
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Box
                    sx={{
                      width: hoveredIndex === index ? '32px' : '24px',
                      height: hoveredIndex === index ? '32px' : '24px',
                      borderRadius: '50%',
                      backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length],
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 1,
                      fontWeight: 'bold',
                      fontSize: hoveredIndex === index ? '16px' : '14px',
                      border: hoveredIndex === index ? '3px solid white' : '2px solid white',
                      boxShadow: hoveredIndex === index ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {index + 1}
                  </Box>
                  <ListItemText
                    primary={`${burial.First_Name} ${burial.Last_Name}`}
                    secondary={
                      <Box component="span">
                        <Typography component="span" variant="body2" display="block">Section: {burial.Section}</Typography>
                        <Typography component="span" variant="body2" display="block">Lot: {burial.Lot}</Typography>
                        <Typography component="span" variant="body2" display="block">Tier: {burial.Tier}</Typography>
                        <Typography component="span" variant="body2" display="block">Grave: {burial.Grave}</Typography>
                        <Typography component="span" variant="body2" display="block">Birth: {burial.Birth}</Typography>
                        <Typography component="span" variant="body2" display="block">Death: {burial.Death}</Typography>
                        {burial.title && (
                          <Typography 
                            component="span" 
                            variant="body2" 
                            display="block"
                            sx={{
                              mt: 1,
                              color: 'white',
                              backgroundColor: TOURS[burial.title]?.color || 'grey',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              display: 'inline-block'
                            }}
                          >
                            {TOURS[burial.title]?.name || burial.title}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>

      <MapContainer
        center={[42.704180, -73.731980]}
        zoom={14}
        className="map"
        zoomControl={false}
        maxZoom={25}
      >
        <CustomZoomControl />
        <DefaultExtentButton />
        <MapBounds />
        <MapController selectedBurials={selectedBurials} hoveredIndex={hoveredIndex} />
        <MapTourController selectedTour={selectedTour} overlayMaps={overlayMaps} />
        <LayersControl>
          <BaseLayer checked name="Imagery">
            <VectorBasemap name="ImageryClarity" />
          </BaseLayer>
          <BaseLayer name="Streets">
            <VectorBasemap name="Streets" />
          </BaseLayer>
          <LayerGroup>
            <LayersControl.Overlay name="Roads">
              <GeoJSON data={ARC_Roads} style={roadStyle} />
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay checked name="Boundary">
              <GeoJSON data={ARC_Boundary} style={exteriorStyle} />
            </LayersControl.Overlay>
          </LayerGroup>
          <LayerGroup>
            <LayersControl.Overlay checked name="Sections">
              <GeoJSON 
                data={ARC_Sections}
                style={(feature) => ({
                  fillColor: feature.properties.Section === sectionFilter ? '#4a90e2' : '#f8f9fa',
                  fillOpacity: feature.properties.Section === sectionFilter ? 0.4 : 0.05,
                  color: feature.properties.Section === sectionFilter ? '#2c5282' : '#999',
                  weight: feature.properties.Section === sectionFilter ? 2 : 1
                })}
                onEachFeature={(feature, layer) => {
                  // Create tooltip but don't bind it yet
                  const tooltip = L.tooltip({
                    permanent: true,
                    direction: 'center',
                    className: 'section-label'
                  });
                  
                  layer.on({
                    click: (e) => {
                      // Only handle section click if we didn't click a marker
                      if (!hoveredMarker) {
                        setSectionFilter(feature.properties.Section);
                        if (!showAllBurials) {
                          setShowAllBurials(true);
                        }
                        // Zoom to section bounds with lower max zoom
                        const bounds = layer.getBounds();
                        window.mapInstance.fitBounds(bounds, {
                          padding: [50, 50],
                          maxZoom: 17  // Reduced from ZOOM_LEVELS.CLUSTER
                        });
                      }
                      // Prevent event from propagating
                      L.DomEvent.stopPropagation(e);
                    },
                    // Show label on mouseover if not already selected
                    mouseover: () => {
                      if (feature.properties.Section !== sectionFilter && currentZoom < ZOOM_LEVELS.SECTION) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      }
                    },
                    // Hide label on mouseout if not selected
                    mouseout: () => {
                      if (feature.properties.Section !== sectionFilter && currentZoom < ZOOM_LEVELS.SECTION) {
                        layer.unbindTooltip();
                      }
                    },
                    // Update tooltip visibility on zoom
                    add: () => {
                      // Initial state - show if selected or zoomed in
                      if (feature.properties.Section === sectionFilter || currentZoom >= ZOOM_LEVELS.SECTION) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      }
                    }
                  });

                  // Watch for zoom changes to update label visibility
                  if (window.mapInstance) {
                    window.mapInstance.on('zoomend', () => {
                      const zoom = window.mapInstance.getZoom();
                      if (zoom >= ZOOM_LEVELS.SECTION || feature.properties.Section === sectionFilter) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      } else {
                        layer.unbindTooltip();
                      }
                    });
                  }
                }}
              />
            </LayersControl.Overlay>
          </LayerGroup>
          
          {/* Location Marker */}
          {lat && lng && (
            <Marker position={[lat, lng]}>
              <Popup>You are here.</Popup>
            </Marker>
          )}

          {/* Add Routing Control */}
          {routingDestination && lat && lng && (
            <RoutingControl
              from={[lat, lng]}
              to={routingDestination}
            />
          )}
          
 
          
          {/* Search Result Markers - Always on top */}
          {selectedBurials.map((burial, index) => (
            <Marker 
              key={createUniqueKey(burial, index)}
              position={[burial.coordinates[1], burial.coordinates[0]]}
              icon={createNumberedIcon(index + 1, hoveredIndex === index)}
              eventHandlers={{
                mouseover: () => setHoveredIndex(index),
                mouseout: () => setHoveredIndex(null),
                click: () => handleMarkerClick(burial, index)
              }}
              zIndexOffset={1000}
            >
              <Popup>
                <div>
                  <h3>{burial.First_Name} {burial.Last_Name}</h3>
                  <p>Section: {burial.Section}</p>
                  <p>Lot: {burial.Lot}</p>
                  <p>Tier: {burial.Tier}</p>
                  <p>Grave: {burial.Grave}</p>
                  <p>Birth: {burial.Birth}</p>
                  <p>Death: {burial.Death}</p>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    fullWidth
                    onClick={() => routingDestination ? stopRouting() : startRouting(burial)}
                    sx={{ mt: 1 }}
                  >
                    {routingDestination ? 'Stop Navigation' : 'Get Directions'}
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
