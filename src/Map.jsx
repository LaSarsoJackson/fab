// ============================================================================
// Imports
// ============================================================================

// React and Core Dependencies
import { React, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapContainer, Popup, Marker, GeoJSON, LayersControl, LayerGroup, useMap } from "react-leaflet";
import L, { divIcon } from 'leaflet';
import "./index.css";

// Leaflet and Related
import 'leaflet.markercluster/dist/leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'lrm-graphhopper';
import { BasemapLayer } from 'react-esri-leaflet';

// Material UI Components
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
  ButtonGroup,
  Button
} from '@mui/material';

// Material UI Icons
import PinDropIcon from '@mui/icons-material/PinDrop';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import HomeIcon from '@mui/icons-material/Home';

// GeoJSON Data
import geo_burials from "./data/Geo_Burials.json";
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import Sec75_Headstones from "./data/Projected_Sec75_Headstones.json";
import Sec49_Headstones from "./data/Projected_Sec49_Headstones.json";

// Tour Data
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

// Utilities
import * as turf from '@turf/turf';

// ============================================================================
// Constants and Configurations
// ============================================================================

// Tour Definitions
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

// Map Styles
const MAP_STYLES = {
  exterior: {
    color: "#ffffff",
    weight: 1.5,
    fillOpacity: .08
  },
  road: {
    color: '#000000',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.1
  },
  marker: {
    radius: 8,
    fillColor: "#ff7800",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  }
};

// Colors
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

// Map Settings
const ZOOM_LEVELS = {
  SECTION: 16,    // Show section info
  CLUSTER: 17,    // Show clusters
  INDIVIDUAL: 20  // Show individual markers
};

// Common popup configuration
const POPUP_CONFIG = {
  maxWidth: 300,
  className: 'custom-popup'
};

// Common marker configuration
const MARKER_CONFIG = {
  ...MAP_STYLES.marker,
  radius: 6
};

// Common list item styles
const LIST_ITEM_STYLES = {
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a popup content string for a burial feature
 * @param {Object} burial - The burial object containing feature properties
 * @param {boolean} includeDirectionsButton - Whether to include the directions button
 * @returns {string} HTML string for popup content
 */
const createBurialPopupContent = (burial, includeDirectionsButton = false) => {
  // Handle name variations
  const firstName = burial.First_Name || burial.First_name || '';
  const lastName = burial.Last_Name || '';
  const fullName = burial.Full_Name || `${firstName} ${lastName}`;
  
  // Handle section/lot variations
  const section = burial.Section || burial.ARC_Secton || burial.Sec_Disp || '';
  const lot = burial.Lot || burial.ARC_Lot || '';
  
  // Build HTML content
  let content = `
    <div class="custom-popup">
      <h3>${fullName}</h3>
      ${burial.Titles ? `<h4>${burial.Titles}</h4>` : ''}
      <p>Section: ${section}</p>
      <p>Lot: ${lot}</p>
      ${burial.Tier ? `<p>Tier: ${burial.Tier}</p>` : ''}
      ${burial.Grave ? `<p>Grave: ${burial.Grave}</p>` : ''}
      ${burial.Birth ? `<p>Birth: ${burial.Birth}</p>` : ''}
      ${burial.Death ? `<p>Death: ${burial.Death}</p>` : ''}
  `;

  // Add military-specific information if available
  if (burial.Unit || burial.Service_Re || burial.Highest_Ra) {
    content += `
      ${burial.Highest_Ra ? `<p><strong>Rank:</strong> ${burial.Highest_Ra}</p>` : ''}
      ${burial.Unit ? `<p><strong>Unit:</strong> ${burial.Unit}</p>` : ''}
      ${burial.Service_Re ? `<p><strong>Service Record:</strong> ${burial.Service_Re}</p>` : ''}
    `;
  }

  // Add tour-specific information if available
  if (burial.Tour_Bio || burial.Bio_Portra) {
    content += `
      ${burial.Tour_Bio ? `<p><strong>Bio ID:</strong> ${burial.Tour_Bio}</p>` : ''}
      ${burial.Bio_Portra && burial.Bio_Portra !== 'NONE' ? 
        `<img src="https://www.albany.edu/arce/images/${burial.Tour_Name || 'tour'}/${burial.Bio_Portra}" 
         alt="${fullName}" 
         onerror="this.style.display='none'"
         onload="this.style.display='block'"
         style="display: none;">` : ''}
    `;
  }

  // Add directions button if requested
  if (includeDirectionsButton) {
    content += '<button class="directions-button">Get Directions</button>';
  }

  content += '</div>';
  return content;
};

/**
 * Creates a marker style object based on whether it's highlighted
 * @param {number} index - The index of the marker
 * @param {boolean} isHighlighted - Whether the marker is highlighted
 * @returns {Object} Style object for the marker
 */
const createMarkerStyle = (index, isHighlighted) => ({
  width: isHighlighted ? '32px' : '24px',
  height: isHighlighted ? '32px' : '24px',
  borderRadius: '50%',
  backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length],
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 1,
  fontWeight: 'bold',
  fontSize: isHighlighted ? '16px' : '14px',
  border: isHighlighted ? '3px solid white' : '2px solid white',
  boxShadow: isHighlighted ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)',
  transition: 'all 0.2s ease'
});

