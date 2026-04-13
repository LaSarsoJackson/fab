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
import ReactDOM from "react-dom";

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
  Menu,
  MenuItem,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HomeIcon from '@mui/icons-material/Home';
import RemoveIcon from "@mui/icons-material/Remove";
import DirectionsIcon from '@mui/icons-material/Directions';
import LaunchIcon from '@mui/icons-material/Launch';

// Local Data and Styles
import ARC_Roads from "./data/ARC_Roads.json";
import ARC_Boundary from "./data/ARC_Boundary.json";
import ARC_Sections from "./data/ARC_Sections.json";
import BurialSidebar from "./BurialSidebar";
import { buildSearchIndex, normalizeName, smartSearch, sortSectionValues } from "./lib/burialSearch";
import {
  buildBrowseSecondaryText,
  buildBurialBrowseResult,
  buildLocationSummary,
  buildTourBrowseResult,
  filterBurialRecordsBySection,
  formatBrowseResultName,
} from "./lib/browseResults";
import { buildDirectionsLink } from "./lib/navigationLinks";
import { getPopupViewportPadding } from "./lib/popupViewport";
import { shouldIgnoreSectionBackgroundSelection } from "./lib/sectionSelection";
import { harmonizeBurialBrowseResult } from "./lib/tourMetadata";
import { getRuntimeEnv } from "./lib/runtimeEnv";
import { parseDeepLinkState } from "./lib/urlState";
import {
  getGeoJsonBounds,
  hasValidGeoJsonCoordinates,
  isLatLngBoundsExpressionValid,
} from "./lib/geoJsonBounds";
import { TOUR_DEFINITIONS } from "./lib/tourDefinitions";
import { BOUNDARY_BBOX, LOCATION_BUFFER_BOUNDARY } from './lib/constants';

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

const DESKTOP_MAP_CONTROL_RIGHT = '12px';
const DESKTOP_HOME_CONTROL_TOP = '60px';
const DESKTOP_ZOOM_CONTROL_TOP = '110px';
const MOBILE_MAP_CONTROL_RIGHT = 'calc(env(safe-area-inset-right, 0px) + 12px)';
const MOBILE_DEFAULT_EXTENT_TOP = 'calc(env(safe-area-inset-top, 0px) + 60px)';
const ARCE_IMAGE_BASE_URL = 'https://www.albany.edu/arce/images';
const DEV_IMAGE_SERVER_ORIGIN = (process.env.REACT_APP_DEV_IMAGE_SERVER_ORIGIN || '').trim().replace(/\/+$/, '');
const DEFAULT_VIEW_BOUNDS = [
  [42.694180, -73.741980],
  [42.714180, -73.721980]
];
const PADDED_BOUNDARY_BOUNDS = [
  [BOUNDARY_BBOX[1] - 0.01, BOUNDARY_BBOX[0] - 0.01],
  [BOUNDARY_BBOX[3] + 0.01, BOUNDARY_BBOX[2] + 0.01]
];
const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g', '3g']);
const NUMBERED_ICON_CACHE = new Map();
const PMTILES_EXPERIMENT_STORAGE_KEY = 'fab:enablePmtilesExperiment';

const getPublicAssetUrl = (path) => {
  const base = process.env.PUBLIC_URL || '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const mapControlShellSx = {
  position: 'absolute',
  zIndex: 1100,
  borderRadius: '14px',
  border: '1px solid rgba(18, 47, 40, 0.14)',
  background: 'rgba(255, 255, 255, 0.9)',
  boxShadow: '0 14px 30px rgba(16, 35, 31, 0.18)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  overflow: 'hidden',
};

const mapControlButtonSx = {
  width: 40,
  height: 40,
  borderRadius: 0,
  color: 'var(--text-main)',
};
const CEMETERY_CLUSTER_GLYPH = `
  <svg class="cemetery-cluster__glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path
      d="M10 27V12.5C10 8.91 12.91 6 16.5 6S23 8.91 23 12.5V27H25.5V29H7.5V27H10Z"
      fill="#d97b2b"
      fill-opacity="0.76"
      stroke="rgba(102, 58, 18, 0.82)"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
    <path
      d="M13.2 12.2H19.8"
      stroke="rgba(255,255,255,0.75)"
      stroke-width="1.4"
      stroke-linecap="round"
    />
    <path
      d="M16.5 9.4V15"
      stroke="rgba(255,255,255,0.75)"
      stroke-width="1.4"
      stroke-linecap="round"
    />
  </svg>
`;

const isRenderableBounds = (bounds) => (
  isLatLngBoundsExpressionValid(bounds) ||
  (typeof bounds?.isValid === "function" && bounds.isValid())
);

//=============================================================================
// React Components
//=============================================================================

/**
 * Custom zoom control component that provides zoom in/out buttons
 * Positioned at the top-right corner of the map
 */
function CustomZoomControl({ isMobile }) {
  const map = useMap();

  if (isMobile) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        ...mapControlShellSx,
        top: DESKTOP_ZOOM_CONTROL_TOP,
        right: DESKTOP_MAP_CONTROL_RIGHT,
      }}
    >
      <Box sx={{ display: 'grid' }}>
        <IconButton onClick={() => map.zoomIn()} size="small" sx={mapControlButtonSx} title="Zoom in">
          <AddIcon fontSize="small" />
        </IconButton>
        <Box sx={{ height: 1, backgroundColor: 'rgba(18, 47, 40, 0.1)' }} />
        <IconButton onClick={() => map.zoomOut()} size="small" sx={mapControlButtonSx} title="Zoom out">
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

/**
 * Component that restricts map bounds and zoom levels to the cemetery area
 * Uses Turf.js for geospatial calculations
 */
function MapBounds() {
  const map = useMap();

  useEffect(() => {
    // Set map constraints
    map.setMaxBounds(PADDED_BOUNDARY_BOUNDS);
    map.setMinZoom(13);
    map.setMaxZoom(25);

    // Initial fit to bounds
    map.whenReady(() => {
      map.fitBounds(PADDED_BOUNDARY_BOUNDS);
    });
  }, [map]);

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

    return () => {
      if (window.mapInstance === map) {
        delete window.mapInstance;
      }
    };
  }, [map]);

  return null;
}

/**
 * Optional PMTiles experiment for validating vector rendering in development.
 * This stays off the main path so Leaflet clustering remains the default UX.
 */
