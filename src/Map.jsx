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
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

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
  Paper,
  IconButton,
  Box,
  Typography,
  ButtonGroup,
  Button,
  Menu,
  MenuItem,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import HomeIcon from '@mui/icons-material/Home';
import RemoveIcon from "@mui/icons-material/Remove";
import DirectionsIcon from '@mui/icons-material/Directions';
import LaunchIcon from '@mui/icons-material/Launch';

// Local Data and Styles
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import BurialSidebar from "./BurialSidebar";
import { buildSearchIndex, smartSearch, sortSectionValues } from "./lib/burialSearch";
import {
  buildBurialBrowseResult,
  buildLocationSummary,
  buildTourBrowseResult,
  filterBurialRecordsBySection,
  formatBrowseResultName,
} from "./lib/browseResults";
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

const MOBILE_MAP_CONTROL_RIGHT = 'calc(env(safe-area-inset-right, 0px) + 12px)';
const MOBILE_ZOOM_CONTROL_TOP = 'calc(env(safe-area-inset-top, 0px) + 86px)';
const MOBILE_DEFAULT_EXTENT_TOP = 'calc(env(safe-area-inset-top, 0px) + 156px)';

//=============================================================================
// React Components
//=============================================================================

/**
 * Custom zoom control component that provides zoom in/out buttons
 * Positioned at the top-right corner of the map
 */
function CustomZoomControl({ isMobile }) {
  const map = useMap();

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: isMobile
          ? MOBILE_ZOOM_CONTROL_TOP
          : '80px',
        right: isMobile
          ? MOBILE_MAP_CONTROL_RIGHT
          : '10px',
        zIndex: 1100,
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
function MapController() {
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
function DefaultExtentButton({ isMobile }) {
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
        top: isMobile
          ? MOBILE_DEFAULT_EXTENT_TOP
          : '150px',
        right: isMobile
          ? MOBILE_MAP_CONTROL_RIGHT
          : '10px',
        zIndex: 1100,
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
  return burial.id || `${burial.OBJECTID}_${burial.Section}_${burial.Lot}_${burial.Grave}_${index}`;
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
      nearestCoords = snapped.geometry.coordinates;
    }
  });

  if (!nearestCoords) {
    return [lat, lng];
  }

  return [nearestCoords[1], nearestCoords[0]];
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
 * @returns {string} HTML content for the popup
 */
const buildTourPopupActionIds = (browseId = "") => {
  const safeId = String(browseId).replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    route: `tour-popup-route-${safeId}`,
    external: `tour-popup-external-${safeId}`,
    remove: `tour-popup-remove-${safeId}`,
  };
};

const cleanPopupValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const getTourPortraitPath = (properties = {}) => (
  cleanPopupValue(properties.Bio_Portra || properties.Bio_Portri || properties.Bio_portra)
);

const buildTourPopupDetailLines = (properties = {}, browseResult = {}) => {
  const title = cleanPopupValue(properties.Titles || properties.Initial_Te || properties.Highest_Ra);
  const subsequent = cleanPopupValue(properties.Subsequent);
  const unit = cleanPopupValue(properties.Unit);
  const service = cleanPopupValue(properties.Service_Re);
  const headstone = cleanPopupValue(properties.Headstone_);
  const birth = cleanPopupValue(properties.Birth);
  const death = cleanPopupValue(properties.Death);
  const location = cleanPopupValue(buildLocationSummary(browseResult));
  const lifeDates = [birth ? `B ${birth}` : "", death ? `D ${death}` : ""].filter(Boolean).join(" • ");

  return [
    title ? [title, lifeDates].filter(Boolean).join(", ") : lifeDates,
    subsequent,
    unit ? `Unit: ${unit}` : "",
    service,
    headstone,
    location,
  ].filter(Boolean);
};