/**
 * Creates a section style object based on whether it's selected
 * @param {string} currentSection - The currently selected section
 * @param {string} featureSection - The section of the feature being styled
 * @returns {Object} Style object for the section
 */
const createSectionStyle = (currentSection, featureSection) => ({
  fillColor: featureSection === currentSection ? '#4a90e2' : '#f8f9fa',
  fillOpacity: featureSection === currentSection ? 0.4 : 0.05,
  color: featureSection === currentSection ? '#2c5282' : '#999',
  weight: featureSection === currentSection ? 2 : 1
});

// Image path helper
const getImagePath = (imageName, tourType) => {
  if (!imageName || imageName === "NONE") {
    return 'https://www.albany.edu/arce/images/no-image.jpg';
  }
  
  if (process.env.NODE_ENV === 'development') {
    // Local development path using Python server
    return `http://localhost:8000/src/data/images/${imageName}`;
  }
  // Production path
  return `https://www.albany.edu/arce/images/${imageName}`;
};

// Create unique key for items
const createUniqueKey = (burial, index) => {
  return `${burial.OBJECTID}_${burial.Section}_${burial.Lot}_${burial.Grave}_${index}`;
};

// Create tour marker
const createTourMarker = (tourType) => (feature, latlng) => {
  const color = TOURS[tourType]?.color || '#000000';
  return L.marker(latlng, {
    icon: L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          background-color: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        ">
          <span style="color: white;">•</span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    }),
    zIndexOffset: 900
  });
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
  
  // Add biography link text if we have an image
  if (feature.properties.Bio_Portra && feature.properties.Bio_Portra !== "NONE") {
    content += `<dt>(Click image to view detailed biography)</dt>`;
  }
  
  // Add image if available
  if (feature.properties.Bio_Portra && feature.properties.Bio_Portra !== "NONE") {
    content += `
      <dt>
        <a href="https://www.albany.edu/~ja553726/bios/${feature.properties.Tour_Bio}.html" target="_blank">
          <img 
            src="${getImagePath(feature.properties.Bio_Portra, tourKey)}"
            style="max-width:200px; max-height:200px; border:2px solid #ccc; border-radius:4px; margin:8px 0;"
            loading="lazy"
            onerror="this.onerror=null; this.src='https://www.albany.edu/~ja553726/no-image.jpg';"
          />
        </a>
      </dt>`;
  }
  
  // Add additional burial information
  content += `
    <dt><b>Section:</b> ${feature.properties.Section || 'N/A'}</dt>
    <dt><b>Lot:</b> ${feature.properties.Lot || 'N/A'}</dt>
    ${feature.properties.Birth ? `<dt><b>Birth:</b> ${feature.properties.Birth}</dt>` : ''}
    ${feature.properties.Death ? `<dt><b>Death:</b> ${feature.properties.Death}</dt>` : ''}
    ${feature.properties.Description ? `<dt>${feature.properties.Description}</dt>` : ''}
  `;
  
  content += '</dl>';
  return content;
};

// Create numbered icon for markers
const createNumberedIcon = (number, isHighlighted = false) => {
  const colorIndex = (number - 1) % MARKER_COLORS.length;
  const color = MARKER_COLORS[colorIndex];
  const size = isHighlighted ? 32 : 24;
  
  return divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isHighlighted ? '3px' : '2px'} solid white;
        box-shadow: ${isHighlighted ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)'};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isHighlighted ? '16px' : '14px'};
      ">
        ${number}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