function ExperimentalVectorBurialLayer({ burialRecordsByObjectId, onSelectBurial }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;

    let ignore = false;

    const loadExperimentalLayer = async () => {
      try {
        const protomaps = await import("protomaps-leaflet");
        if (ignore) return;

        const layer = protomaps.leafletLayer({
          url: getPublicAssetUrl("/data/geo_burials.pmtiles"),
          pane: "overlayPane",
          paintRules: [
            {
              dataLayer: "burials",
              symbolizer: new protomaps.CircleSymbolizer({
                radius: 3,
                fill: "#125e4a",
                opacity: 0.72,
                stroke: "#ffffff",
                width: 1,
              }),
            },
          ],
        });

        layer.addTo(map);
        layerRef.current = layer;
      } catch (error) {
        console.error("Failed to load PMTiles experiment:", error);
      }
    };

    const handleMapClick = (event) => {
      const layer = layerRef.current;
      if (!layer?.queryTileFeaturesDebug) return;

      const pickedFeatures = layer.queryTileFeaturesDebug(
        event.latlng.lng,
        event.latlng.lat,
        12
      ).get("") || [];

      const pickedBurial = pickedFeatures.find((entry) => entry.layerName === "burials");
      const objectId = String(
        pickedBurial?.feature?.props?.OBJECTID ??
        pickedBurial?.feature?.props?.objectid ??
        ""
      );

      if (!objectId) return;

      const burialRecord = burialRecordsByObjectId.get(objectId);
      if (burialRecord) {
        onSelectBurial(burialRecord);
      }
    };

    void loadExperimentalLayer();
    map.on("click", handleMapClick);

    return () => {
      ignore = true;
      map.off("click", handleMapClick);
      if (layerRef.current) {
        layerRef.current.remove();
        layerRef.current = null;
      }
    };
  }, [burialRecordsByObjectId, map, onSelectBurial]);

  return null;
}

/**
 * Button component that resets the map view to the default extent
 */
function DefaultExtentButton({ isMobile }) {
  const map = useMap();

  const handleClick = () => {
    map.fitBounds(DEFAULT_VIEW_BOUNDS);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        ...mapControlShellSx,
        top: isMobile
          ? MOBILE_DEFAULT_EXTENT_TOP
          : DESKTOP_HOME_CONTROL_TOP,
        right: isMobile
          ? MOBILE_MAP_CONTROL_RIGHT
          : DESKTOP_MAP_CONTROL_RIGHT,
      }}
    >
      <IconButton
        onClick={handleClick}
        size="small"
        title="Return to Default Extent"
        sx={mapControlButtonSx}
      >
        <HomeIcon fontSize="small" />
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
  const cacheKey = `${number}:${isHighlighted ? '1' : '0'}`;
  const cachedIcon = NUMBERED_ICON_CACHE.get(cacheKey);
  if (cachedIcon) {
    return cachedIcon;
  }

  const colorIndex = (number - 1) % MARKER_COLORS.length;
  const color = MARKER_COLORS[colorIndex];

  const icon = L.divIcon({
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

  NUMBERED_ICON_CACHE.set(cacheKey, icon);
  return icon;
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
  if (!imageName || imageName === "NONE") return `${ARCE_IMAGE_BASE_URL}/no-image.jpg`;

  const normalizedImageName = String(imageName).trim();
  const imageFileName = /\.[a-z0-9]+$/i.test(normalizedImageName)
    ? normalizedImageName
    : `${normalizedImageName}.jpg`;

  if (process.env.NODE_ENV === 'development' && DEV_IMAGE_SERVER_ORIGIN) {
    return `${DEV_IMAGE_SERVER_ORIGIN}/src/data/images/${imageFileName}`;
  }

  return `${ARCE_IMAGE_BASE_URL}/${imageFileName}`;
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
 * Popup formatting helpers shared by tour and burial popups.
 */
const cleanPopupValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeArcePageLink = (value = "") => {
  const normalized = cleanPopupValue(value);
  if (!normalized || /^(none|unknown)$/i.test(normalized)) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const trimmed = normalized.replace(/^\/+/, "");
  if (/\.(?:jpe?g|png|gif|webp|svg)$/i.test(trimmed)) {
    return "";
  }

  if (/^[a-z]+:/i.test(trimmed)) {
    return trimmed;
  }

  if (/\.html?$/i.test(trimmed)) {
    return `https://www.albany.edu/arce/${trimmed}`;
  }

  return `https://www.albany.edu/arce/${trimmed}.html`;
};

const resolvePopupBiographyLink = (record = {}) => (
  normalizeArcePageLink(record.biographyLink) || normalizeArcePageLink(record.Tour_Bio)
);

const parsePopupDateParts = (value) => {
  const normalized = cleanPopupValue(value);
  if (!normalized || /^(unknown|none)$/i.test(normalized)) {
    return null;
  }

  const isoMatch = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const usMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    return {
      year: Number(usMatch[3]),
      month: Number(usMatch[1]),
      day: Number(usMatch[2]),
    };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
};

const formatPopupDate = (value) => {
  const dateParts = parsePopupDateParts(value);
  if (!dateParts) {
    return cleanPopupValue(value);
  }

  return `${dateParts.month}/${dateParts.day}/${dateParts.year}`;
};

const comparePopupDateParts = (left, right) => {
  if (!left || !right) return 0;

  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
};

const resolvePopupDates = (record = {}) => {
  const birthValue = cleanPopupValue(record.Birth ?? record.birth);
  const deathValue = cleanPopupValue(record.Death ?? record.death);
  const birthDate = parsePopupDateParts(birthValue);
  const deathDate = parsePopupDateParts(deathValue);
  const shouldSuppressBirth = Boolean(birthDate && deathDate && comparePopupDateParts(birthDate, deathDate) > 0);

  return {
    birth: shouldSuppressBirth ? "" : formatPopupDate(birthValue),
    death: formatPopupDate(deathValue),
  };
};

const buildPopupSourceLabel = (record = {}) => (
  cleanPopupValue(record.tourName || (record.source === "tour" ? TOURS[record.tourKey]?.name : "Burial record"))
);

const buildPopupRows = (record = {}) => {
  const { birth, death } = resolvePopupDates(record);
  const title = cleanPopupValue(record.Titles || record.extraTitle);
  const rank = cleanPopupValue(record.Highest_Ra);
  const initialTerm = cleanPopupValue(record.Initial_Te);
  const subsequentTerm = cleanPopupValue(record.Subsequent);
  const unit = cleanPopupValue(record.Unit);
  const location = cleanPopupValue(buildLocationSummary(record));
  const headstone = cleanPopupValue(record.Headstone_);
  const service = cleanPopupValue(record.Service_Re);
  const headstoneLabel = headstone.toLowerCase().startsWith("headstone") ? headstone : `Headstone ${headstone}`;

  return [
    title ? { label: "Role", value: title } : null,
    rank && rank !== title ? { label: "Rank", value: rank } : null,
    initialTerm ? { label: "Initial term", value: initialTerm } : null,
    subsequentTerm ? { label: "Subsequent term", value: subsequentTerm } : null,
    unit ? { label: "Unit", value: unit } : null,
    location ? { label: "Location", value: location } : null,
    birth ? { label: "Born", value: birth } : null,
    death ? { label: "Died", value: death } : null,
    headstone ? { label: "Headstone", value: headstoneLabel } : null,
    service ? { label: "Service", value: service } : null,
  ].filter(Boolean);
};

const buildPopupViewModel = (record = {}) => {
  const portraitPath = cleanPopupValue(record.Bio_Portra || record.Bio_Portri || record.Bio_portra);
  const biographyLink = resolvePopupBiographyLink(record);
  const hasPortrait = Boolean(portraitPath && portraitPath !== "NONE");
  const imageUrl = hasPortrait
    ? getImagePath(portraitPath)
    : (biographyLink ? getImagePath("NONE") : "");
  const heading = cleanPopupValue(formatBrowseResultName(record));

  return {
    heading,
    sourceLabel: buildPopupSourceLabel(record),
    rows: buildPopupRows(record),
    biographyLink,
    imageUrl,
    imageAlt: heading ? `${heading} portrait` : "Burial portrait",
    imageHint: biographyLink ? "Tap the image to open the ARCE page." : "",
  };
};

const keepLeafletPopupInView = (popup) => {
  const map = popup?._map;
  const mapContainer = map?.getContainer?.();
  if (!map || !mapContainer || typeof document === "undefined") return;

  const sidebar = document.querySelector(".left-sidebar");
  const { topLeft, bottomRight } = getPopupViewportPadding({
    containerRect: mapContainer.getBoundingClientRect(),
    overlayRect: sidebar?.getBoundingClientRect?.(),
  });

  popup.options.autoPanPaddingTopLeft = L.point(topLeft[0], topLeft[1]);
  popup.options.autoPanPaddingBottomRight = L.point(bottomRight[0], bottomRight[1]);

  if (typeof popup._adjustPan === "function") {
    popup._adjustPan();
  }
};

const scheduleLeafletPopupInView = (popup) => {
  if (!popup) return;

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    keepLeafletPopupInView(popup);
    return;
  }

  window.requestAnimationFrame(() => {
    keepLeafletPopupInView(popup);
  });
};

function PopupCardContent({
  record,
  onOpenDirectionsMenu,
  onRemove,
  getPopup,
}) {
  const popupView = buildPopupViewModel(record);
  const popupKey = record?.id || createUniqueKey(record, 0);
  const handlePopupLayoutChange = () => {
    scheduleLeafletPopupInView(getPopup?.());
  };

  return (
    <Box className="popup-card">
      {popupView.sourceLabel && (
        <Box component="p" className="popup-card__eyebrow">
          {popupView.sourceLabel}
        </Box>
      )}
      <Box component="h3" className="popup-card__title">
        {popupView.heading}
      </Box>
      <Box component="dl" className="popup-card__details">
        {popupView.rows.map(({ label, value }) => (
          <Box key={`${popupKey}-${label}`} className="popup-card__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Box>
        ))}
      </Box>
      {popupView.imageUrl && (
        <Box className="popup-card__media">
          {popupView.imageHint && (
            <Box component="p" className="popup-card__hint">
              {popupView.imageHint}
            </Box>
          )}
          {popupView.biographyLink ? (
            <a
              className="popup-card__image-link"
              href={popupView.biographyLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <img
                className="popup-card__image"
                src={popupView.imageUrl}
                alt={popupView.imageAlt}
                loading="lazy"
                onLoad={handlePopupLayoutChange}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = "https://www.albany.edu/arce/images/no-image.jpg";
                  handlePopupLayoutChange();
                }}
              />
            </a>
          ) : (
            <img
              className="popup-card__image"
              src={popupView.imageUrl}
              alt={popupView.imageAlt}
              loading="lazy"
              onLoad={handlePopupLayoutChange}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "https://www.albany.edu/arce/images/no-image.jpg";
                handlePopupLayoutChange();
              }}
            />
          )}
        </Box>
      )}
      <Box className="popup-card__actions">
        <button
          type="button"
          className="popup-card__action popup-card__action--primary"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDirectionsMenu?.(event);
          }}
        >
          Directions
        </button>
        <button
          type="button"
          className="popup-card__action popup-card__action--ghost"
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
        >
          Remove
        </button>
      </Box>
    </Box>
  );
}