const createTourPopupContent = (feature, browseResult) => {
  const properties = feature.properties || {};
  const stopLink = properties.Tour_Bio
    ? `https://www.albany.edu/arce/${properties.Tour_Bio}.html`
    : "";
  const actionIds = buildTourPopupActionIds(browseResult.id);
  const detailLines = buildTourPopupDetailLines(properties, browseResult);
  const portraitPath = getTourPortraitPath(properties);
  const heading = cleanPopupValue(properties.Full_Name || browseResult.displayName || browseResult.fullName);
  let content = `<dl class="popup-content">`;

  content += `<dt><b>${heading}</b></dt><hr>`;

  detailLines.forEach((line) => {
    content += `<dt>${line}</dt>`;
  });

  if (stopLink) {
    content += `<dt>(Click image to view detailed biography)</dt>`;
  }

  if (portraitPath && portraitPath !== "NONE") {
    const portrait = `
      <img
        src="${getImagePath(portraitPath)}"
        style="max-width:200px; max-height:200px; border:2px solid #ccc; border-radius:4px; margin:8px 0;"
        loading="lazy"
        onerror="this.onerror=null; this.src='https://www.albany.edu/arce/images/no-image.jpg';"
      />
    `;

    content += stopLink
      ? `
        <dt>
          <a href="${stopLink}" target="_blank" rel="noopener noreferrer">
            ${portrait}
          </a>
        </dt>`
      : `<dt>${portrait}</dt>`;
  }

  content += `
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
      <button
        id="${actionIds.route}"
        type="button"
        style="padding:8px 10px; border:none; border-radius:999px; background:#125e4a; color:#fff; cursor:pointer; font-size:12px; font-weight:600;"
      >
        Directions
      </button>
      <button
        id="${actionIds.external}"
        type="button"
        style="padding:8px 10px; border:1px solid rgba(18,47,40,0.18); border-radius:999px; background:#fff; color:#10231f; cursor:pointer; font-size:12px; font-weight:600;"
      >
        Open in Maps
      </button>
      <button
        id="${actionIds.remove}"
        type="button"
        style="padding:8px 10px; border:none; background:transparent; color:#5b5b5b; cursor:pointer; font-size:12px; font-weight:600;"
      >
        Remove
      </button>
    </div>
  `;

  content += "</dl>";
  return { content, actionIds };
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

/**
 * Creates event handlers for tour features
 * @param {string} tourKey - The key identifying the tour
 * @returns {Function} Event handler for the tour feature
 */
const createOnEachTourFeature = (
  tourKey,
  tourName,
  onSelect,
  onStartRouting,
  onOpenExternalDirections,
  onRemoveResult,
  onRegisterLayer
) => (feature, layer) => {
  if (feature.properties) {
    feature.properties.title = tourKey;
    const browseResult = buildTourBrowseResult(feature, { tourKey, tourName });
    const popupPayload = createTourPopupContent(feature, browseResult);

    layer.bindPopup(popupPayload.content, {
      maxWidth: 300,
      className: 'custom-popup'
    });
    if (onRegisterLayer) {
      onRegisterLayer(browseResult, layer);
    }
    layer.on('popupopen', () => {
      const routeBtn = document.getElementById(popupPayload.actionIds.route);
      const externalBtn = document.getElementById(popupPayload.actionIds.external);
      const removeBtn = document.getElementById(popupPayload.actionIds.remove);

      if (routeBtn) {
        routeBtn.onclick = async (event) => {
          event.stopPropagation();
          await onStartRouting(browseResult);
        };
      }

      if (externalBtn) {
        externalBtn.onclick = (event) => {
          event.stopPropagation();
          onOpenExternalDirections(browseResult);
        };
      }

      if (removeBtn) {
        removeBtn.onclick = (event) => {
          event.stopPropagation();
          onRemoveResult(browseResult.id);
          layer.closePopup();
        };
      }
    });
    layer.on('click', () => {
      onSelect(browseResult, { animate: false, openTourPopup: true });
    });
  }
};

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
  const [tourResultsByName, setTourResultsByName] = useState({});
  const [currentZoom, setCurrentZoom] = useState(14);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);

  // Search and Filter State
  const [selectedBurials, setSelectedBurials] = useState([]);
  const [activeBurialId, setActiveBurialId] = useState(null);
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
  const [routingOrigin, setRoutingOrigin] = useState(null);
  const [routingDestination, setRoutingDestination] = useState(null);
  const [activeRouteBurialId, setActiveRouteBurialId] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState(null);
  const [directionsMenuAnchorEl, setDirectionsMenuAnchorEl] = useState(null);
  const [directionsMenuBurial, setDirectionsMenuBurial] = useState(null);

  // Component References
  const { BaseLayer } = LayersControl;
  const markerClusterRef = useRef(null);
  const didApplyUrlStateRef = useRef(false);
  const loadedTourNamesRef = useRef(new Set());
  const loadingTourNamesRef = useRef(new Set());
  const selectedBurialRefs = useRef(new Map());
  const tourFeatureLayersRef = useRef(new Map());

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
  const selectedTourLayer = useMemo(
    () => (selectedTour ? overlayMaps[selectedTour] || null : null),
    [overlayMaps, selectedTour]
  );
  const initialDeepLinkRef = useRef(null);
  if (initialDeepLinkRef.current === null && typeof window !== "undefined") {
    initialDeepLinkRef.current = parseDeepLinkState(window.location.search, tourNames);
  }
  const appMenuOpen = Boolean(appMenuAnchorEl);
  const directionsMenuOpen = Boolean(directionsMenuAnchorEl);
  const isAppleMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;

    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);
  const showIosInstallHint = isAppleMobile && !isInstalled && !installPromptEvent;
  const initialBrowseQuery = initialDeepLinkRef.current?.query || "";
  const isMobile = useMediaQuery("(max-width:840px)");

  const burialRecords = useMemo(() => (
    burialFeatures.map((feature) => buildBurialBrowseResult(feature, { getTourName }))
  ), [burialFeatures, getTourName]);

  const sectionBurials = useMemo(() => (
    filterBurialRecordsBySection(burialRecords, {
      sectionFilter,
      lotTierFilter,
      filterType,
    })
  ), [burialRecords, filterType, lotTierFilter, sectionFilter]);

  /**
   * Build search indexes off the main interaction path.
   * This keeps first paint responsive even with large datasets.
   */
  useEffect(() => {
    if (!burialRecords.length) {
      setSearchIndex(null);
      setIsSearchIndexReady(false);
      return undefined;
    }

    let cancelled = false;
    let handle;
    setIsSearchIndexReady(false);

    const buildIndex = () => {
      const nextIndex = buildSearchIndex(burialRecords, { getTourName });
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
  }, [burialRecords, getTourName]);

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

  const focusTourLayerPopup = useCallback((burial, map) => {
    if (!burial || burial.source !== "tour") return;

    const layer = tourFeatureLayersRef.current.get(burial.id);
    if (!layer?.openPopup) return;

    const openPopup = () => {
      layer.openPopup();
    };

    if (map) {
      map.once("moveend", openPopup);
      return;
    }

    openPopup();
  }, []);

  /**
   * Focuses a burial consistently regardless of whether it was found by search or map click.
   */
  const focusBurial = useCallback((
    burial,
    {
      addToSelection = false,
      animate = true,
      openTourPopup = true,
    } = {}
  ) => {
    if (!burial) return;

    if (addToSelection) {
      setSelectedBurials((prev) => (
        prev.some((item) => item.id === burial.id)
          ? prev
          : [...prev, burial]
      ));
    }

    setActiveBurialId(burial.id);

    if (window.mapInstance && Array.isArray(burial.coordinates)) {
      const map = window.mapInstance;
      const targetLatLng = L.latLng(burial.coordinates[1], burial.coordinates[0]);
      const targetZoom = Math.max(map.getZoom(), ZOOM_LEVEL);
      const currentCenter = map.getCenter();
      const distance = map.distance(currentCenter, targetLatLng);
      const shouldAnimate = animate && distance > 24;

      map.stop();

      if (!shouldAnimate) {
        map.setView(targetLatLng, targetZoom, { animate: false });
        if (openTourPopup) {
          focusTourLayerPopup(burial);
        }
        return;
      }

      if (openTourPopup) {
        focusTourLayerPopup(burial, map);
      }

      map.flyTo(
        targetLatLng,
        targetZoom,
        {
          duration: 0.65,
          easeLinearity: 0.2,
        }
      );
      return;
    }

    if (openTourPopup) {
      focusTourLayerPopup(burial);
    }
  }, [focusTourLayerPopup]);

  const selectBurial = useCallback((burial, options = {}) => {
    focusBurial(burial, { addToSelection: true, ...options });
  }, [focusBurial]);

  /**
   * Removes a burial from search results
   */
  const removeFromResults = useCallback((burialId) => {
    setSelectedBurials((prev) => prev.filter((burial) => burial.id !== burialId));

    if (activeRouteBurialId === burialId) {
      setRoutingOrigin(null);
      setRoutingDestination(null);
      setActiveRouteBurialId(null);
    }

    if (directionsMenuBurial?.id === burialId) {
      setDirectionsMenuAnchorEl(null);
      setDirectionsMenuBurial(null);
    }
  }, [activeRouteBurialId, directionsMenuBurial]);

  /**
   * Clears all search results
   */
  const clearSelectedBurials = useCallback(() => {
    setSelectedBurials([]);
    setActiveBurialId(null);
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

  //=============================================================================
  // Routing Functions
  //=============================================================================

  /**
   * Starts turn-by-turn navigation to a burial location
   * @param {Object} burial - The burial record to navigate to
   */
  const startRouting = useCallback(async (burial) => {
    if (!Array.isArray(burial?.coordinates)) {
      setStatus('Directions unavailable for this burial');
      return;
    }

    const location = lat && lng
      ? { latitude: lat, longitude: lng }
      : await requestCurrentLocation();

    if (!location) {
      return;
    }

    selectBurial(burial, {
      animate: false,
      openTourPopup: true,
    });
    const snappedDestination = findNearestRoadPoint(
      burial.coordinates[1],
      burial.coordinates[0]
    );

    setRoutingOrigin([location.latitude, location.longitude]);
    setRoutingDestination(snappedDestination);
    setActiveRouteBurialId(burial.id);
  }, [lat, lng, requestCurrentLocation, selectBurial]);

  /**
   * Stops the current navigation
   */
  const stopRouting = useCallback(() => {
    setRoutingOrigin(null);
    setRoutingDestination(null);
    setActiveRouteBurialId(null);
  }, []);

  const openExternalDirections = useCallback((burial) => {
    if (!Array.isArray(burial.coordinates)) {
      setStatus('Directions unavailable for this burial');
      return;
    }

    const link = buildDirectionsLink({
      latitude: burial.coordinates[1],
      longitude: burial.coordinates[0],
      label: formatBrowseResultName(burial),
      originLatitude: lat,
      originLongitude: lng,
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
  }, [lat, lng]);

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

  useEffect(() => {
    if (selectedBurials.length === 0) {
      if (activeBurialId !== null) {
        setActiveBurialId(null);
      }
      return;
    }

    if (!selectedBurials.some((burial) => burial.id === activeBurialId)) {
      setActiveBurialId(selectedBurials[0].id);
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
   * Update section burial marker display
   */
  useEffect(() => {
    if (!window.mapInstance || !showAllBurials || !sectionFilter) return;

    if (markerClusterRef.current) {
      markerClusterRef.current.clearLayers();
      window.mapInstance.removeLayer(markerClusterRef.current);
    }

    const clusterGroup = createClusterGroup();
    markerClusterRef.current = clusterGroup;

    sectionBurials.forEach((burial) => {
      const marker = L.circleMarker([burial.coordinates[1], burial.coordinates[0]], {
        ...markerStyle,
        radius: activeBurialId === burial.id ? 8 : 6
      });
      const popupKey = `${burial.id || createUniqueKey(burial, 0)}`.replace(/[^a-zA-Z0-9_-]/g, '-');
      const routeBtnId = `${popupKey}-route`;
      const removeBtnId = `${popupKey}-remove`;

      const popupContent = `
        <div class="custom-popup">
          <h3>${formatBrowseResultName(burial)}</h3>
          <p>${buildLocationSummary(burial)}</p>
          ${burial.Birth ? `<p>Birth: ${burial.Birth}</p>` : ""}
          ${burial.Death ? `<p>Death: ${burial.Death}</p>` : ""}
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
            <button
              id="${routeBtnId}"
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
              Directions
            </button>
            <button
              id="${removeBtnId}"
              type="button"
              style="
                padding:6px 10px;
                border:none;
                background:transparent;
                color:#555;
                cursor:pointer;
                font-size:12px;
                font-weight:600;
              "
            >
              Remove
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });
      marker.on('click', () => {
        selectBurial(burial);
      });
      marker.on('popupopen', () => {
        const routeBtn = document.getElementById(routeBtnId);
        const removeBtn = document.getElementById(removeBtnId);

        if (routeBtn) {
          routeBtn.onclick = async (event) => {
            event.stopPropagation();
            await startRouting(burial);
          };
        }

        if (removeBtn) {
          removeBtn.onclick = (event) => {
            event.stopPropagation();
            removeFromResults(burial.id);
            marker.closePopup();
          };
        }
      });

      clusterGroup.addLayer(marker);
    });

    window.mapInstance.addLayer(clusterGroup);

    return () => {
      if (markerClusterRef.current) {
        window.mapInstance.removeLayer(markerClusterRef.current);
      }
    };
  }, [
    activeBurialId,
    createClusterGroup,
    handleResultClick,
    removeFromResults,
    sectionBurials,
    sectionFilter,
    selectBurial,
    showAllBurials,
    startRouting,
  ]);

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

  const resetMapToDefaultBounds = useCallback(() => {
    if (!window.mapInstance) return;

    const bounds = turf.bbox(ARC_Boundary.features[0]);
    const padding = 0.01;
    const southWest = [bounds[1] - padding, bounds[0] - padding];
    const northEast = [bounds[3] + padding, bounds[2] + padding];
    window.mapInstance.fitBounds([southWest, northEast]);
  }, []);

  const focusSectionOnMap = useCallback((sectionValue, bounds) => {
    if (!window.mapInstance || !sectionValue) return;

    if (bounds) {
      window.mapInstance.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: ZOOM_LEVELS.CLUSTER,
      });
      return;
    }

    const section = ARC_Sections.features.find(
      (feature) => `${feature.properties.Section}` === `${sectionValue}`
    );

    if (!section) return;

    const layer = L.geoJSON(section);
    window.mapInstance.fitBounds(layer.getBounds(), {
      padding: [50, 50],
      maxZoom: ZOOM_LEVELS.CLUSTER,
    });
  }, []);

  const activateSectionBrowse = useCallback((sectionValue, bounds) => {
    const nextSection = sectionValue || "";
    setSectionFilter(nextSection);
    setLotTierFilter("");
    setFilterType("lot");

    if (nextSection) {
      setSelectedTour(null);
      setShowAllBurials(true);
      focusSectionOnMap(nextSection, bounds);
      return;
    }

    setShowAllBurials(false);
  }, [focusSectionOnMap]);

  const clearSectionFilters = useCallback(() => {
    setLotTierFilter("");
    setFilterType("lot");
    setSectionFilter("");
    setShowAllBurials(false);
    resetMapToDefaultBounds();
  }, [resetMapToDefaultBounds]);

  const handleTourSelect = useCallback((tourName) => {
    setSelectedTour(tourName);
    setSectionFilter("");
    setLotTierFilter("");
    setFilterType("lot");
    setShowAllBurials(false);
  }, []);

  const focusTourOnMap = useCallback((tourName) => {
    if (!window.mapInstance || !tourName) return;

    const layer = overlayMaps[tourName];
    if (!layer?.getBounds) return;

    const bounds = layer.getBounds();
    if (!bounds?.isValid || !bounds.isValid()) return;

    window.mapInstance.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: ZOOM_LEVELS.CLUSTER,
    });
  }, [overlayMaps]);

  /**
   * Apply URL-driven state once data is available for deep links from the companion app.
   */
  useEffect(() => {
    if (didApplyUrlStateRef.current) return;
    if (isBurialDataLoading) return;

    const deepLink = initialDeepLinkRef.current || parseDeepLinkState(window.location.search, tourNames);

    if (deepLink.selectedTourName) {
      handleTourSelect(deepLink.selectedTourName);
    } else if (deepLink.section) {
      activateSectionBrowse(deepLink.section);
    } else if (deepLink.showBurialsView) {
      setShowAllBurials(true);
    }

    if (deepLink.query && burialRecords.length > 0) {
      const matches = smartSearch(burialRecords, deepLink.query, {
        index: searchIndex,
        getTourName,
      });
      if (matches.length > 0) {
        selectBurial(matches[0]);
      }
    }

    didApplyUrlStateRef.current = true;
  }, [
    activateSectionBrowse,
    burialRecords,
    getTourName,
    handleTourSelect,
    isBurialDataLoading,
    searchIndex,
    selectBurial,
    tourNames,
  ]);

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
      const normalizedTourResults = (module.default.features || []).map((feature) => (
        buildTourBrowseResult(feature, {
          tourKey: definition.key,
          tourName,
        })
      ));
      const layer = L.geoJSON(module.default, {
        pointToLayer: createTourMarker(definition.key),
        onEachFeature: createOnEachTourFeature(
          definition.key,
          tourName,
          selectBurial,
          startRouting,
          openExternalDirections,
          removeFromResults,
          (browseResult, featureLayer) => {
            tourFeatureLayersRef.current.set(browseResult.id, featureLayer);
          }
        )
      });

      loadedTourNamesRef.current.add(tourName);
      setTourResultsByName((current) => ({
        ...current,
        [tourName]: normalizedTourResults,
      }));
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
  }, [
    openExternalDirections,
    removeFromResults,
    selectBurial,
    startRouting,
    tourDefinitionsByName,
  ]);

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

  useEffect(() => {
    if (!selectedTour || !selectedTourLayer) return;
    focusTourOnMap(selectedTour);
  }, [focusTourOnMap, selectedTour, selectedTourLayer]);

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
      <BurialSidebar
        activeBurialId={activeBurialId}
        activeRouteBurialId={activeRouteBurialId}
        burialDataError={burialDataError}
        burialRecords={burialRecords}
        filterType={filterType}
        getTourName={getTourName}
        hoveredIndex={hoveredIndex}
        initialQuery={initialBrowseQuery}
        installPromptEvent={installPromptEvent}
        isBurialDataLoading={isBurialDataLoading}
        isInstalled={isInstalled}
        isMobile={isMobile}
        isOnline={isOnline}
        isSearchIndexReady={isSearchIndexReady}
        loadingTourName={loadingTourName}
        lotTierFilter={lotTierFilter}
        markerColors={MARKER_COLORS}
        onBrowseResultSelect={selectBurial}
        onClearSectionFilters={clearSectionFilters}
        onClearSelectedBurials={clearSelectedBurials}
        onFilterTypeChange={setFilterType}
        onFocusSelectedBurial={handleResultClick}
        onHoverIndexChange={setHoveredIndex}
        onLocateMarker={onLocateMarker}
        onLotTierFilterChange={setLotTierFilter}
        onOpenAppMenu={handleOpenAppMenu}
        onOpenDirectionsMenu={handleOpenDirectionsMenu}
        onRemoveSelectedBurial={removeFromResults}
        onSectionChange={activateSectionBrowse}
        onToggleSectionMarkers={() => setShowAllBurials((current) => !current)}
        onTourChange={handleTourSelect}
        searchIndex={searchIndex}
        sectionFilter={sectionFilter}
        selectedBurialRefs={selectedBurialRefs}
        selectedBurials={selectedBurials}
        selectedTour={selectedTour}
        showAllBurials={showAllBurials}
        showIosInstallHint={showIosInstallHint}
        status={status}
        tourDefinitions={TOUR_DEFINITIONS}
        tourLayerError={tourLayerError}
        tourResults={selectedTour ? (tourResultsByName[selectedTour] || []) : []}
        tourStyles={TOURS}
        uniqueSections={uniqueSections}
      />

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
            Install on this device
          </MenuItem>
        )}
        {!isInstalled && showIosInstallHint && (
          <MenuItem disabled>Safari: Share → Add to Home Screen</MenuItem>
        )}
        {!isInstalled && !installPromptEvent && !showIosInstallHint && (
          <MenuItem disabled>App install unavailable in this browser</MenuItem>
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
                if (activeRouteBurialId === burial.id) {
                  stopRouting();
                  return;
                }
                await startRouting(burial);
              }}
            >
              <DirectionsIcon fontSize="small" sx={{ mr: 1 }} />
              {activeRouteBurialId === directionsMenuBurial.id ? 'Stop Route' : 'Route on Map'}
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
        attributionControl={false}
        zoomControl={false}
        maxZoom={25}
      >
        <CustomZoomControl isMobile={isMobile} />
        <DefaultExtentButton isMobile={isMobile} />
        <MapBounds />
        <MapController />
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
                  fillColor: `${feature.properties.Section}` === `${sectionFilter}` ? '#4a90e2' : '#f8f9fa',
                  fillOpacity: `${feature.properties.Section}` === `${sectionFilter}` ? 0.4 : 0.05,
                  color: `${feature.properties.Section}` === `${sectionFilter}` ? '#2c5282' : '#999',
                  weight: `${feature.properties.Section}` === `${sectionFilter}` ? 2 : 1
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
                      activateSectionBrowse(feature.properties.Section, layer.getBounds());
                      L.DomEvent.stopPropagation(e);
                    },
                    // Show label on mouseover if not already selected
                    mouseover: () => {
                      if (`${feature.properties.Section}` !== `${sectionFilter}` && currentZoom < ZOOM_LEVELS.SECTION) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      }
                    },
                    // Hide label on mouseout if not selected
                    mouseout: () => {
                      if (`${feature.properties.Section}` !== `${sectionFilter}` && currentZoom < ZOOM_LEVELS.SECTION) {
                        layer.unbindTooltip();
                      }
                    },
                    // Update tooltip visibility on zoom
                    add: () => {
                      // Initial state - show if selected or zoomed in
                      if (`${feature.properties.Section}` === `${sectionFilter}` || currentZoom >= ZOOM_LEVELS.SECTION) {
                        tooltip.setContent(`Section ${feature.properties.Section_Di}`);
                        layer.bindTooltip(tooltip).openTooltip();
                      }
                    }
                  });

                  // Watch for zoom changes to update label visibility
                  if (window.mapInstance) {
                    window.mapInstance.on('zoomend', () => {
                      const zoom = window.mapInstance.getZoom();
                      if (zoom >= ZOOM_LEVELS.SECTION || `${feature.properties.Section}` === `${sectionFilter}`) {
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
          {routingOrigin && routingDestination && (
            <RoutingControl
              from={routingOrigin}
              to={routingDestination}
            />
          )}

          {/* Search Result Markers - Always on top */}
          {selectedBurials.map((burial, index) => (
            <Marker
              key={createUniqueKey(burial, index)}
              position={[burial.coordinates[1], burial.coordinates[0]]}
              icon={createNumberedIcon(
                index + 1,
                hoveredIndex === index || activeBurialId === burial.id
              )}
              eventHandlers={{
                mouseover: () => setHoveredIndex(index),
                mouseout: () => setHoveredIndex(null),
                click: () => handleMarkerClick(burial)
              }}
              zIndexOffset={1000}
            >
              {burial.source !== "tour" && (
                <Popup>
                  <Box sx={{ minWidth: 220 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {formatBrowseResultName(burial)}
                    </Typography>
                    {buildLocationSummary(burial) && (
                      <Typography variant="body2">{buildLocationSummary(burial)}</Typography>
                    )}
                    {burial.Birth && <Typography variant="body2">Birth: {burial.Birth}</Typography>}
                    {burial.Death && <Typography variant="body2">Death: {burial.Death}</Typography>}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<DirectionsIcon />}
                        onClick={(event) => handleOpenDirectionsMenu(event, burial)}
                      >
                        Directions
                      </Button>
                      <Button
                        variant="text"
                        color="inherit"
                        size="small"
                        startIcon={<CloseIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFromResults(burial.id);
                        }}
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                </Popup>
              )}
            </Marker>
          ))}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