// ============================================================================
// Data Initialization
// ============================================================================

// Initialize sections
const UNIQUE_SECTIONS = Array.from(new Set(geo_burials.features.map(f => f.properties.Section))).sort((a, b) => {
  // Handle special case for section 100A
  if (a === '100A') return 1;
  if (b === '100A') return -1;
  return a - b;
});

// ============================================================================
// Helper Components
// ============================================================================

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

// Map bounds control
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

// Vector basemap component
function VectorBasemap({ name }) {
  return <BasemapLayer name={name} maxZoom={25} maxNativeZoom={19} />;
}

// Map controller for window instance
function MapController({ selectedBurials, hoveredIndex }) {
  const map = useMap();
  
  useEffect(() => {
    // Store the map instance in the window for access from outside
    window.mapInstance = map;
  }, [map]);
  
  return null;
}

// Default extent button
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

// Tour filter component
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

// Tour controller component
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

// Routing control component
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

// ============================================================================
// Styles
// ============================================================================

const CSS_STYLES = `
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
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .custom-popup img[style*="display: block"] {
    opacity: 1;
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
  
  .custom-div-icon {
    z-index: 1000;
  }
  
  .custom-cluster {
    background: none !important;
  }
  
  .leaflet-popup {
    transition: opacity 0.2s ease;
  }
  
  .leaflet-popup-content-wrapper {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  
  .leaflet-popup-content {
    margin: 12px;
  }
  
  .leaflet-container {
    font-family: inherit;
  }
  
  .section-label {
    background: none;
    border: none;
    box-shadow: none;
    font-weight: 600;
    text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
  }
`;

// ============================================================================
// Map Event Handlers
// ============================================================================

/**
 * Handles map zoom end events
 * @param {Object} map - The map instance
 * @param {Function} setCurrentZoom - Function to update current zoom level
 */
const handleMapZoomEnd = (map, setCurrentZoom) => {
  setCurrentZoom(map.getZoom());
};

/**
 * Handles marker click events
 * @param {Object} burial - The burial object
 * @param {Object} map - The map instance
 */
const handleMarkerClick = (burial, map) => {
  if (!map) return;
  map.panTo([burial.coordinates[1], burial.coordinates[0]], {
    duration: 1.5
  });
};

/**
 * Handles search result click events
 * @param {Object} burial - The burial object
 * @param {Object} map - The map instance
 */
const handleResultClick = (burial, map) => {
  if (!map || !burial || !burial.coordinates) return;
  
  // For GeoJSON features, coordinates are [longitude, latitude]
  // We need to swap them for Leaflet's [latitude, longitude]
  const lat = burial.coordinates[1];
  const lng = burial.coordinates[0];
  
  if (typeof lat !== 'number' || typeof lng !== 'number') return;

  map.flyTo(
    [lat, lng],
    ZOOM_LEVELS.SECTION,
    {
      duration: 1.5,
      easeLinearity: 0.25
    }
  );
};

// ============================================================================
// Search and Filter Utilities
// ============================================================================

/**
 * Smart search function that handles various search patterns
 * @param {Array} options - Array of searchable options
 * @param {string} searchInput - The search input string
 * @returns {Array} Filtered array of matching options
 */
const smartSearch = (options, searchInput) => {
  const input = searchInput.toLowerCase().trim();
  if (!input) return [];

  // Year search (4 digits)
  const yearPattern = /^\d{4}$/;
  if (yearPattern.test(input)) {
    return options.filter(option => 
      (option.Birth && option.Birth.includes(input)) ||
      (option.Death && option.Death.includes(input))
    );
  }

  // Section search
  const sectionPattern = /^(section|sec)\s*([a-zA-Z0-9]+)$/i;
  const sectionMatch = input.match(sectionPattern);
  if (sectionMatch) {
    const sectionQuery = sectionMatch[2];
    return options.filter(option => 
      option.Section && option.Section.toString().toLowerCase() === sectionQuery.toLowerCase()
    );
  }

  // Lot search
  const lotPattern = /^lot\s*(\d+)$/i;
  const lotMatch = input.match(lotPattern);
  if (lotMatch) {
    const lotQuery = lotMatch[1];
    return options.filter(option => 
      option.Lot && option.Lot.toString() === lotQuery
    );
  }

  // Tour search
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

  // General number search
  const numberPattern = /^\d+$/;
  if (numberPattern.test(input)) {
    return options.filter(option => 
      (option.Section && option.Section.toString() === input) ||
      (option.Lot && option.Lot.toString() === input) ||
      (option.Birth && option.Birth.includes(input)) ||
      (option.Death && option.Death.includes(input))
    );
  }

  // Default name and tour search
  return options.filter(option => {
    const nameMatch = option.searchableLabel.toLowerCase().includes(input);
    const tourMatch = option.title && TOURS[option.title]?.name.toLowerCase().includes(input);
    return nameMatch || tourMatch;
  });
};