const bindReactPopup = ({
  layer,
  record,
  onOpenDirectionsMenu,
  onRemove,
}) => {
  if (!layer || typeof document === "undefined") return;

  const popupContainer = document.createElement("div");

  layer.bindPopup(popupContainer, {
    maxWidth: 300,
    className: "custom-popup",
  });

  const renderPopup = () => {
    ReactDOM.render(
      (
        <PopupCardContent
          record={record}
          onOpenDirectionsMenu={onOpenDirectionsMenu}
          onRemove={onRemove}
          getPopup={() => layer.getPopup?.()}
        />
      ),
      popupContainer
    );
  };

  const unmountPopup = () => {
    if (popupContainer.hasChildNodes()) {
      ReactDOM.unmountComponentAtNode(popupContainer);
    }
  };

  layer.on("popupopen", ({ popup }) => {
    renderPopup();
    scheduleLeafletPopupInView(popup);
  });
  layer.on("popupclose", unmountPopup);
  layer.on("remove", unmountPopup);
};

const buildSectionLotKey = (record = {}) => {
  const section = cleanPopupValue(record.Section ?? record.section);
  const lot = cleanPopupValue(record.Lot ?? record.lot);
  if (!section || !lot) return "";
  return `${section}::${lot}`;
};

const getPrimaryNameToken = (value = "") => normalizeName(value).split(" ").find(Boolean) || "";

const getRecordDistanceMeters = (left, right) => {
  if (!Array.isArray(left?.coordinates) || !Array.isArray(right?.coordinates)) {
    return Number.POSITIVE_INFINITY;
  }

  try {
    return turf.distance(
      turf.point(left.coordinates),
      turf.point(right.coordinates),
      { units: "meters" }
    );
  } catch (error) {
    return Number.POSITIVE_INFINITY;
  }
};

