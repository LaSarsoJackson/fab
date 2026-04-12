/**
 * Albany Rural Cemetery Interactive Map Application
 * 
 * This React application provides an interactive map interface for the Albany Rural Cemetery,
 * featuring search capabilities, tour routes, burial locations, and navigation assistance.
 * The application integrates various mapping technologies and UI components to create
 * a user-friendly cemetery exploration tool.
 */

//=============================================================================
// External Dependencies
//=============================================================================

// React and Core Dependencies
import { React, useState, useEffect, useMemo, useRef, useCallback } from "react";

// Leaflet and Map-related Dependencies
import { MapContainer, Popup, Marker, GeoJSON, LayersControl, LayerGroup, useMap } from "react-leaflet";
import L from 'leaflet';  // Core Leaflet library for map functionality
import "./index.css";
import 'leaflet.markercluster/dist/leaflet.markercluster';  // Clustering support for markers
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-routing-machine';  // Routing capabilities
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'lrm-graphhopper';  // GraphHopper routing integration
import * as turf from '@turf/turf';  // Geospatial calculations library
import { BasemapLayer } from 'react-esri-leaflet';  // ESRI basemap integration

// Material-UI Components and Icons
import { 
  Autocomplete, TextField, Paper, InputAdornment, IconButton,
  List, ListItem, Divider, Box, Typography,
  ButtonGroup, Button, CircularProgress, Chip, Menu, MenuItem
} from '@mui/material';
import PinDropIcon from '@mui/icons-material/PinDrop';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import HomeIcon from '@mui/icons-material/Home';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import AppsIcon from '@mui/icons-material/Apps';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DirectionsIcon from '@mui/icons-material/Directions';
import LaunchIcon from '@mui/icons-material/Launch';

// Local Data and Styles
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import { buildSearchIndex, normalizeName, smartSearch, sortSectionValues } from "./lib/burialSearch";
import { buildDirectionsLink } from "./lib/navigationLinks";
import { parseDeepLinkState } from "./lib/urlState";

//=============================================================================
// Constants and Configuration
//=============================================================================

/**
 * Defines zoom level thresholds for different map behaviors
 */
const ZOOM_LEVELS = {
  SECTION: 16,    // Level at which section info becomes visible
  CLUSTER: 17,    // Level at which markers begin clustering
  INDIVIDUAL: 20  // Level at which individual markers are always visible
};

/**
 * Colors used for numbered markers in search results
 * Cycles through these colors for multiple markers
 */
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

/**
 * Default zoom level for focusing on specific locations
 */
const ZOOM_LEVEL = 18;

/**
 * Tour definitions with associated colors and display names
 */
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

//=============================================================================
// Style Definitions
//=============================================================================

/**
 * Style configuration for the cemetery boundary
 */
const exteriorStyle = {
  color: "#ffffff",
  weight: 1.5,
  fillOpacity: .08
};

/**
 * Style configuration for cemetery roads
 */
const roadStyle = {
  color: '#000000',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.1
};

//=============================================================================
// React Components
//=============================================================================

/**
 * Custom zoom control component that provides zoom in/out buttons
 * Positioned at the top-right corner of the map
 */
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

/**
 * Component that restricts map bounds and zoom levels to the cemetery area
 * Uses Turf.js for geospatial calculations
 */
function MapBounds() {
  const map = useMap();
  const boundaryPolygon = ARC_Boundary.features[0];
  
  useEffect(() => {
    // Calculate the bounds of the boundary polygon using Turf.js
    const bounds = turf.bbox(boundaryPolygon);
    
    // Add significant padding to the bounds (about 1km)
    const padding = 0.01; // roughly 1km in decimal degrees
    const southWest = [bounds[1] - padding, bounds[0] - padding];
    const northEast = [bounds[3] + padding, bounds[2] + padding];
    
    const paddedBounds = [southWest, northEast];
    
    // Set map constraints
    map.setMaxBounds(paddedBounds);
    map.setMinZoom(13);
    map.setMaxZoom(25);

    // Initial fit to bounds
    map.once('load', () => {
      map.fitBounds(paddedBounds);
    });
  }, [map, boundaryPolygon]);
  
  return null;
}

/**
 * Component that renders the ESRI vector basemap
 */
function VectorBasemap({ name }) {
  return <BasemapLayer name={name} maxZoom={25} maxNativeZoom={19} />;
}

/**
 * Component that manages map state and provides access to the map instance
 */
function MapController({ selectedBurials, hoveredIndex }) {
  const map = useMap();
  
  useEffect(() => {
    // Store the map instance globally for external access
    window.mapInstance = map;
  }, [map]);
  
  return null;
}

/**
 * Button component that resets the map view to the default extent
 */
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

/**
 * Component that manages routing between two points using GraphHopper
 */
function RoutingControl({ from, to }) {
  const map = useMap();
  const [routingError, setRoutingError] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  useEffect(() => {
    if (!from || !to) return;

    setRoutingError(null);
    setIsCalculating(true);

    const apiKey = process.env.REACT_APP_GRAPHHOPPER_API_KEY;
    if (!apiKey) {
      console.error('GraphHopper API key not found in environment variables');
      setRoutingError('Configuration error: API key not found. Please contact administrators.');
      setIsCalculating(false);
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
      createMarker: function() { return null; },
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
      show: false
    }).addTo(map);

    routingControl.on('routesfound', () => {
      setIsCalculating(false);
    });

    routingControl.on('routingerror', (e) => {
      console.error('Routing error:', e);
      
      if (e.error && e.error.status === 0) {
        setRoutingError('Network error: Please check your internet connection.');
      } else if (e.error && e.error.status === 401) {
        setRoutingError('Authentication error: Invalid API key.');
      } else if (e.error && e.error.status === 429) {
        setRoutingError('Too many requests: Rate limit exceeded.');
      } else {
        setRoutingError('Unable to calculate route. The locations might be inaccessible by foot or too far apart.');
      }
      
      setIsCalculating(false);
      map.removeControl(routingControl);
    });

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, from, to]);

  if (isCalculating) {
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
          backgroundColor: '#f5f5f5',
          color: '#333',
        }}
      >
        <Typography>Calculating route...</Typography>
      </Paper>
    );
  }

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

//=============================================================================
// Helper Functions
//=============================================================================

/**
 * Creates a numbered marker icon for search results
 * @param {number} number - The number to display in the marker
 * @param {boolean} isHighlighted - Whether the marker should be highlighted
 * @returns {L.DivIcon} A Leaflet div icon configured with the specified number and styling
 */