/**
 * Creates a cluster group with custom styling
 * @returns {Object} L.markerClusterGroup instance
 */
const createClusterGroup = () => {
  return L.markerClusterGroup({
    maxClusterRadius: 80,
    disableClusteringAtZoom: 19,
    spiderfyOnMaxZoom: true,
    removeOutsideVisibleBounds: true,
    chunkedLoading: true,
    chunkInterval: 100,
    chunkDelay: 50,
    animate: false,
    maxClusterZoom: 18,
    zoomToBoundsOnClick: true,
    showCoverageOnHover: false,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      const size = count < 10 ? 30 : count < 100 ? 35 : 40;
      return L.divIcon({
        html: `<div style="
          background-color: rgba(0,123,255,0.85);
          border: 2px solid white;
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: ${count < 10 ? 14 : 12}px;
          font-weight: 600;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        ">${count}</div>`,
        className: 'custom-cluster-icon',
        iconSize: [size, size]
      });
    }
  });
};

// ============================================================================
// Main Component
// ============================================================================

export default function BurialMap() {
  // ============================================================================
  // State Management
  // ============================================================================
  
  const { BaseLayer, Overlay } = LayersControl;
  
  // Feature layers
  const [overlayMaps, setOverlayMaps] = useState({});

  // Location tracking
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [status, setStatus] = useState('Find me');
  const [watchId, setWatchId] = useState(null);

  // Search and selection
  const [selectedBurials, setSelectedBurials] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentSelection, setCurrentSelection] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Filters
  const [showAllBurials, setShowAllBurials] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [lotTierFilter, setLotTierFilter] = useState('');
  const [filterType, setFilterType] = useState('lot');
  const [currentZoom, setCurrentZoom] = useState(14);
  const [selectedTour, setSelectedTour] = useState(null);

  // Routing
  const [routingDestination, setRoutingDestination] = useState(null);

  // ============================================================================
  // Refs and Constants
  // ============================================================================

  const markerClusterRef = useRef(null);

  // ============================================================================
  // Feature Handlers
  // ============================================================================

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
        boundary: L.geoJSON(ARC_Boundary, { style: MAP_STYLES.exterior }),
        roads: L.geoJSON(ARC_Roads, { style: MAP_STYLES.road }),
        sections: L.geoJSON(ARC_Sections, { onEachFeature: onEachSection })
      };

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

  // Update handleResultClick to use the utility function
  const handleResultClickWrapper = (burial) => {
    handleResultClick(burial, window.mapInstance);
  };

  // Update handleMarkerClick to use the utility function
  const handleMarkerClickWrapper = (burial) => {
    handleMarkerClick(burial, window.mapInstance);
  };

  // Update handleZoomEnd to use the utility function
  useEffect(() => {
    if (!window.mapInstance) return;
    
    const handleZoom = (e) => handleMapZoomEnd(e.target, setCurrentZoom);
    window.mapInstance.on('zoomend', handleZoom);
    
    return () => {
      window.mapInstance.off('zoomend', handleZoom);
    };
  }, []);

  const handleTourSelect = useCallback((tourName) => {
    setSelectedTour(tourName);
  }, []);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initialize CSS styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = CSS_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Initialize map event handlers
  useEffect(() => {
    if (!window.mapInstance) return;
    
    const handleZoom = (e) => handleMapZoomEnd(e.target, setCurrentZoom);
    window.mapInstance.on('zoomend', handleZoom);
    
    return () => {
      window.mapInstance.off('zoomend', handleZoom);
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
      const marker = L.circleMarker([burial.coordinates[1], burial.coordinates[0]], MARKER_CONFIG);
      const popupContent = createBurialPopupContent(burial, true);
      marker.bindPopup(popupContent, POPUP_CONFIG);
      clusterGroup.addLayer(marker);
    });

    window.mapInstance.addLayer(clusterGroup);

    return () => {
      if (markerClusterRef.current) {
        window.mapInstance.removeLayer(markerClusterRef.current);
      }
    };
  }, [filteredBurials, showAllBurials, sectionFilter]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles section click events
   * @param {Object} feature - The clicked feature
   * @param {Object} layer - The layer object
   * @param {Function} setSectionFilter - Function to update section filter
   * @param {Function} setShowAllBurials - Function to update burial visibility
   * @param {Object} hoveredMarker - Currently hovered marker
   */
  const handleSectionClick = (feature, layer, setSectionFilter, setShowAllBurials, hoveredMarker) => {
    if (!hoveredMarker) {
      setSectionFilter(feature.properties.Section);
      if (!showAllBurials) {
        setShowAllBurials(true);
      }
      const bounds = layer.getBounds();
      window.mapInstance.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17
      });
    }
  };

  /**
   * Handles section tooltip visibility
   * @param {Object} feature - The feature object
   * @param {Object} layer - The layer object
   * @param {Object} tooltip - The tooltip object
   * @param {string} currentSection - Currently selected section
   * @param {number} zoom - Current zoom level
   */
  const updateSectionTooltip = (feature, layer, tooltip, currentSection, zoom) => {
    if (feature.properties.Section === currentSection || zoom >= ZOOM_LEVELS.SECTION) {
      tooltip.setContent(`Section ${feature.properties.Section_Di}`);
      layer.bindTooltip(tooltip).openTooltip();
    } else {
      layer.unbindTooltip();
    }
  };

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
              onChange={(event, newValue) => {
                if (newValue && typeof newValue === 'object') {
                  handleResultClickWrapper(newValue);
                  setSelectedBurials(prev => [...prev, newValue]);
                  setCurrentSelection(newValue);
                }
              }}
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
                onClick={() => handleResultClickWrapper(currentSelection)}
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
              <IconButton onClick={() => {
                setSelectedBurials([]);
                setInputValue('');
                setCurrentSelection(null);
              }} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <List>
              {selectedBurials.map((burial, index) => (
                <ListItem 
                  key={createUniqueKey(burial, index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => handleResultClickWrapper(burial)}
                  sx={LIST_ITEM_STYLES}
                  secondaryAction={
                    <IconButton 
                      edge="end" 
                      aria-label="remove" 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBurials(prev => prev.filter(b => b.OBJECTID !== burial.OBJECTID));
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <Box
                    sx={createMarkerStyle(index, hoveredIndex === index)}
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
            <Overlay name="Roads">
              <GeoJSON data={ARC_Roads} style={MAP_STYLES.road} />
            </Overlay>
          </LayerGroup>
          <LayerGroup>
            <Overlay checked name="Boundary">
              <GeoJSON data={ARC_Boundary} style={MAP_STYLES.exterior} />
            </Overlay>
          </LayerGroup>
          <LayerGroup>
            <Overlay checked name="Sections">
              <GeoJSON 
                data={ARC_Sections}
                style={(feature) => createSectionStyle(sectionFilter, feature.properties.Section)}
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
                      handleSectionClick(feature, layer, setSectionFilter, setShowAllBurials, hoveredIndex);
                      // Prevent event from propagating
                      L.DomEvent.stopPropagation(e);
                    },
                    // Show label on mouseover if not already selected
                    mouseover: () => {
                      updateSectionTooltip(feature, layer, tooltip, sectionFilter, currentZoom);
                    },
                    // Hide label on mouseout if not selected
                    mouseout: () => {
                        layer.unbindTooltip();
                    },
                    // Update tooltip visibility on zoom
                    add: () => {
                      updateSectionTooltip(feature, layer, tooltip, sectionFilter, currentZoom);
                    }
                  });

                  // Watch for zoom changes to update label visibility
                  if (window.mapInstance) {
                    window.mapInstance.on('zoomend', () => {
                      const zoom = window.mapInstance.getZoom();
                      updateSectionTooltip(feature, layer, tooltip, sectionFilter, zoom);
                    });
                  }
                }}
              />
            </Overlay>
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
                click: () => handleMarkerClickWrapper(burial)
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