const scoreTourBurialMatch = (tourRecord, burialRecord) => {
  let score = 0;
  const tourName = cleanPopupValue(tourRecord.fullName || tourRecord.displayName);
  const burialName = cleanPopupValue(burialRecord.fullName || burialRecord.displayName);
  const tourNormalized = normalizeName(tourName);
  const burialNormalized = normalizeName(burialName);

  if (tourNormalized && burialNormalized) {
    if (tourNormalized === burialNormalized) {
      score += 10;
    }

    const tourTokens = tourNormalized.split(" ").filter(Boolean);
    const burialTokens = burialNormalized.split(" ").filter(Boolean);
    const sharedTokens = tourTokens.filter((token) => burialTokens.includes(token));

    score += sharedTokens.length * 1.5;

    const tourLast = tourTokens[tourTokens.length - 1];
    const burialLast = burialTokens[burialTokens.length - 1];
    if (tourLast && burialLast && tourLast === burialLast) {
      score += 4;
    }

    const tourFirst = getPrimaryNameToken(tourNormalized);
    const burialFirst = getPrimaryNameToken(burialNormalized);
    if (tourFirst && burialFirst && tourFirst === burialFirst) {
      score += 3;
    }
  }

  if (cleanPopupValue(tourRecord.Grave) && cleanPopupValue(burialRecord.Grave) && String(tourRecord.Grave) === String(burialRecord.Grave)) {
    score += 2;
  }

  if (cleanPopupValue(tourRecord.Tier) && cleanPopupValue(burialRecord.Tier) && String(tourRecord.Tier) === String(burialRecord.Tier)) {
    score += 1;
  }

  const distance = getRecordDistanceMeters(tourRecord, burialRecord);
  if (distance <= 4) {
    score += 6;
  } else if (distance <= 12) {
    score += 4;
  } else if (distance <= 25) {
    score += 2;
  } else if (distance <= 50) {
    score += 1;
  }

  return score;
};

const buildBurialLookup = (records = []) => {
  const bySectionLot = new Map();

  records.forEach((record) => {
    const key = buildSectionLotKey(record);
    if (!key) return;

    if (!bySectionLot.has(key)) {
      bySectionLot.set(key, []);
    }

    bySectionLot.get(key).push(record);
  });

  return { bySectionLot };
};