const createNumberedIcon = (number, isHighlighted = false) => {
  const colorIndex = (number - 1) % MARKER_COLORS.length;
  const color = MARKER_COLORS[colorIndex];
  
  return L.divIcon({
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

/**
 * Creates a unique key for a burial record
 * @param {Object} burial - The burial record object
 * @param {number} index - The index of the burial in the list
 * @returns {string} A unique identifier string
 */
const createUniqueKey = (burial, index) => {
  return `${burial.OBJECTID}_${burial.Section}_${burial.Lot}_${burial.Grave}_${index}`;
};

const formatBurialName = (burial) => {
  const firstName = burial?.First_Name || '';
  const lastName = burial?.Last_Name || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown burial';
};


/**
 * Normalizes raw burial feature data into a UI-friendly record.
 *
 * This helper builds:
 * - a readable full name
 * - searchable text for the autocomplete
 * - a stable key for React rendering
 * - direct access to coordinates and burial properties
 */
const buildBurialRecord = (feature) => {
  const firstName = feature.properties.First_Name || '';
  const lastName = feature.properties.Last_Name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || 'Unknown burial';
  const searchableLabel = `${displayName} (Section ${feature.properties.Section}, Lot ${feature.properties.Lot})`.trim();

  const nameVariantsNormalized = [
    fullName,
    `${lastName} ${firstName}`.trim(),
    searchableLabel,
    `${firstName} ${lastName} Section ${feature.properties.Section} Lot ${feature.properties.Lot}`.trim(),
  ]
      .filter(Boolean)
      .map((value) => normalizeName(value));

  return {
    label: displayName,
    fullName,
    fullNameNormalized: normalizeName(fullName),
    nameVariantsNormalized,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLowerCase(),
    key: `${feature.properties.OBJECTID}_${firstName}_${lastName}_Section${feature.properties.Section}_Lot${feature.properties.Lot}`,
    ...feature.properties,
    coordinates: feature.geometry.coordinates,
  };
};

const findNearestRoadPoint = (lat, lng) => {
  const targetPoint = turf.point([lng, lat]);

  let nearestCoords = null;
  let minDistance = Infinity;

  ARC_Roads.features.forEach((feature) => {
    if (!feature?.geometry) return;

    const snapped = turf.nearestPointOnLine(feature, targetPoint, { units: 'meters' });
    const distance = snapped?.properties?.dist ?? turf.distance(targetPoint, snapped, { units: 'meters' });

    if (distance < minDistance) {
      minDistance = distance;
      nearestCoords = snapped.geometry.coordinates; // [lng, lat]
    }
  });

  if (!nearestCoords) {
    return [lat, lng];
  }

  return [nearestCoords[1], nearestCoords[0]]; // return [lat, lng]
};


/**
 * Converts a clicked tour feature into a sidebar-friendly record.
 */
const buildTourStopRecord = (feature, tourKey, layer) => {
  const latlng = typeof layer?.getLatLng === 'function' ? layer.getLatLng() : null;

  return {
    id: `${tourKey}-${feature?.properties?.OBJECTID || feature?.properties?.Full_Name || 'tour-stop'}`,
    title: feature?.properties?.Full_Name || TOURS[tourKey]?.name || 'Tour stop',
    subtitle: feature?.properties?.Titles || '',
    tourKey,
    coordinates: latlng ? [latlng.lng, latlng.lat] : null,
    feature,
  };
};

/**
 * Gets the image path for a burial record's photo
 * @param {string} imageName - The name of the image file
 * @returns {string} The complete URL path to the image
 */
const getImagePath = (imageName) => {
  if (!imageName || imageName === "NONE") return 'https://www.albany.edu/arce/images/no-image.jpg';
  
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:8000/src/data/images/${imageName}`;
  }
  return `https://www.albany.edu/arce/images/${imageName}`;
};

/**
 * Creates a marker for a tour point
 * @param {string} tourKey - The key identifying the tour
 * @returns {Function} A function that creates a Leaflet marker or circle marker
 */
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

/**
 * Creates HTML content for a tour point popup
 * @param {Object} feature - The GeoJSON feature containing burial information
 * @param {string} tourKey - The key identifying the tour
 * @returns {string} HTML content for the popup
 */
const createTourPopupContent = (feature, tourKey, buttonIds = {}) => {
  const { centerBtnId = '', routeBtnId = '', mapsBtnId = '' } = buttonIds;

  const fullName = feature?.properties?.Full_Name || TOURS[tourKey]?.name || 'Tour stop';
  const titles = feature?.properties?.Titles || '';
  const portrait = feature?.properties?.Bio_Portra;
  const bioSlug = feature?.properties?.Tour_Bio;
  const bioHref = bioSlug
      ? `https://www.albany.edu/arce/${bioSlug}.html`
      : null;

  let content = `<div class="custom-popup"><dl class="popup-content">`;
  content += `<dt><b>${fullName}</b></dt><hr>`;

  if (titles) {
    content += `<dt>${titles}</dt>`;
  }

  content += `<dt>(Click image to view detailed biography)</dt>`;

  if (bioHref) {
    const imageSrc =
        portrait && portrait !== 'NONE'
            ? getImagePath(portrait)
            : 'https://www.albany.edu/arce/images/no-image.jpg';

    content += `
      <dt>
        <a href="${bioHref}" target="_blank" rel="noopener noreferrer">
          <img
            src="${imageSrc}"
            style="max-width:200px; max-height:200px; border:2px solid #ccc; border-radius:4px; margin:8px 0;"
            loading="lazy"
            onerror="this.onerror=null; this.src='https://www.albany.edu/arce/images/no-image.jpg';"
          />
        </a>
      </dt>
    `;
  }

  content += `
  <dt>
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
      <button
        data-tour-action="center"
        type="button"
        style="
          padding:6px 10px;
          border:1px solid #90caf9;
          background:#fff;
          color:#1976d2;
          border-radius:6px;
          cursor:pointer;
          font-size:12px;
          font-weight:600;
        "
      >
        CENTER ON MAP
      </button>

      <button
        data-tour-action="route"
        type="button"
        style="
          padding:6px 10px;
          border:none;
          background:#1976d2;
          color:#fff;
          border-radius:6px;
          cursor:pointer;
          font-size:12px;
          font-weight:600;
        "
      >
        GET DIRECTION
      </button>

      <button
        data-tour-action="maps"
        type="button"
        style="
          padding:6px 10px;
          border:1px solid #cfd8dc;
          background:#fff;
          color:#455a64;
          border-radius:6px;
          cursor:pointer;
          font-size:12px;
          font-weight:600;
        "
      >
        OPEN IN MAPS
      </button>
    </div>
  </dt>
`;

  content += `</dl></div>`;
  return content;
};

//=============================================================================
// Data Structures
//=============================================================================

/**
 * Tour data configuration with associated GeoJSON data
 */
const TOUR_DEFINITIONS = [
  { key: 'Lot7', name: "Soldier's Lot (Section 75, Lot 7)", load: () => import("./data/Projected_Sec75_Headstones.json") },
  { key: 'Sec49', name: "Section 49", load: () => import("./data/Projected_Sec49_Headstones.json") },
  { key: 'Notable', name: "Notables Tour 2020", load: () => import("./data/NotablesTour20.json") },
  { key: 'Indep', name: "Independence Tour 2020", load: () => import("./data/IndependenceTour20.json") },
  { key: 'Afr', name: "African American Tour 2020", load: () => import("./data/AfricanAmericanTour20.json") },
  { key: 'Art', name: "Artists Tour 2020", load: () => import("./data/ArtistTour20.json") },
  { key: 'Groups', name: "Associations, Societies, & Groups Tour 2020", load: () => import("./data/AssociationsTour20.json") },
  { key: 'AuthPub', name: "Authors & Publishers Tour 2020", load: () => import("./data/AuthorsPublishersTour20.json") },
  { key: 'Business', name: "Business & Finance Tour 2020", load: () => import("./data/BusinessFinanceTour20.json") },
  { key: 'CivilWar', name: "Civil War Tour 2020", load: () => import("./data/CivilWarTour20.json") },
  { key: 'Pillars', name: "Pillars of Society Tour 2020", load: () => import("./data/SocietyPillarsTour20.json") },
  { key: 'MayorsOfAlbany', name: "Mayors of Albany", load: () => import("./data/AlbanyMayors_fixed.json") },
  { key: 'GAR', name: "Grand Army of the Republic", load: () => import("./data/GAR_fixed.json") }
];

/**
 * Default style for burial markers
 */
const markerStyle = {
  radius: 8,
  fillColor: "#ff7800",
  color: "#000",
  weight: 1,
  opacity: 1,
  fillOpacity: 0.8
};

//=============================================================================
// Tour Components
//=============================================================================

/**
 * Component for filtering and selecting cemetery tours
 */
function TourFilter({ setShowAllBurials, onTourSelect }) {
  return (
    <Autocomplete
      options={TOUR_DEFINITIONS}
      getOptionLabel={(option) => option.name}
      onChange={(event, newValue) => {
        setShowAllBurials(true);
        const tourName = newValue ? newValue.name : null;
        onTourSelect(tourName);
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
              backgroundColor: TOURS[option.key].color,
              display: 'inline-block'
            }}
          />
          {option.name}
        </li>
      )}
    />
  );
}

/**
 * Component that manages the visibility of tour layers on the map
 */
function MapTourController({ selectedTour, overlayMaps, tourNames }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !overlayMaps) return;

    // Remove all tour layers first
    tourNames.forEach((name) => {
      const layer = overlayMaps[name];
      if (layer) {
        map.removeLayer(layer);
      }
    });

    // Add only the selected tour layer if it exists
    if (selectedTour) {
      const layer = overlayMaps[selectedTour];
      if (layer) {
        map.addLayer(layer);
      }
    }
  }, [map, selectedTour, overlayMaps, tourNames]);
  
  return null;
}