const findMatchingBurialRecord = (tourRecord, burialLookup) => {
  if (!tourRecord || tourRecord.source !== "tour") return null;

  const candidates = burialLookup?.bySectionLot?.get(buildSectionLotKey(tourRecord)) || [];
  if (!candidates.length) return null;

  let bestCandidate = null;
  let bestScore = -Infinity;

  candidates.forEach((candidate) => {
    const score = scoreTourBurialMatch(tourRecord, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestScore >= 7 ? bestCandidate : null;
};

const harmonizeTourBrowseResult = (tourRecord, burialLookup) => {
  const matchedBurial = findMatchingBurialRecord(tourRecord, burialLookup);
  const rawDisplayName = cleanPopupValue(tourRecord.displayName || tourRecord.fullName || formatBrowseResultName(tourRecord));
  const displayName = matchedBurial ? formatBrowseResultName(matchedBurial) : rawDisplayName;
  const fullName = cleanPopupValue(
    matchedBurial?.fullName ||
    matchedBurial?.displayName ||
    tourRecord.fullName ||
    displayName
  );
  const resolvedDates = resolvePopupDates({
    Birth: matchedBurial?.Birth || tourRecord.Birth,
    Death: matchedBurial?.Death || tourRecord.Death,
  });
  const mergedRecord = {
    ...tourRecord,
    ...(matchedBurial
      ? {
          matchedBurialId: matchedBurial.id,
          matchedBurialName: displayName,
          displayAlias: rawDisplayName !== displayName ? rawDisplayName : "",
          First_Name: matchedBurial.First_Name || tourRecord.First_Name,
          Last_Name: matchedBurial.Last_Name || tourRecord.Last_Name,
          Section: matchedBurial.Section || tourRecord.Section,
          Lot: matchedBurial.Lot || tourRecord.Lot,
          Tier: matchedBurial.Tier ?? tourRecord.Tier,
          Grave: matchedBurial.Grave ?? tourRecord.Grave,
          row: tourRecord.row || matchedBurial.row,
          position: tourRecord.position || matchedBurial.position,
        }
      : {}),
    displayName,
    label: displayName,
    fullName,
    fullNameNormalized: normalizeName(fullName || displayName),
    Birth: resolvedDates.birth,
    Death: resolvedDates.death,
  };

  const secondaryText = buildBrowseSecondaryText(mergedRecord);
  const searchableLabel = [displayName, secondaryText, cleanPopupValue(mergedRecord.tourName)].filter(Boolean).join(" • ");
  const nameVariantsNormalized = Array.from(
    new Set([
      ...(tourRecord.nameVariantsNormalized || []),
      ...(matchedBurial?.nameVariantsNormalized || []),
      normalizeName(tourRecord.displayName),
      normalizeName(tourRecord.fullName),
      normalizeName(displayName),
      normalizeName(fullName),
    ].filter(Boolean))
  );

  return {
    ...mergedRecord,
    nameVariantsNormalized,
    secondaryText,
    searchableLabel,
    searchableLabelLower: searchableLabel.toLowerCase(),
  };
};

//=============================================================================
// Data Structures
//=============================================================================

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

const getSectionMarkerStyle = (isActive = false) => ({
  ...markerStyle,
  radius: isActive ? 8 : 6,
  weight: isActive ? 2 : markerStyle.weight,
  fillOpacity: isActive ? 0.95 : markerStyle.fillOpacity
});

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
  onOpenDirectionsMenu,
  onRemoveResult,
  onRegisterLayer,
  resolveTourBrowseResult
) => (feature, layer) => {
  if (feature.properties) {
    feature.properties.title = tourKey;
    const baseBrowseResult = buildTourBrowseResult(feature, { tourKey, tourName });
    const browseResult = resolveTourBrowseResult
      ? resolveTourBrowseResult(baseBrowseResult)
      : baseBrowseResult;
    bindReactPopup({
      layer,
      record: browseResult,
      onOpenDirectionsMenu: (event) => {
        onOpenDirectionsMenu(event, browseResult);
      },
      onRemove: () => {
        onRemoveResult(browseResult.id);
        layer.closePopup();
      },
    });
    if (onRegisterLayer) {
      onRegisterLayer(browseResult, layer);
    }
    layer.on('click', () => {
      onSelect(browseResult, {
        animate: false,
        openTourPopup: true,
        preserveViewport: true,
      });
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
  const { isDev } = getRuntimeEnv();
  //-----------------------------------------------------------------------------
  // State Management
  //-----------------------------------------------------------------------------

  // Map and UI State
  const [overlayMaps, setOverlayMaps] = useState({});
  const [tourBoundsByName, setTourBoundsByName] = useState({});
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
  const [tourMatches, setTourMatches] = useState({});
  const [isBurialDataLoading, setIsBurialDataLoading] = useState(true);
  const [burialDataError, setBurialDataError] = useState('');
  const [tourLayerError, setTourLayerError] = useState('');
  const [loadingTourName, setLoadingTourName] = useState('');
  const [searchIndex, setSearchIndex] = useState(null);
  const [isSearchIndexReady, setIsSearchIndexReady] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [isPmtilesEnabled, setIsPmtilesEnabled] = useState(false);

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
  const sectionFeatureLayersRef = useRef(new Map());
  const sectionMarkersByIdRef = useRef(new Map());
  const activeSectionMarkerIdRef = useRef(null);
  const activeBurialIdRef = useRef(null);
  const hoveredSectionIdRef = useRef(null);
  const sectionTooltipSyncFrameRef = useRef(null);
  const didApplyUrlStateRef = useRef(false);
  const loadedTourNamesRef = useRef(new Set());
  const loadingTourNamesRef = useRef(new Set());
  const selectedBurialRefs = useRef(new Map());
  const selectedMarkerLayersRef = useRef(new Map());
  const tourFeatureLayersRef = useRef(new Map());
  const pendingPopupBurialRef = useRef(null);

  //-----------------------------------------------------------------------------
  // Memoized Values
  //-----------------------------------------------------------------------------

  const uniqueSections = useMemo(
    () => Array.from(new Set(burialFeatures.map((feature) => feature.properties.Section))).sort(sortSectionValues),
    [burialFeatures]
  );
  const sectionBoundsById = useMemo(
    () => new Map(
      ARC_Sections.features
        .filter((feature) => feature?.properties?.Section)
        .map((feature) => [String(feature.properties.Section), getGeoJsonBounds(feature)])
        .filter(([, bounds]) => isLatLngBoundsExpressionValid(bounds))
    ),
    []
  );

  const getTourName = useCallback(
    (option = {}) => cleanPopupValue(
      option.tourName ||
      TOURS[option.title]?.name ||
      TOURS[option.tourKey]?.name ||
      option.title ||
      option.tourKey ||
      ''
    ),
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
  const selectedTourBounds = useMemo(
    () => (selectedTour ? tourBoundsByName[selectedTour] || null : null),
    [selectedTour, tourBoundsByName]
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
  const canIdlePrefetchTours = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return !isMobile;
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData) {
      return false;
    }

    if (connection?.effectiveType && SLOW_CONNECTION_TYPES.has(connection.effectiveType)) {
      return false;
    }

    if (isMobile && navigator.deviceMemory && navigator.deviceMemory <= 4) {
      return false;
    }

    return true;
  }, [isMobile]);

  useEffect(() => {
    if (!isDev || typeof window === 'undefined') {
      setIsPmtilesEnabled(false);
      return;
    }

    const storedValue = window.localStorage.getItem(PMTILES_EXPERIMENT_STORAGE_KEY);
    setIsPmtilesEnabled(storedValue === 'true');
  }, [isDev]);

  useEffect(() => {
    if (!isDev || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      PMTILES_EXPERIMENT_STORAGE_KEY,
      isPmtilesEnabled ? 'true' : 'false'
    );
  }, [isDev, isPmtilesEnabled]);

  const burialRecords = useMemo(() => (
    burialFeatures.map((feature) => {
      const baseRecord = buildBurialBrowseResult(feature, { getTourName });
      return harmonizeBurialBrowseResult(baseRecord, tourMatches);
    })
  ), [burialFeatures, getTourName, tourMatches]);

  const burialRecordsById = useMemo(
    () => new Map(burialRecords.map((record) => [record.id, record])),
    [burialRecords]
  );
  const burialRecordsByObjectId = useMemo(
    () => new Map(
      burialRecords.map((record) => [String(record.OBJECTID), record])
    ),
    [burialRecords]
  );

  const burialLookup = useMemo(
    () => buildBurialLookup(burialRecords),
    [burialRecords]
  );

  const resolveTourBrowseResult = useCallback(
    (tourRecord) => harmonizeTourBrowseResult(tourRecord, burialLookup),
    [burialLookup]
  );

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
    const isWithinBuffer = turf.booleanPointInPolygon(point, LOCATION_BUFFER_BOUNDARY);

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

  const getPopupLayerForBurial = useCallback((burial) => {
    if (!burial) return null;

    if (burial.source === "tour") {
      return tourFeatureLayersRef.current.get(burial.id) || null;
    }

    return selectedMarkerLayersRef.current.get(burial.id) || null;
  }, []);

  const openPopupForBurial = useCallback((burial) => {
    const layer = getPopupLayerForBurial(burial);
    if (!layer?.openPopup) {
      return false;
    }

    layer.openPopup();
    scheduleLeafletPopupInView(layer.getPopup?.());
    return true;
  }, [getPopupLayerForBurial]);

  const focusBurialPopup = useCallback((burial, map) => {
    if (!burial) return;

    const openPopup = () => {
      if (!openPopupForBurial(burial)) {
        pendingPopupBurialRef.current = burial;
      } else {
        pendingPopupBurialRef.current = null;
      }
    };

    if (map) {
      map.once("moveend", openPopup);
      return;
    }

    openPopup();
  }, [openPopupForBurial]);

  /**
   * Focuses a burial consistently regardless of whether it was found by search or map click.
   */
  const focusBurial = useCallback((
    burial,
    {
      addToSelection = false,
      animate = true,
      openTourPopup = true,
      preserveViewport = false,
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

      if (preserveViewport) {
        if (openTourPopup) {
          focusBurialPopup(burial);
        }
        return;
      }

      const targetZoom = Math.max(map.getZoom(), ZOOM_LEVEL);
      const currentCenter = map.getCenter();
      const distance = map.distance(currentCenter, targetLatLng);
      const shouldAnimate = animate && distance > 24;

      if (!shouldAnimate) {
        map.setView(targetLatLng, targetZoom, { animate: false });
        if (openTourPopup) {
          focusBurialPopup(burial);
        }
        return;
      }

      map.stop();

      if (openTourPopup) {
        focusBurialPopup(burial, map);
      }

      map.flyTo(
        targetLatLng,
        targetZoom,
        {
          duration: 0.5,
          easeLinearity: 0.2,
        }
      );
      return;
    }

    if (openTourPopup) {
      focusBurialPopup(burial);
    }
  }, [focusBurialPopup]);

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

  const handleTogglePmtilesExperiment = useCallback(() => {
    setIsPmtilesEnabled((current) => !current);
  }, []);

  const handleInstallApp = useCallback(async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }, [installPromptEvent]);

  const handleOpenDirectionsMenu = useCallback((anchorOrEvent, burial) => {
    anchorOrEvent?.stopPropagation?.();
    const anchorEl = anchorOrEvent?.currentTarget || anchorOrEvent || null;
    setDirectionsMenuAnchorEl(anchorEl);
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
    selectBurial(burial, {
      animate: false,
      openTourPopup: true,
      preserveViewport: true,
    });
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
          html: `
            <div class="cemetery-cluster">
              ${CEMETERY_CLUSTER_GLYPH}
              <span class="cemetery-cluster__count">${count > 99 ? '99+' : count}</span>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
      }
    });
  }, []);

  const syncActiveSectionMarker = useCallback((nextActiveId) => {
    const sectionMarkers = sectionMarkersByIdRef.current;
    const previousActiveId = activeSectionMarkerIdRef.current;

    if (previousActiveId && previousActiveId !== nextActiveId) {
      const previousMarker = sectionMarkers.get(previousActiveId);
      if (previousMarker) {
        previousMarker.setStyle(getSectionMarkerStyle(false));
      }
    }

    if (nextActiveId) {
      const nextMarker = sectionMarkers.get(nextActiveId);
      if (nextMarker) {
        nextMarker.setStyle(getSectionMarkerStyle(true));
        if (typeof nextMarker.bringToFront === 'function') {
          nextMarker.bringToFront();
        }
      }
    }

    activeSectionMarkerIdRef.current = nextActiveId || null;
  }, []);

  const syncSectionTooltips = useCallback(() => {
    if (!window.mapInstance) return;

    const zoom = window.mapInstance.getZoom();
    sectionFeatureLayersRef.current.forEach(({ layer, tooltip, sectionValue, label }) => {
      const isHovered = hoveredSectionIdRef.current === String(sectionValue);
      const shouldShowTooltip =
        isHovered ||
        zoom >= ZOOM_LEVELS.SECTION ||
        `${sectionValue}` === `${sectionFilter}`;

      if (shouldShowTooltip) {
        tooltip.setContent(label);
        if (!layer.getTooltip()) {
          layer.bindTooltip(tooltip);
        }
        layer.openTooltip();
        return;
      }

      if (typeof layer.closeTooltip === 'function') {
        layer.closeTooltip();
      }
      if (layer.getTooltip()) {
        layer.unbindTooltip();
      }
      // Ensure the tooltip DOM element is removed for permanent tooltips
      if (tooltip && tooltip._container && tooltip._container.parentNode) {
        tooltip._container.parentNode.removeChild(tooltip._container);
      }
    });
  }, [sectionFilter]);

  const scheduleSectionTooltipSync = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      syncSectionTooltips();
      return;
    }

    if (sectionTooltipSyncFrameRef.current) {
      window.cancelAnimationFrame(sectionTooltipSyncFrameRef.current);
    }

    sectionTooltipSyncFrameRef.current = window.requestAnimationFrame(() => {
      sectionTooltipSyncFrameRef.current = null;
      syncSectionTooltips();
    });
  }, [syncSectionTooltips]);

  const clearHoveredSection = useCallback(() => {
    const hoveredSectionId = hoveredSectionIdRef.current;
    if (!hoveredSectionId) return;

    hoveredSectionIdRef.current = null;

    const hoveredSection = sectionFeatureLayersRef.current.get(String(hoveredSectionId));
    if (hoveredSection?.layer) {
      hoveredSection.layer.setStyle({
        weight: `${hoveredSection.sectionValue}` === `${sectionFilter}` ? 2 : 1,
      });
    }

    scheduleSectionTooltipSync();
  }, [scheduleSectionTooltipSync, sectionFilter]);

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
   * Load the lightweight burial search index asynchronously.
   */
  useEffect(() => {
    let ignore = false;

    const loadBurials = async () => {
      setIsBurialDataLoading(true);
      setBurialDataError('');
      try {
        // Fetch the lightweight search index from public directory
        const response = await fetch(getPublicAssetUrl('/data/Search_Burials.json'));
        if (!response.ok) throw new Error('Failed to fetch search index');
        const minifiedData = await response.json();

        if (!ignore) {
          // Remap minified keys to full property names for app compatibility
          const features = minifiedData.map(item => ({
            id: item.i,
            properties: {
              OBJECTID: item.i,
              First_Name: item.f,
              Last_Name: item.l,
              Section: item.s,
              Lot: item.lo,
              Grave: item.g,
              Tier: item.t,
              Birth: item.b,
              Death: item.d,
              tourKey: item.tk,
              title: item.tk
            },
            geometry: item.c ? { type: 'Point', coordinates: item.c } : null
          }));
          setBurialFeatures(features);
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
    let cancelled = false;
    let handle;

    const loadTourMetadata = async () => {
      try {
        const module = await import('./data/TourMatches.json');
        if (!cancelled) {
          setTourMatches(module.default || module);
        }
      } catch (error) {
        console.error("Failed to load tour metadata:", error);
      }
    };

    const scheduleLoad = () => {
      void loadTourMetadata();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      handle = window.requestIdleCallback(scheduleLoad, { timeout: 1500 });
    } else {
      handle = setTimeout(scheduleLoad, 0);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && "cancelIdleCallback" in window && typeof handle === "number") {
        window.cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
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
    if (!burialRecordsById.size) return;

    setSelectedBurials((prev) => {
      let changed = false;
      const next = prev.map((burial) => {
        if (burial?.source !== "burial") return burial;

        const latest = burialRecordsById.get(burial.id);
        if (!latest) return burial;

        const needsRefresh = (
          latest.tourKey !== burial.tourKey ||
          latest.tourName !== burial.tourName ||
          latest.extraTitle !== burial.extraTitle ||
          latest.Bio_Portra !== burial.Bio_Portra ||
          latest.Bio_Portri !== burial.Bio_Portri ||
          latest.Bio_portra !== burial.Bio_portra ||
          latest.Tour_Bio !== burial.Tour_Bio
        );

        if (!needsRefresh) return burial;

        changed = true;
        return latest;
      });

      return changed ? next : prev;
    });

    setDirectionsMenuBurial((current) => {
      if (current?.source !== "burial") return current;

      const latest = burialRecordsById.get(current.id);
      return latest || current;
    });
  }, [burialRecordsById]);

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
   * Update section burial marker display
   */
  useEffect(() => {
    if (!window.mapInstance || !showAllBurials || !sectionFilter) return;

    const map = window.mapInstance;
    if (markerClusterRef.current && map.hasLayer(markerClusterRef.current)) {
      markerClusterRef.current.clearLayers();
      map.removeLayer(markerClusterRef.current);
    }

    const clusterGroup = createClusterGroup();
    const nextSectionMarkers = new Map();
    markerClusterRef.current = clusterGroup;

    sectionBurials.forEach((burial) => {
      if (!Array.isArray(burial.coordinates)) return;

      const marker = L.circleMarker(
        [burial.coordinates[1], burial.coordinates[0]],
        getSectionMarkerStyle(activeBurialIdRef.current === burial.id)
      );
      bindReactPopup({
        layer: marker,
        record: burial,
        onOpenDirectionsMenu: (event) => {
          handleOpenDirectionsMenu(event, burial);
        },
        onRemove: () => {
          removeFromResults(burial.id);
          marker.closePopup();
        },
      });
      marker.on('click', () => {
        selectBurial(burial, {
          animate: false,
          openTourPopup: true,
          preserveViewport: true,
        });
      });

      nextSectionMarkers.set(burial.id, marker);
      clusterGroup.addLayer(marker);
    });

    sectionMarkersByIdRef.current = nextSectionMarkers;
    map.addLayer(clusterGroup);
    syncActiveSectionMarker(activeBurialIdRef.current);

    return () => {
      if (markerClusterRef.current === clusterGroup) {
        markerClusterRef.current = null;
      }
      sectionMarkersByIdRef.current = new Map();
      activeSectionMarkerIdRef.current = null;
      clusterGroup.clearLayers();
      if (map.hasLayer(clusterGroup)) {
        map.removeLayer(clusterGroup);
      }
    };
  }, [
    createClusterGroup,
    handleOpenDirectionsMenu,
    removeFromResults,
    sectionBurials,
    sectionFilter,
    selectBurial,
    showAllBurials,
    syncActiveSectionMarker,
  ]);

  useEffect(() => {
    activeBurialIdRef.current = activeBurialId;
    syncActiveSectionMarker(activeBurialId);
  }, [activeBurialId, syncActiveSectionMarker]);

  useEffect(() => {
    const pendingBurial = pendingPopupBurialRef.current;
    if (!pendingBurial) return;

    if (openPopupForBurial(pendingBurial)) {
      pendingPopupBurialRef.current = null;
    }
  }, [activeBurialId, openPopupForBurial, selectedBurials, selectedTour]);

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

  useEffect(() => {
    scheduleSectionTooltipSync();

    return () => {
      if (sectionTooltipSyncFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(sectionTooltipSyncFrameRef.current);
        sectionTooltipSyncFrameRef.current = null;
      }
    };
  }, [currentZoom, scheduleSectionTooltipSync, sectionFilter]);

  useEffect(() => {
    if (!window.mapInstance) return undefined;

    const map = window.mapInstance;
    const container = typeof map.getContainer === 'function' ? map.getContainer() : null;
    const handleInterruptedSectionHover = () => {
      clearHoveredSection();
    };

    map.on('movestart', handleInterruptedSectionHover);
    map.on('zoomstart', handleInterruptedSectionHover);
    container?.addEventListener('pointerleave', handleInterruptedSectionHover);
    container?.addEventListener('mouseleave', handleInterruptedSectionHover);
    window.addEventListener('blur', handleInterruptedSectionHover);

    return () => {
      map.off('movestart', handleInterruptedSectionHover);
      map.off('zoomstart', handleInterruptedSectionHover);
      container?.removeEventListener('pointerleave', handleInterruptedSectionHover);
      container?.removeEventListener('mouseleave', handleInterruptedSectionHover);
      window.removeEventListener('blur', handleInterruptedSectionHover);
    };
  }, [clearHoveredSection]);

  const resetMapToDefaultBounds = useCallback(() => {
    if (!window.mapInstance) return;

    window.mapInstance.fitBounds(DEFAULT_VIEW_BOUNDS);
  }, []);

  const focusSectionOnMap = useCallback((sectionValue, bounds) => {
    if (!window.mapInstance || !sectionValue) return;

    const sectionBounds = bounds || sectionBoundsById.get(String(sectionValue));
    if (!isRenderableBounds(sectionBounds)) {
      return;
    }

    window.mapInstance.fitBounds(sectionBounds, {
      padding: [50, 50],
      maxZoom: ZOOM_LEVELS.CLUSTER,
    });
  }, [sectionBoundsById]);

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

    const bounds = tourBoundsByName[tourName];
    if (!isLatLngBoundsExpressionValid(bounds)) return;

    window.mapInstance.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: ZOOM_LEVELS.CLUSTER,
    });
  }, [tourBoundsByName]);

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
  const getSectionStyle = useCallback((feature) => ({
    fillColor: `${feature.properties.Section}` === `${sectionFilter}` ? '#4a90e2' : '#f8f9fa',
    fillOpacity: `${feature.properties.Section}` === `${sectionFilter}` ? 0.4 : 0.05,
    color: `${feature.properties.Section}` === `${sectionFilter}` ? '#2c5282' : '#999',
    weight: `${feature.properties.Section}` === `${sectionFilter}` ? 2 : 1
  }), [sectionFilter]);

  const onEachSectionFeature = useCallback((feature, layer) => {
    if (!feature.properties?.Section) return;

    const sectionValue = feature.properties.Section;
    const tooltip = L.tooltip({
      direction: 'center',
      className: 'section-label'
    });
    const label = `Section ${feature.properties.Section_Di || sectionValue}`;

    sectionFeatureLayersRef.current.set(String(sectionValue), {
      layer,
      tooltip,
      sectionValue,
      label,
    });

    layer.on({
      click: (event) => {
        if (shouldIgnoreSectionBackgroundSelection({
          clickedSection: sectionValue,
          activeSection: sectionFilter,
        })) {
          L.DomEvent.stopPropagation(event);
          return;
        }

        activateSectionBrowse(sectionValue, layer.getBounds());
        L.DomEvent.stopPropagation(event);
      },
      mouseover: () => {
        hoveredSectionIdRef.current = String(sectionValue);
        layer.setStyle({ weight: 6 });
        tooltip.setContent(label);
        if (!layer.getTooltip()) {
          layer.bindTooltip(tooltip);
        }
        layer.openTooltip();
        scheduleSectionTooltipSync();
      },
      mouseout: () => {
        clearHoveredSection();
        layer.setStyle({ weight: `${sectionValue}` === `${sectionFilter}` ? 2 : 1 });
      },
      add: () => {
        if (typeof layer.closeTooltip === 'function') {
          layer.closeTooltip();
        }
        if (layer.getTooltip()) {
          layer.unbindTooltip();
        }
        scheduleSectionTooltipSync();
      },
      remove: () => {
        if (hoveredSectionIdRef.current === String(sectionValue)) {
          hoveredSectionIdRef.current = null;
        }
        if (typeof layer.closeTooltip === 'function') {
          layer.closeTooltip();
        }
        if (layer.getTooltip()) {
          layer.unbindTooltip();
        }
        sectionFeatureLayersRef.current.delete(String(sectionValue));
        scheduleSectionTooltipSync();
      },
    });
  }, [activateSectionBrowse, clearHoveredSection, scheduleSectionTooltipSync, sectionFilter]);

  const ensureTourLayerLoaded = useCallback(async (tourName) => {
    if (!tourName) return;
    if (isBurialDataLoading && burialRecords.length === 0) return;

    const definition = tourDefinitionsByName.get(tourName);
    if (!definition) return;
    if (loadedTourNamesRef.current.has(tourName) || loadingTourNamesRef.current.has(tourName)) return;

    loadingTourNamesRef.current.add(tourName);
    setLoadingTourName(tourName);
    setTourLayerError('');

    try {
      const module = await definition.load();
      const sourceFeatures = module.default.features || [];
      const validFeatures = sourceFeatures.filter((feature) => hasValidGeoJsonCoordinates(feature));
      const sanitizedGeoJson = {
        ...module.default,
        features: validFeatures,
      };

      if (validFeatures.length !== sourceFeatures.length) {
        console.warn(`Skipped ${sourceFeatures.length - validFeatures.length} invalid features while loading "${tourName}".`);
      }

      const normalizedTourResults = validFeatures.map((feature) => (
        resolveTourBrowseResult(
          buildTourBrowseResult(feature, {
            tourKey: definition.key,
            tourName,
          })
        )
      ));
      const tourBounds = getGeoJsonBounds(sanitizedGeoJson);
      const layer = L.geoJSON(sanitizedGeoJson, {
        pointToLayer: createTourMarker(definition.key),
        onEachFeature: createOnEachTourFeature(
          definition.key,
          tourName,
          selectBurial,
          handleOpenDirectionsMenu,
          removeFromResults,
          (browseResult, featureLayer) => {
            tourFeatureLayersRef.current.set(browseResult.id, featureLayer);
          },
          resolveTourBrowseResult
        )
      });

      loadedTourNamesRef.current.add(tourName);
      setTourResultsByName((current) => ({
        ...current,
        [tourName]: normalizedTourResults,
      }));
      setTourBoundsByName((current) => ({
        ...current,
        [tourName]: tourBounds,
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
    handleOpenDirectionsMenu,
    removeFromResults,
    resolveTourBrowseResult,
    isBurialDataLoading,
    burialRecords.length,
    selectBurial,
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
        sections: L.geoJSON(ARC_Sections, { onEachFeature: onEachSectionFeature })
      };

      setOverlayMaps({
        "Albany Rural Cemetery Boundary": baseLayers.boundary,
        "Albany Rural Cemetery Roads": baseLayers.roads,
        "Section Boundaries": baseLayers.sections
      });
    } catch (error) {
      console.error('Error loading base GeoJSON data:', error);
    }
  }, [onEachSectionFeature]);

  /**
   * Load the selected tour layer on demand.
   */
  useEffect(() => {
    if (!selectedTour) return;
    void ensureTourLayerLoaded(selectedTour);
  }, [selectedTour, ensureTourLayerLoaded]);

  useEffect(() => {
    if (!selectedTour || !selectedTourLayer || !selectedTourBounds) return;
    focusTourOnMap(selectedTour);
  }, [focusTourOnMap, selectedTour, selectedTourBounds, selectedTourLayer]);

  /**
   * Prefetch tour layers in idle time to reduce switching latency.
   */
  useEffect(() => {
    if (!canIdlePrefetchTours) return undefined;

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
  }, [canIdlePrefetchTours, ensureTourLayerLoaded, tourNames]);

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
        {isDev && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              handleTogglePmtilesExperiment();
            }}
          >
            {isPmtilesEnabled ? 'Disable PMTiles experiment' : 'Enable PMTiles experiment'}
          </MenuItem>
        )}
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
        {directionsMenuBurial
          ? [
              <MenuItem
                key="route"
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
              </MenuItem>,
              <MenuItem
                key="external"
                onClick={() => {
                  const burial = directionsMenuBurial;
                  handleCloseDirectionsMenu();
                  openExternalDirections(burial);
                }}
              >
                <LaunchIcon fontSize="small" sx={{ mr: 1 }} />
                Open in Maps
              </MenuItem>,
            ]
          : null}
      </Menu>

      <MapContainer
        center={[42.704180, -73.731980]}
        zoom={14}
        className="map"
        attributionControl={false}
        zoomControl={false}
        maxZoom={25}
        preferCanvas
      >
        <CustomZoomControl isMobile={isMobile} />
        {isDev && isPmtilesEnabled && (
          <ExperimentalVectorBurialLayer
            burialRecordsByObjectId={burialRecordsByObjectId}
            onSelectBurial={selectBurial}
          />
        )}
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
                style={getSectionStyle}
                onEachFeature={onEachSectionFeature}
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
              ref={(layer) => {
                if (layer) {
                  selectedMarkerLayersRef.current.set(burial.id, layer);
                } else {
                  selectedMarkerLayersRef.current.delete(burial.id);
                }
              }}
              position={[burial.coordinates[1], burial.coordinates[0]]}
              icon={createNumberedIcon(
                index + 1,
                hoveredIndex === index || activeBurialId === burial.id
              )}
              eventHandlers={{
                mouseover: () => setHoveredIndex(index),
                mouseout: () => setHoveredIndex(null),
                click: () => handleMarkerClick(burial),
                popupopen: ({ popup }) => {
                  scheduleLeafletPopupInView(popup);
                },
              }}
              zIndexOffset={1000}
            >
              {burial.source !== "tour" && (
                <Popup>
                  <PopupCardContent
                    record={burial}
                    onOpenDirectionsMenu={(event) => handleOpenDirectionsMenu(event, burial)}
                    onRemove={() => {
                      removeFromResults(burial.id);
                    }}
                    getPopup={() => selectedMarkerLayersRef.current.get(burial.id)?.getPopup?.()}
                  />
                </Popup>
              )}
            </Marker>
          ))}
        </LayersControl>
      </MapContainer>
    </div>
  );
}