// /**
//  * Creates event handlers for tour features
//  * @param {string} tourKey - The key identifying the tour
//  * @returns {Function} Event handler for the tour feature
//  */
// const createOnEachTourFeature = (tourKey) => (feature, layer) => {
//   if (feature.properties && feature.properties.Full_Name) {
//     const content = createTourPopupContent(feature, tourKey);
//     layer.bindPopup(content, {
//       maxWidth: 300,
//       className: 'custom-popup'
//     });
//     feature.properties.title = tourKey;
//   }
// };

//=============================================================================
// Main Map Component
//=============================================================================

/**
 * Main component for the Albany Rural Cemetery interactive map
 * Provides functionality for:
 * - Searching and displaying burial locations
 * - Filtering by section, lot, and tier
 * - Displaying themed cemetery tours
 * - Real-time location tracking
 * - Turn-by-turn navigation to burial sites
 */
export default function BurialMap() {
  //-----------------------------------------------------------------------------
  // State Management
  //-----------------------------------------------------------------------------
  
  // Map and UI State
  const [overlayMaps, setOverlayMaps] = useState({});
  const [currentZoom, setCurrentZoom] = useState(14);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);
  
  // Search and Filter State
  const [selectedBurials, setSelectedBurials] = useState([]);
  const [selectedTourStops, setSelectedTourStops] = useState([]);
  const [activeTourStopId, setActiveTourStopId] = useState(null);
  const [activeBurialId, setActiveBurialId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [showAllBurials, setShowAllBurials] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [lotTierFilter, setLotTierFilter] = useState('');
  const [filterType, setFilterType] = useState('lot');
  const [burialFeatures, setBurialFeatures] = useState([]);
  const [isBurialDataLoading, setIsBurialDataLoading] = useState(true);
  const [burialDataError, setBurialDataError] = useState('');
  const [tourLayerError, setTourLayerError] = useState('');
  const [loadingTourName, setLoadingTourName] = useState('');
  const [searchIndex, setSearchIndex] = useState(null);
  const [isSearchIndexReady, setIsSearchIndexReady] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  
  // Location and Routing State
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [status, setStatus] = useState('Location inactive');
  const [routingDestination, setRoutingDestination] = useState(null);
  const [routingOrigin, setRoutingOrigin] = useState(null);
  const [activeRouteBurialId, setActiveRouteBurialId] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState(null);
  const [directionsMenuAnchorEl, setDirectionsMenuAnchorEl] = useState(null);
  const [directionsMenuBurial, setDirectionsMenuBurial] = useState(null);

  // Component References
  const { BaseLayer } = LayersControl;
  const markerClusterRef = useRef(null);
  const pendingPopupBurialIdRef = useRef(null);
  const didApplyUrlStateRef = useRef(false);
  const loadedTourNamesRef = useRef(new Set());
  const loadingTourNamesRef = useRef(new Set());
  const selectedBurialRefs = useRef(new Map());
  const latestLatRef = useRef(null);
  const latestLngRef = useRef(null);
  const selectedBurialMarkerRefs = useRef(new Map());
  const pendingSelectedPopupBurialIdRef = useRef(null);

  //-----------------------------------------------------------------------------
  // Memoized Values
  //-----------------------------------------------------------------------------

  const uniqueSections = useMemo(
    () => Array.from(new Set(burialFeatures.map((feature) => feature.properties.Section))).sort(sortSectionValues),
    [burialFeatures]
  );

  const getTourName = useCallback(
    (option) => TOURS[option.title]?.name || option.title || '',
    []
  );

  const tourDefinitionsByName = useMemo(
    () => new Map(TOUR_DEFINITIONS.map((definition) => [definition.name, definition])),
    []
  );
  const tourNames = useMemo(
    () => TOUR_DEFINITIONS.map((definition) => definition.name),
    []
  );
  const appMenuOpen = Boolean(appMenuAnchorEl);
  const directionsMenuOpen = Boolean(directionsMenuAnchorEl);
  const isAppleMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;

    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);
  const showIosInstallHint = isAppleMobile && !isInstalled && !installPromptEvent;

  /**
   * Create searchable options from burial data
   * Includes name, section, lot, and tour information
   */
  const searchOptions = useMemo(() => (
    burialFeatures
      .map(buildBurialRecord)
      .filter((option) => option.First_Name || option.Last_Name)
  ), [burialFeatures]);

  /**
   * Filter burials based on section/lot/tier criteria
   */
  const filteredBurials = useMemo(() => {
    if (!showAllBurials || !sectionFilter) return [];
    
    return burialFeatures.filter(feature => {
      const props = feature.properties;
      
      if (`${props.Section}` !== `${sectionFilter}`) {
        return false;
      }
      
      if (lotTierFilter) {
        if (filterType === 'lot' && `${props.Lot}` !== `${lotTierFilter}`) {
          return false;
        }
        if (filterType === 'tier' && `${props.Tier}` !== `${lotTierFilter}`) {
          return false;
        }
      }
      
      return true;
    }).map(buildBurialRecord);
  }, [burialFeatures, showAllBurials, sectionFilter, lotTierFilter, filterType]);

  /**
   * Build search indexes off the main interaction path.
   * This keeps first paint responsive even with large datasets.
   */
  useEffect(() => {
    if (!searchOptions.length) {
      setSearchIndex(null);
      setIsSearchIndexReady(false);
      return undefined;
    }

    let cancelled = false;
    let handle;
    setIsSearchIndexReady(false);

    const buildIndex = () => {
      const nextIndex = buildSearchIndex(searchOptions, { getTourName });
      if (!cancelled) {
        setSearchIndex(nextIndex);
        setIsSearchIndexReady(true);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      handle = window.requestIdleCallback(buildIndex, { timeout: 1500 });
    } else {
      handle = setTimeout(buildIndex, 0);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [searchOptions, getTourName]);

  //-----------------------------------------------------------------------------
  // Event Handlers
  //-----------------------------------------------------------------------------

  /**
   * Handles user location tracking
   * Checks if user is within 5 miles of the cemetery
   */
  const updateLocationFromPosition = useCallback((position) => {
    const point = turf.point([position.coords.longitude, position.coords.latitude]);
    const boundaryPolygon = ARC_Boundary.features[0];
    const bufferedBoundary = turf.buffer(boundaryPolygon, 8, { units: 'kilometers' });
    const isWithinBuffer = turf.booleanPointInPolygon(point, bufferedBoundary);

    if (isWithinBuffer) {
      setStatus('Location active');
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    }

    setStatus('You must be within 5 miles of Albany Rural Cemetery');
    setLat(null);
    setLng(null);
    return null;
  }, []);

  const handleLocationError = useCallback((error) => {
    setStatus('Unable to retrieve your location');
    console.error('Geolocation error:', error);
    return null;
  }, []);

  const requestCurrentLocation = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser');
      resolve(null);
      return;
    }

    setStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(updateLocationFromPosition(position));
      },
      (error) => {
        resolve(handleLocationError(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
  }), [handleLocationError, updateLocationFromPosition]);


  /**
   * Returns the latest known location from refs.
   * Falls back to a fresh geolocation request only when needed.
   */
  const getLatestAvailableLocation = useCallback(async () => {
    if (latestLatRef.current != null && latestLngRef.current != null) {
      return {
        latitude: latestLatRef.current,
        longitude: latestLngRef.current,
      };
    }

    return await requestCurrentLocation();
  }, [requestCurrentLocation]);

  /**
   * Starts user location tracking and updates the live position marker.
   *
   * This function:
   * - requests the current user location
   * - starts a geolocation watch
   * - keeps location state updated while the user moves
   */
  const onLocateMarker = useCallback(async () => {
    const location = await requestCurrentLocation();
    if (!location || !navigator.geolocation) {
      return;
    }

    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        updateLocationFromPosition(position);
      },
      (error) => {
        handleLocationError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
    setWatchId(id);
  }, [handleLocationError, requestCurrentLocation, updateLocationFromPosition, watchId]);

  /**
   * Moves the map to a burial and optionally adds it to the selected results.
   *
   * This is the main "focus" helper used by:
   * - search results
   * - marker clicks
   * - result list interactions
   *
   * It keeps map behavior consistent across different entry points.
   */
  const focusBurial = useCallback((burial, { addToSelection = false, clearSearchInput = false } = {}) => {
    if (!burial) return;

    if (addToSelection) {
      setSelectedBurials((prev) => (
        prev.some((item) => item.OBJECTID === burial.OBJECTID)
          ? prev
          : [...prev, burial]
      ));
    }

    if (clearSearchInput) {
      setInputValue('');
    }

    setActiveBurialId(burial.OBJECTID);

    if (window.mapInstance && Array.isArray(burial.coordinates)) {
      const map = window.mapInstance;
      const targetZoom = Math.max(map.getZoom(), ZOOM_LEVEL);
      map.flyTo(
        [burial.coordinates[1], burial.coordinates[0]],
        targetZoom,
        {
          duration: 1.5,
          easeLinearity: 0.25
        }
      );
    }
  }, []);

  const selectBurial = useCallback((burial, { clearSearchInput = false } = {}) => {
    focusBurial(burial, { addToSelection: true, clearSearchInput });
  }, [focusBurial]);

  /**
   * Tries a direct exact-name lookup before falling back to ranked smart search.
   * This makes full-name searches more reliable.
   */
  const findDirectExactMatch = useCallback((query) => {
    const normalizedQuery = normalizeName(query);

    return searchOptions.find((option) =>
        option.fullNameNormalized === normalizedQuery ||
        option.nameVariantsNormalized?.includes(normalizedQuery)
    ) || null;
  }, [searchOptions]);

  /**
   * Handles search input and selection
   */
  const handleSearch = useCallback((event, value) => {
    if (!value) return;

    if (typeof value === 'string') {
      const rawQuery = value.trim();
      if (rawQuery.length < 2) return;

      const directExactMatch = findDirectExactMatch(rawQuery);
      if (directExactMatch) {
        selectBurial(directExactMatch, { clearSearchInput: true });
        return;
      }

      const matches = smartSearch(searchOptions, rawQuery, {
        index: searchIndex,
        getTourName,
      });

      if (matches.length > 0) {
        const normalizedQuery = normalizeName(rawQuery);

        const exactFullNameMatch = matches.find(
            (item) =>
                item.fullNameNormalized === normalizedQuery ||
                item.nameVariantsNormalized?.includes(normalizedQuery)
        );

        selectBurial(exactFullNameMatch || matches[0], {
          clearSearchInput: true,
        });
      }

      return;
    }

    selectBurial(value, { clearSearchInput: true });
  }, [findDirectExactMatch, searchOptions, searchIndex, getTourName, selectBurial]);

  /**
   * Removes a burial from search results
   */
  const removeFromResults = useCallback((objectId) => {
    setSelectedBurials((prev) => prev.filter((burial) => burial.OBJECTID !== objectId));

    if (activeRouteBurialId === objectId) {
      setRoutingOrigin(null);
      setRoutingDestination(null);
      setActiveRouteBurialId(null);
    }

    if (directionsMenuBurial?.OBJECTID === objectId) {
      setDirectionsMenuAnchorEl(null);
      setDirectionsMenuBurial(null);
    }
  }, [activeRouteBurialId, directionsMenuBurial]);

  /**
   * Clears all search results
   */
  const clearSearch = useCallback(() => {
    setSelectedBurials([]);
    setActiveBurialId(null);
    setInputValue('');
    setRoutingOrigin(null);
    setRoutingDestination(null);
    setActiveRouteBurialId(null);
    setDirectionsMenuAnchorEl(null);
    setDirectionsMenuBurial(null);
  }, []);

  const handleOpenAppMenu = useCallback((event) => {
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const handleCloseAppMenu = useCallback(() => {
    setAppMenuAnchorEl(null);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }, [installPromptEvent]);

  const handleOpenDirectionsMenu = useCallback((event, burial) => {
    event.stopPropagation();
    setDirectionsMenuAnchorEl(event.currentTarget);
    setDirectionsMenuBurial(burial);
  }, []);

  const handleCloseDirectionsMenu = useCallback(() => {
    setDirectionsMenuAnchorEl(null);
    setDirectionsMenuBurial(null);
  }, []);

  /**
   * Handles clicking on a search result item
   */
  const handleResultClick = useCallback((burial) => {
    focusBurial(burial);
  }, [focusBurial]);

  /**
   * Handles clicking on a marker
   */
  const handleMarkerClick = useCallback((burial) => {
    selectBurial(burial);
  }, [selectBurial]);

  /**
   * Creates a marker cluster group with custom styling
   */
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

  /**
   * Starts turn-by-turn navigation to a burial location
   * @param {Object} burial - The burial record to navigate to
   */
  const startRouting = useCallback(async (burial) => {
    const location = lat && lng
        ? { latitude: lat, longitude: lng }
        : await requestCurrentLocation();

    if (!location) {
      return;
    }

    selectBurial(burial);

    const snappedDestination = findNearestRoadPoint(
        burial.coordinates[1],
        burial.coordinates[0]
    );

    setRoutingOrigin([location.latitude, location.longitude]);
    setRoutingDestination(snappedDestination);
    setActiveRouteBurialId(burial.OBJECTID);
  }, [lat, lng, requestCurrentLocation, selectBurial]);


  //-----------------------------------------------------------------------------
  // Effects
  //-----------------------------------------------------------------------------

  /**
   * Load the largest burial dataset asynchronously so the app shell renders first.
   */
  useEffect(() => {
    let ignore = false;

    const loadBurials = async () => {
      setIsBurialDataLoading(true);
      setBurialDataError('');
      try {
        const module = await import('./data/Geo_Burials.json');
        if (!ignore) {
          setBurialFeatures(module.default.features || []);
        }
      } catch (error) {
        console.error('Failed to load burial data:', error);
        if (!ignore) {
          setBurialDataError('Burial records failed to load. Refresh and try again.');
        }
      } finally {
        if (!ignore) {
          setIsBurialDataLoading(false);
        }
      }
    };

    loadBurials();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsInstalled(true);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsInstalled(Boolean(standalone));

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Apply URL-driven state once data is available for deep links from the companion app.
   */
  useEffect(() => {
    if (didApplyUrlStateRef.current) return;
    if (isBurialDataLoading) return;

    const deepLink = parseDeepLinkState(
      window.location.search,
      tourNames
    );

    if (deepLink.section) {
      setSectionFilter(deepLink.section);
      setShowAllBurials(true);
    }

    if (deepLink.showBurialsView) {
      setShowAllBurials(true);
    }

    if (deepLink.selectedTourName) {
      setSelectedTour(deepLink.selectedTourName);
    }

    if (deepLink.query && searchOptions.length > 0) {
      const matches = smartSearch(searchOptions, deepLink.query, {
        index: searchIndex,
        getTourName,
      });
      if (matches.length > 0) {
        selectBurial(matches[0]);
      }
      setInputValue(deepLink.query);
    }

    didApplyUrlStateRef.current = true;
  }, [isBurialDataLoading, searchOptions, searchIndex, getTourName, selectBurial, tourNames]);

  useEffect(() => {
    if (selectedBurials.length === 0) {
      if (activeBurialId !== null) {
        setActiveBurialId(null);
      }
      return;
    }

    if (!selectedBurials.some((burial) => burial.OBJECTID === activeBurialId)) {
      setActiveBurialId(selectedBurials[0].OBJECTID);
    }
  }, [activeBurialId, selectedBurials]);

  useEffect(() => {
    if (activeBurialId === null) return;

    const activeNode = selectedBurialRefs.current.get(activeBurialId);
    if (activeNode) {
      activeNode.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeBurialId, selectedBurials]);

    /**
     * Keeps the latest location in refs so cached popup handlers
     * can always use the newest coordinates.
     */
    useEffect(() => {
        latestLatRef.current = lat;
        latestLngRef.current = lng;
    }, [lat, lng]);

  /**
   * Opens the React popup for a selected burial after it has been added to the map.
   * This keeps the first click and second click popup behavior consistent.
   */
  useEffect(() => {
    if (!pendingSelectedPopupBurialIdRef.current) return;

    const targetId = pendingSelectedPopupBurialIdRef.current;
    const markerInstance = selectedBurialMarkerRefs.current.get(targetId);

    if (markerInstance) {
      setTimeout(() => {
        markerInstance.openPopup();
        pendingSelectedPopupBurialIdRef.current = null;
      }, 0);
    }
  }, [selectedBurials]);

  /**
   * Cleanup geolocation watch on unmount
   */
  useEffect(() => {
    return () => {
      if (watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  /**
   * Add custom CSS styles for markers and clusters
   */
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

  /**
   * Update filtered burials marker display
   */
  useEffect(() => {
    if (!window.mapInstance || !showAllBurials || !sectionFilter) return;

    if (markerClusterRef.current) {
      markerClusterRef.current.clearLayers();
      window.mapInstance.removeLayer(markerClusterRef.current);
    }

    const clusterGroup = createClusterGroup();
    markerClusterRef.current = clusterGroup;

    filteredBurials.forEach((burial) => {
      const marker = L.circleMarker([burial.coordinates[1], burial.coordinates[0]], {
        ...markerStyle,
        radius: activeBurialId === burial.OBJECTID ? 8 : 6
      });

      const centerBtnId = `center-btn-${burial.OBJECTID}`;
      const routeBtnId = `route-btn-${burial.OBJECTID}`;
      const removeBtnId = `remove-btn-${burial.OBJECTID}`;

      const popupContent = `
    <div class="custom-popup">
      <h3 style="margin: 0 0 8px 0;">${formatBurialName(burial)}</h3>
      <p style="margin: 4px 0;">Section: ${burial.Section}</p>
      <p style="margin: 4px 0;">Lot: ${burial.Lot}</p>
      <p style="margin: 4px 0;">Tier: ${burial.Tier}</p>
      <p style="margin: 4px 0;">Grave: ${burial.Grave}</p>
      <p style="margin: 4px 0;">Birth: ${burial.Birth || 'Unknown'}</p>
      <p style="margin: 4px 0;">Death: ${burial.Death || 'Unknown'}</p>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
        <button
          id="${centerBtnId}"
          type="button"
          style="
            padding: 6px 10px;
            border: 1px solid #90caf9;
            background: white;
            color: #1976d2;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
          "
        >
          CENTER ON MAP
        </button>

        <button
          id="${routeBtnId}"
          type="button"
          style="
            padding: 6px 10px;
            border: none;
            background: #1976d2;
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
          "
        >
          GET DIRECTION
        </button>

        <button
          id="${removeBtnId}"
          type="button"
          style="
            padding: 6px 10px;
            border: none;
            background: transparent;
            color: #555;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
          "
        >
          REMOVE
        </button>
      </div>
    </div>
  `;

      marker.bindPopup(popupContent, {
        maxWidth: 320,
        className: 'custom-popup'
      });

      marker.on('click', () => {
        pendingSelectedPopupBurialIdRef.current = burial.OBJECTID;
        selectBurial(burial);
      });

      marker.on('popupopen', () => {
        const centerBtn = document.getElementById(centerBtnId);
        const routeBtn = document.getElementById(routeBtnId);
        const removeBtn = document.getElementById(removeBtnId);

        if (centerBtn) {
          centerBtn.onclick = (event) => {
            event.stopPropagation();
            handleResultClick(burial);
          };
        }

        if (routeBtn) {
          routeBtn.onclick = async (event) => {
            event.stopPropagation();
            await startRouting(burial);
          };
        }

        if (removeBtn) {
          removeBtn.onclick = (event) => {
            event.stopPropagation();
            removeFromResults(burial.OBJECTID);
            marker.closePopup();
          };
        }
      });

      clusterGroup.addLayer(marker);
      // if (pendingPopupBurialIdRef.current === burial.OBJECTID) {
      //   setTimeout(() => {
      //     marker.openPopup();
      //     pendingPopupBurialIdRef.current = null;
      //   }, 0);
      // }
    });

    window.mapInstance.addLayer(clusterGroup);

    return () => {
      if (markerClusterRef.current) {
        window.mapInstance.removeLayer(markerClusterRef.current);
      }
    };
  }, [activeBurialId, createClusterGroup, filteredBurials, sectionFilter, selectBurial, showAllBurials, handleResultClick, removeFromResults, startRouting]);

  /**
   * Handle map zoom changes
   */
  const handleZoomEnd = useCallback((e) => {
    const map = e.target;
    setCurrentZoom(map.getZoom());
  }, []);

  useEffect(() => {
    if (!window.mapInstance) return;
    
    window.mapInstance.on('zoomend', handleZoomEnd);
    
    return () => {
      window.mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [handleZoomEnd]);

  /**
   * Handle tour selection
   */
  const handleTourSelect = useCallback((tourName) => {
    setSelectedTour(tourName);
  }, []);

  /**
   * Adds a clicked tour stop to the sidebar and focuses it on the map.
   */
  const selectTourStop = useCallback((tourStop) => {
    if (!tourStop) return;

    setSelectedTourStops((prev) =>
        prev.some((item) => item.id === tourStop.id) ? prev : [...prev, tourStop]
    );

    setActiveTourStopId(tourStop.id);

    if (window.mapInstance && Array.isArray(tourStop.coordinates)) {
      const map = window.mapInstance;
      const targetZoom = Math.max(map.getZoom(), ZOOM_LEVEL);

      map.flyTo(
          [tourStop.coordinates[1], tourStop.coordinates[0]],
          targetZoom,
          {
            duration: 1.2,
            easeLinearity: 0.25,
          }
      );
    }
  }, []);

  /**
   * Removes a tour stop from the sidebar.
   */
  const removeTourStopFromResults = useCallback((tourStopId) => {
    setSelectedTourStops((prev) => prev.filter((item) => item.id !== tourStopId));

    if (activeTourStopId === tourStopId) {
      setActiveTourStopId(null);
    }
  }, [activeTourStopId]);

  /**
   * Clears all selected tour stops from the sidebar.
   */
  const clearTourStops = useCallback(() => {
    setSelectedTourStops([]);
    setActiveTourStopId(null);
  }, []);

  //=============================================================================
  // Routing Functions
  //=============================================================================

  // /**
  //  * Starts turn-by-turn navigation to a burial location
  //  * @param {Object} burial - The burial record to navigate to
  //  */
  // const startRouting = useCallback(async (burial) => {
  //   const location = lat && lng
  //     ? { latitude: lat, longitude: lng }
  //     : await requestCurrentLocation();
  //
  //   if (!location) {
  //     return;
  //   }
  //
  //   selectBurial(burial);
  //   setRoutingDestination([burial.coordinates[1], burial.coordinates[0]]);
  //   setActiveRouteBurialId(burial.OBJECTID);
  // }, [lat, lng, requestCurrentLocation, selectBurial]);

  /**
   * Stops the current navigation
   */
  const stopRouting = useCallback(() => {
    setRoutingOrigin(null);
    setRoutingDestination(null);
    setActiveRouteBurialId(null);
  }, []);

  /**
   * Opens an external maps application or browser maps page for a burial.
   *
   * This is used as a fallback when in-map routing is unavailable
   * or when the user prefers system navigation tools.
   */
  const openExternalDirections = useCallback((burial) => {
    if (!Array.isArray(burial.coordinates)) {
      setStatus('Directions unavailable for this burial');
      return;
    }



    const link = buildDirectionsLink({
      latitude: burial.coordinates[1],
      longitude: burial.coordinates[0],
      label: formatBurialName(burial),
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    });

    if (!link) {
      setStatus('Directions unavailable for this burial');
      return;
    }

    if (link.target === 'self') {
      window.location.assign(link.href);
      return;
    }

    window.open(link.href, link.target, 'noopener,noreferrer');
  }, []);

  /**
   * Starts walking navigation to a tour stop.
   *
   * This uses the latest known user location from refs,
   * which makes popup routing more reliable even when the tour layer
   * was created earlier and still has older event handlers.
   */
  const startTourRouting = useCallback(async (feature, layer) => {
    const latlng = typeof layer?.getLatLng === 'function' ? layer.getLatLng() : null;

    if (!latlng) {
      setStatus('Directions unavailable for this tour stop');
      return;
    }

    const location = await getLatestAvailableLocation();

    if (!location) {
      return;
    }

    const snappedDestination = findNearestRoadPoint(latlng.lat, latlng.lng);

    setRoutingOrigin([location.latitude, location.longitude]);
    setRoutingDestination(snappedDestination);
    setActiveRouteBurialId(null);
  }, [getLatestAvailableLocation]);

  /**
   * Opens an external maps application or browser maps page for a tour stop.
   *
   * This helper builds a platform-aware directions link
   * using the selected tour marker coordinates.
   */
  const openExternalTourDirections = useCallback((feature, layer) => {
    const latlng = typeof layer?.getLatLng === 'function' ? layer.getLatLng() : null;

    if (!latlng) {
      setStatus('Directions unavailable for this tour stop');
      return;
    }

    const link = buildDirectionsLink({
      latitude: latlng.lat,
      longitude: latlng.lng,
      label: feature?.properties?.Full_Name || 'Tour stop',
      userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    });

    if (!link) {
      setStatus('Directions unavailable for this tour stop');
      return;
    }

    if (link.target === 'self') {
      window.location.assign(link.href);
      return;
    }

    window.open(link.href, link.target, 'noopener,noreferrer');
  }, []);

  /**
   * Attaches popup behavior and button actions to each tour feature.
   *
   * For each tour marker, this function:
   * - creates popup content
   * - binds the popup to the Leaflet layer
   * - connects popup buttons to map focus, in-map routing, and external maps
   */
  const createOnEachTourFeature = useCallback((tourKey) => (feature, layer) => {
    if (!(feature.properties && feature.properties.Full_Name)) {
      return;
    }

    // const safeBase = `${tourKey}-${feature.properties.OBJECTID || feature.properties.Full_Name || 'tour'}`
    //     .replace(/[^a-zA-Z0-9_-]/g, '-');
    //
    // const centerBtnId = `${safeBase}-center`;
    // const routeBtnId = `${safeBase}-route`;
    // const mapsBtnId = `${safeBase}-maps`;

    const content = createTourPopupContent(feature, tourKey);
    //   centerBtnId,
    //   routeBtnId,
    //   mapsBtnId,
    // });

    layer.bindPopup(content, {
      maxWidth: 320,
      className: 'custom-popup'
    });

    feature.properties.title = tourKey;

    layer.on('click', () => {
      const tourStop = buildTourStopRecord(feature, tourKey, layer);
      selectTourStop(tourStop);
      layer.openPopup();
    });
    layer.on('popupopen', () => {
      setTimeout(() => {
        const latlng = typeof layer.getLatLng === 'function' ? layer.getLatLng() : null;
        const map = layer._map || window.mapInstance || null;
        const popupEl = layer.getPopup()?.getElement();

        if (!popupEl) return;

        const centerBtn = popupEl.querySelector('[data-tour-action="center"]');
        const routeBtn = popupEl.querySelector('[data-tour-action="route"]');
        const mapsBtn = popupEl.querySelector('[data-tour-action="maps"]');

        if (centerBtn) {
          centerBtn.onclick = (event) => {
            event.stopPropagation();

            if (map && latlng) {
              map.flyTo(
                  [latlng.lat, latlng.lng],
                  Math.max(map.getZoom(), ZOOM_LEVEL),
                  { duration: 1.2 }
              );
            }
          };
        }

        if (routeBtn) {
          routeBtn.onclick = async (event) => {
            event.stopPropagation();
            layer.closePopup();
            await startTourRouting(feature, layer);
          };
        }

        if (mapsBtn) {
          mapsBtn.onclick = (event) => {
            event.stopPropagation();
            openExternalTourDirections(feature, layer);
          };
        }
      }, 0);
    });
  }, [buildTourStopRecord, openExternalTourDirections, selectTourStop, startTourRouting]);

  //=============================================================================
  // Map Layer Management
  //=============================================================================

  /**
   * Callback for handling section layer interactions
   */
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

  const ensureTourLayerLoaded = useCallback(async (tourName) => {
    if (!tourName) return;

    const definition = tourDefinitionsByName.get(tourName);
    if (!definition) return;
    if (loadedTourNamesRef.current.has(tourName) || loadingTourNamesRef.current.has(tourName)) return;

    loadingTourNamesRef.current.add(tourName);
    setLoadingTourName(tourName);
    setTourLayerError('');

    try {
      const module = await definition.load();
      const layer = L.geoJSON(module.default, {
        pointToLayer: createTourMarker(definition.key),
        onEachFeature: createOnEachTourFeature(definition.key)
      });

      loadedTourNamesRef.current.add(tourName);
      setOverlayMaps((current) => ({
        ...current,
        [tourName]: layer
      }));
    } catch (error) {
      console.error('Error loading tour layer:', error);
      setTourLayerError(`Unable to load "${tourName}". Please try again.`);
    } finally {
      loadingTourNamesRef.current.delete(tourName);
      setLoadingTourName((current) => (current === tourName ? '' : current));
    }
  }, [tourDefinitionsByName, createOnEachTourFeature]);

  /**
   * Initialize base GeoJSON layers. Tour layers are loaded lazily.
   */
  useEffect(() => {
    try {
      const baseLayers = {
        boundary: L.geoJSON(ARC_Boundary, { style: exteriorStyle }),
        roads: L.geoJSON(ARC_Roads, { style: roadStyle }),
        sections: L.geoJSON(ARC_Sections, { onEachFeature: onEachSection })
      };

      setOverlayMaps({
        "Albany Rural Cemetery Boundary": baseLayers.boundary,
        "Albany Rural Cemetery Roads": baseLayers.roads,
        "Section Boundaries": baseLayers.sections
      });
    } catch (error) {
      console.error('Error loading base GeoJSON data:', error);
    }
  }, [onEachSection]);

  /**
   * Load the selected tour layer on demand.
   */
  useEffect(() => {
    if (!selectedTour) return;
    void ensureTourLayerLoaded(selectedTour);
  }, [selectedTour, ensureTourLayerLoaded]);

  /**
   * Prefetch tour layers in idle time to reduce switching latency.
   */
  useEffect(() => {
    let cancelled = false;
    let index = 0;
    let handle;

    const loadNextTour = () => {
      if (cancelled || index >= tourNames.length) return;
      const nextTourName = tourNames[index];
      index += 1;
      void ensureTourLayerLoaded(nextTourName).finally(() => {
        if (cancelled) return;
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          handle = window.requestIdleCallback(loadNextTour, { timeout: 2000 });
        } else {
          handle = setTimeout(loadNextTour, 300);
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      handle = window.requestIdleCallback(loadNextTour, { timeout: 2000 });
    } else {
      handle = setTimeout(loadNextTour, 300);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [ensureTourLayerLoaded, tourNames]);

  return (
    <div className="map-container">
      {/* Left sidebar with search and filters */}
      <Paper
        elevation={3}
        className="left-sidebar"
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2, color: 'var(--muted-text)' }}>
              Albany Rural Cemetery
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              Burial Finder PWA
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--muted-text)', mt: 0.5 }}>
              Search 97k+ records, pin results, and navigate on site.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            <Chip
              size="small"
              color={isBurialDataLoading || !isSearchIndexReady ? 'warning' : burialDataError ? 'error' : 'success'}
              label={
                isBurialDataLoading
                  ? 'Loading records…'
                  : burialDataError
                    ? 'Record load failed'
                    : isSearchIndexReady
                      ? 'Records ready'
                      : 'Indexing records…'
              }
            />
            <Chip
              size="small"
              icon={!isOnline ? <WifiOffIcon /> : null}
              color={isOnline ? 'success' : 'warning'}
              label={isOnline ? 'Online' : 'Offline'}
            />
            {loadingTourName && (
              <Chip
                size="small"
                color="warning"
                label={`Loading tour: ${loadingTourName}`}
              />
            )}
            {isInstalled && (
              <Chip size="small" color="primary" label="Installed" />
            )}
          </Box>

          <Button
            variant="outlined"
            size="small"
            onClick={handleOpenAppMenu}
            startIcon={<AppsIcon />}
            endIcon={<ArrowDropDownIcon />}
            sx={{ mb: 1.5 }}
          >
            App
          </Button>

          {burialDataError && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {burialDataError}
            </Typography>
          )}
          {tourLayerError && (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {tourLayerError}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Autocomplete
              freeSolo
              options={searchOptions}
              disabled={isBurialDataLoading || !!burialDataError}
              getOptionLabel={(option) => {
                if (typeof option === 'string') {
                  return option;
                }
                return option.searchableLabel || '';
              }}
              onChange={handleSearch}
              value={null}
              inputValue={inputValue}
              onInputChange={(event, newInputValue, reason) => {
                if (reason === 'reset') return;
                setInputValue(newInputValue);
              }}
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={isBurialDataLoading ? 'Loading records…' : 'Search by name, year, section, tour…'}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {isBurialDataLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) => {
                const rawQuery = inputValue.trim();
                if (rawQuery.length < 2) {
                  return [];
                }

                const normalizedQuery = normalizeName(rawQuery);

                const exactMatches = options.filter((option) =>
                    option.fullNameNormalized === normalizedQuery ||
                    option.nameVariantsNormalized?.includes(normalizedQuery)
                );

                if (exactMatches.length > 0) {
                  const remaining = smartSearch(options, rawQuery, {
                    index: searchIndex,
                    getTourName,
                  }).filter(
                      (item) => !exactMatches.some((exact) => exact.OBJECTID === item.OBJECTID)
                  );

                  return [...exactMatches, ...remaining].slice(0, 100);
                }

                return smartSearch(options, rawQuery, {
                  index: searchIndex,
                  getTourName,
                }).slice(0, 100);
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
          </Box>

          {/* Section Filter */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filter by Section
            </Typography>
            <Autocomplete
              options={uniqueSections}
              value={sectionFilter || null}
              disabled={isBurialDataLoading || !!burialDataError}
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
                disabled={isBurialDataLoading || !!burialDataError}
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
              Use My Location
            </Button>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'var(--muted-text)' }}>
            {status}
          </Typography>
        </Box>

        <Divider />

        {/* Selected Burials */}
        {selectedBurials.length > 0 && (
          <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Selected People ({selectedBurials.length})</Typography>
              <IconButton onClick={clearSearch} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <List>
              {selectedBurials.map((burial, index) => {
                const isActive = activeBurialId === burial.OBJECTID;
                const isRouteActive = activeRouteBurialId === burial.OBJECTID;

                return (
                  <ListItem
                    key={createUniqueKey(burial, index)}
                    disablePadding
                    sx={{ display: 'block', px: 2, pb: 1.5 }}
                  >
                    <Box
                      ref={(node) => {
                        if (node) {
                          selectedBurialRefs.current.set(burial.OBJECTID, node);
                        } else {
                          selectedBurialRefs.current.delete(burial.OBJECTID);
                        }
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => handleResultClick(burial)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        borderRadius: 2,
                        border: isActive ? '1px solid rgba(18, 94, 74, 0.35)' : '1px solid rgba(18, 47, 40, 0.12)',
                        borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent',
                        backgroundColor: isActive
                          ? 'rgba(18, 94, 74, 0.08)'
                          : hoveredIndex === index
                            ? 'rgba(0, 0, 0, 0.04)'
                            : 'rgba(255, 255, 255, 0.72)',
                        p: 1.5,
                        '&:hover': {
                          backgroundColor: isActive ? 'rgba(18, 94, 74, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box
                          sx={{
                            width: isActive || hoveredIndex === index ? '32px' : '24px',
                            height: isActive || hoveredIndex === index ? '32px' : '24px',
                            borderRadius: '50%',
                            backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length],
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: isActive || hoveredIndex === index ? '16px' : '14px',
                            border: isActive || hoveredIndex === index ? '3px solid white' : '2px solid white',
                            boxShadow: isActive || hoveredIndex === index ? '0 0 8px rgba(0,0,0,0.6)' : '0 0 4px rgba(0,0,0,0.4)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>
                            {formatBurialName(burial)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Section {burial.Section}, Lot {burial.Lot}, Tier {burial.Tier}, Grave {burial.Grave}
                          </Typography>
                          {(burial.Birth || burial.Death) && (
                            <Typography variant="body2" color="text.secondary">
                              {burial.Birth ? `Born ${burial.Birth}` : 'Birth unknown'}
                              {burial.Death ? ` • Died ${burial.Death}` : ''}
                            </Typography>
                          )}
                          {(isActive || isRouteActive) && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                              {isActive && <Chip size="small" color="primary" label="Active" />}
                              {isRouteActive && (
                                <Chip
                                  size="small"
                                  label="Route active"
                                  sx={{
                                    backgroundColor: 'rgba(18, 94, 74, 0.14)',
                                    color: 'var(--accent)',
                                  }}
                                />
                              )}
                            </Box>
                          )}
                          {burial.title && (
                            <Typography
                              variant="body2"
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
                        <IconButton
                          aria-label="remove"
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeFromResults(burial.OBJECTID);
                          }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
                        <Button
                          size="small"
                          variant={isActive ? 'contained' : 'outlined'}
                          startIcon={<CenterFocusStrongIcon />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleResultClick(burial);
                          }}
                        >
                          Center on Map
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<DirectionsIcon />}
                            onClick={async (event) => {
                              event.stopPropagation();
                              await startRouting(burial);
                            }}
                        >
                          Get Direction
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LaunchIcon />}
                            onClick={(event) => {
                              event.stopPropagation();
                              openExternalDirections(burial);
                            }}
                        >
                          Open in Maps
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          color="inherit"
                          startIcon={<CloseIcon />}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeFromResults(burial.OBJECTID);
                          }}
                        >
                          Remove
                        </Button>
                      </Box>
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
        {selectedTourStops.length > 0 && (
            <Box sx={{ maxHeight: '40vh', overflow: 'auto' }}>
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Selected Tour Stops ({selectedTourStops.length})</Typography>
                <IconButton onClick={clearTourStops} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>
              <List>
                {selectedTourStops.map((tourStop) => {
                  const isActive = activeTourStopId === tourStop.id;

                  return (
                      <ListItem key={tourStop.id} disablePadding sx={{ display: 'block', px: 2, pb: 1.5 }}>
                        <Box
                            sx={{
                              borderRadius: 2,
                              border: isActive ? '1px solid rgba(18, 94, 74, 0.35)' : '1px solid rgba(18, 47, 40, 0.12)',
                              borderLeft: isActive ? '4px solid var(--accent)' : '4px solid transparent',
                              backgroundColor: isActive ? 'rgba(18, 94, 74, 0.08)' : 'rgba(255, 255, 255, 0.72)',
                              p: 1.5,
                            }}
                        >
                          <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>
                            {tourStop.title}
                          </Typography>

                          {tourStop.subtitle && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {tourStop.subtitle}
                              </Typography>
                          )}

                          <Typography
                              variant="body2"
                              sx={{
                                mt: 1,
                                color: 'white',
                                backgroundColor: TOURS[tourStop.tourKey]?.color || 'grey',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                display: 'inline-block'
                              }}
                          >
                            {TOURS[tourStop.tourKey]?.name || tourStop.tourKey}
                          </Typography>

                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CenterFocusStrongIcon />}
                                onClick={() => selectTourStop(tourStop)}
                            >
                              Center on Map
                            </Button>

                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<DirectionsIcon />}
                                onClick={async () => {
                                  const fakeLayer = {
                                    getLatLng: () => ({
                                      lat: tourStop.coordinates[1],
                                      lng: tourStop.coordinates[0],
                                    }),
                                  };
                                  await startTourRouting(tourStop.feature, fakeLayer);
                                }}
                            >
                              Get Direction
                            </Button>

                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<LaunchIcon />}
                                onClick={() => {
                                  const fakeLayer = {
                                    getLatLng: () => ({
                                      lat: tourStop.coordinates[1],
                                      lng: tourStop.coordinates[0],
                                    }),
                                  };
                                  openExternalTourDirections(tourStop.feature, fakeLayer);
                                }}
                            >
                              Open in Maps
                            </Button>

                            <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                startIcon={<CloseIcon />}
                                onClick={() => removeTourStopFromResults(tourStop.id)}
                            >
                              Remove
                            </Button>
                          </Box>
                        </Box>
                      </ListItem>
                  );
                })}
              </List>
            </Box>
        )}
      </Paper>

      <Menu
        anchorEl={appMenuAnchorEl}
        open={appMenuOpen}
        onClose={handleCloseAppMenu}
      >
        {isInstalled && <MenuItem disabled>App installed on this device</MenuItem>}
        {!isInstalled && installPromptEvent && (
          <MenuItem
            onClick={async () => {
              handleCloseAppMenu();
              await handleInstallApp();
            }}
          >
            <InstallMobileIcon fontSize="small" sx={{ mr: 1 }} />
            Install on this device
          </MenuItem>
        )}
        {!isInstalled && showIosInstallHint && (
          <MenuItem disabled>
            <InstallMobileIcon fontSize="small" sx={{ mr: 1 }} />
            Safari: Share → Add to Home Screen
          </MenuItem>
        )}
        {!isInstalled && !installPromptEvent && !showIosInstallHint && (
          <MenuItem disabled>
            <AppsIcon fontSize="small" sx={{ mr: 1 }} />
            App install unavailable in this browser
          </MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={directionsMenuAnchorEl}
        open={directionsMenuOpen}
        onClose={handleCloseDirectionsMenu}
      >
        {directionsMenuBurial && (
          <>
            <MenuItem
              onClick={async () => {
                const burial = directionsMenuBurial;
                handleCloseDirectionsMenu();
                if (activeRouteBurialId === burial.OBJECTID) {
                  stopRouting();
                  return;
                }
                await startRouting(burial);
              }}
            >
              <DirectionsIcon fontSize="small" sx={{ mr: 1 }} />
              {activeRouteBurialId === directionsMenuBurial.OBJECTID ? 'Stop Route' : 'Route on Map'}
            </MenuItem>
            <MenuItem
              onClick={() => {
                const burial = directionsMenuBurial;
                handleCloseDirectionsMenu();
                openExternalDirections(burial);
              }}
            >
              <LaunchIcon fontSize="small" sx={{ mr: 1 }} />
              Open in Maps
            </MenuItem>
          </>
        )}
      </Menu>

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
        <MapTourController selectedTour={selectedTour} overlayMaps={overlayMaps} tourNames={tourNames} />
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
                      // Only handle section click without checking hoveredMarker
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
          {routingOrigin &&  routingDestination && (
            <RoutingControl
              from={routingOrigin}
              to={routingDestination}
            />
          )}

          {/* Search Result Markers - Always on top */}
          {selectedBurials.map((burial, index) => (
            <Marker
                ref={(markerInstance) => {
                  if (markerInstance) {
                    selectedBurialMarkerRefs.current.set(burial.OBJECTID, markerInstance);
                  } else {
                    selectedBurialMarkerRefs.current.delete(burial.OBJECTID);
                  }
                }}
                key={createUniqueKey(burial, index)}
                position={[burial.coordinates[1], burial.coordinates[0]]}
                icon={createNumberedIcon(
                    index + 1,
                    hoveredIndex === index || activeBurialId === burial.OBJECTID
                )}
                eventHandlers={{
                  mouseover: () => setHoveredIndex(index),
                  mouseout: () => setHoveredIndex(null),
                  click: () => handleMarkerClick(burial)
                }}
                zIndexOffset={1000}
            >
              <Popup>
                <Box sx={{ minWidth: 220 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {formatBurialName(burial)}
                  </Typography>
                  <Typography variant="body2">Section: {burial.Section}</Typography>
                  <Typography variant="body2">Lot: {burial.Lot}</Typography>
                  <Typography variant="body2">Tier: {burial.Tier}</Typography>
                  <Typography variant="body2">Grave: {burial.Grave}</Typography>
                  <Typography variant="body2">Birth: {burial.Birth}</Typography>
                  <Typography variant="body2">Death: {burial.Death}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<CenterFocusStrongIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleResultClick(burial);
                      }}
                    >
                      Center on Map
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      startIcon={<DirectionsIcon />}
                      onClick={async (event) => {
                        event.stopPropagation();
                        await startRouting(burial);
                      }}
                    >
                     Get Directions
                    </Button>
                    <Button
                      variant="text"
                      color="inherit"
                      size="small"
                      startIcon={<CloseIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFromResults(burial.OBJECTID);
                      }}
                    >
                      Remove
                    </Button>
                  </Box>
                </Box>
              </Popup>
            </Marker>
          ))}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
