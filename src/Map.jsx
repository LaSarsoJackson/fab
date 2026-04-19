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
import React, { memo, useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

// Leaflet and Map-related Dependencies
import { MapContainer, Popup, Marker, GeoJSON, CircleMarker, Tooltip, ImageOverlay, useMap } from "react-leaflet";
import L from 'leaflet';  // Core Leaflet library for map functionality
import "./index.css";
import 'leaflet.markercluster/dist/leaflet.markercluster';  // Clustering support for markers
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { BasemapLayer } from 'react-esri-leaflet';  // ESRI basemap integration
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

// Material-UI Components and Icons
import {
  Paper,
  IconButton,
  Box,
  Slider,
  Switch,
  Typography,
  Menu,
  MenuItem,
  ClickAwayListener,
  Divider,
  useMediaQuery,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import HomeIcon from '@mui/icons-material/Home';
import LayersIcon from "@mui/icons-material/Layers";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import RemoveIcon from "@mui/icons-material/Remove";
import TuneIcon from "@mui/icons-material/Tune";
import DirectionsIcon from '@mui/icons-material/Directions';
import LaunchIcon from '@mui/icons-material/Launch';

// Local Data and Styles
import { APP_PROFILE } from "./config/appProfile";
import BurialSidebar from "./BurialSidebar";
import {
  buildBurialSectionIndex,
  buildBurialBrowseResult,
  buildSearchIndex,
  buildTourBrowseResult,
  filterBurialRecordsBySection,
  formatBrowseResultName,
  smartSearch,
  sortSectionValues,
} from "./features/browse";
import {
  buildRoadRoutingGraph,
  clearSelectionFocus,
  createMapRecordKey,
  createMapSelectionState,
  buildSectionBoundsById,
  buildSectionOverviewMarkers,
  beginLeafletSectionHover,
  calculateWalkingRoute,
  clearLeafletSectionHover,
  cleanRecordValue,
  ExperimentalBurialGlyphSymbolizer,
  focusSelectionBurial,
  formatSectionOverviewMarkerLabel,
  getEmptyCoreMapData,
  getRoutingErrorMessage,
  hasIndexedBurialPlacement,
  inferPointerType,
  isLeafletSectionLayerHovered,
  isTouchLikePointerType,
  loadCoreMapData,
  PMTILES_EXPERIMENT_GLYPH_PALETTE,
  PopupCardContent,
  refreshSelectionBurials,
  removeSelectionBurial,
  replaceSelectionBurials,
  resolveSectionOverlayVisibility,
  setSelectionHover,
  snapPointToRoadNetwork,
  shouldHandleSectionHover,
  shouldIgnoreSectionBackgroundSelection,
} from "./features/map";
import { CustomMapSurface } from "./features/map/engine/CustomMapSurface";
import { createLeafletMapRuntime } from "./features/map/engine";
import {
  fitBoundsInVisibleViewport,
  panIntoVisibleViewport,
  schedulePopupInView,
} from "./features/map/leafletViewport";
import { buildDirectionsLink } from "./features/navigation";
import {
  buildFieldPacketShareUrl,
  buildFieldPacketState,
  buildSharedSelectionPresentation,
  parseDeepLinkState,
} from "./features/deeplinks";
import {
  buildBurialLookup,
  harmonizeBurialBrowseResult,
  harmonizeTourBrowseResult,
  TOUR_DEFINITIONS,
  TOUR_STYLES,
} from "./features/tours";
import { getGeoJsonBounds, hasValidGeoJsonCoordinates, isLatLngBoundsExpressionValid } from "./shared/geo";
import {
  cancelIdleTask,
  buildPublicAssetUrl,
  getRuntimeEnv,
  scheduleIdleTask,
  setStoredCustomMapEngineOverride,
  syncDocumentMetadata,
} from "./shared/runtime";
import {
  DEFAULT_SITE_TWIN_DEBUG_STATE,
  EMPTY_SITE_TWIN_MANIFEST,
  filterSiteTwinFeatureCollection,
  isSiteTwinReady,
  normalizeSiteTwinDebugState,
  normalizeSiteTwinFeatureCollection,
  normalizeSiteTwinManifest,
  shouldLoadSiteTwinCandidates,
  summarizeSiteTwinFeatureCollection,
} from "./features/map/siteTwin";

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

const ROUTE_LINE_STYLE = {
  color: "#0f67c6",
  weight: 5,
  opacity: 0.86,
};

const DESKTOP_MAP_CONTROL_RIGHT = '12px';
const DESKTOP_MAP_CONTROL_TOP = '12px';
const MOBILE_MAP_CONTROL_RIGHT = 'calc(env(safe-area-inset-right, 0px) + 12px)';
const MOBILE_MAP_CONTROL_TOP = 'calc(env(safe-area-inset-top, 0px) + 10px)';
const MAP_CONTROL_BUTTON_SIZE = 44;
const APP_SHELL = APP_PROFILE.shell || {};
const APP_DOCUMENT_TITLE = APP_SHELL.documentTitle || APP_PROFILE.brand?.appName || "Burial Finder";
const APP_DESCRIPTION = APP_SHELL.description || "";
const IOS_APP_STORE_URL = APP_PROFILE.distribution?.iosAppStoreUrl || "";
const DEFAULT_VIEW_BOUNDS = APP_PROFILE.map.defaultViewBounds;
const PADDED_BOUNDARY_BOUNDS = APP_PROFILE.map.paddedBoundaryBounds;
const MAP_CENTER = APP_PROFILE.map.center;
const MAP_ZOOM = APP_PROFILE.map.zoom;
const LOCATION_BUFFER_BOUNDARY = APP_PROFILE.map.locationBufferBoundary;
const LOCATION_MESSAGES = APP_PROFILE.map.locationMessages;
const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g', '3g']);
const NUMBERED_ICON_CACHE = new Map();
const PMTILES_EXPERIMENT_STORAGE_KEY = APP_PROFILE.map.pmtilesExperimentStorageKey;
const SECTION_MARKER_BATCH_SIZE = 300;
const SECTION_OVERVIEW_MARKER_MIN_ZOOM = 15;
const SEARCH_INDEX_PUBLIC_PATH = APP_PROFILE.artifacts.searchIndexPublicPath;
const EMPTY_TOUR_DEFINITIONS = [];
const EMPTY_TOUR_STYLES = {};
const EMPTY_TOUR_RESULTS = [];
const BASEMAP_KEEP_BUFFER = 1;
const MAP_BASEMAPS = APP_PROFILE.map.basemaps || [];
const MAP_CONTROLLED_BASEMAPS = MAP_BASEMAPS.filter((basemap) => basemap.type !== "pmtiles-vector");
const DEFAULT_BASEMAP_ID = APP_PROFILE.map.defaultBasemapId || MAP_BASEMAPS[0]?.id || "";
const SITE_TWIN_CONFIG = APP_PROFILE.map.siteTwin || null;
const SITE_TWIN_DEBUG_STORAGE_KEY = "fab:siteTwinDebugState";
const MAP_OVERLAY_OPTIONS = [
  { id: "roads", label: "Roads", defaultVisible: false },
  { id: "boundary", label: "Boundary", defaultVisible: true },
  { id: "sections", label: "Sections", defaultVisible: true },
  ...(SITE_TWIN_CONFIG ? [{
    id: "siteTwin",
    label: "Twin",
    defaultVisible: Boolean(SITE_TWIN_CONFIG.defaultVisible),
  }] : []),
];
const DEFAULT_MAP_OVERLAY_VISIBILITY = MAP_OVERLAY_OPTIONS.reduce((visibility, option) => ({
  ...visibility,
  [option.id]: option.defaultVisible,
}), {});

const getDefaultSiteTwinDebugState = () => normalizeSiteTwinDebugState(DEFAULT_SITE_TWIN_DEBUG_STATE);

const mapControlShellSx = {
  borderRadius: '18px',
  border: '1px solid rgba(18, 47, 40, 0.12)',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 252, 0.9))',
  boxShadow: '0 18px 36px rgba(16, 35, 31, 0.16)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  overflow: 'hidden',
};

const mapControlButtonSx = {
  width: MAP_CONTROL_BUTTON_SIZE,
  height: MAP_CONTROL_BUTTON_SIZE,
  borderRadius: 0,
  color: 'var(--text-main)',
};

const mapControlOptionButtonSx = {
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr)",
  alignItems: "center",
  columnGap: "10px",
  width: "100%",
  border: 0,
  borderRadius: "10px",
  padding: "8px 6px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
  transition: "background-color 0.16s ease",
  "&:hover": {
    backgroundColor: "rgba(18, 47, 40, 0.06)",
  },
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
 * Stack top-right controls together so expanding panels push the rest down.
 */
function MapControlStack({ isMobile, hasExpandedPanel = false, children }) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <Box
      sx={{
        position: "absolute",
        top: isMobile ? MOBILE_MAP_CONTROL_TOP : DESKTOP_MAP_CONTROL_TOP,
        right: isMobile ? MOBILE_MAP_CONTROL_RIGHT : DESKTOP_MAP_CONTROL_RIGHT,
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        alignItems: hasExpandedPanel ? "stretch" : "flex-end",
        width: "max-content",
        pointerEvents: "none",
      }}
    >
      {items.map((child, index) => (
        <Box
          key={index}
          sx={{
            pointerEvents: "auto",
            width: hasExpandedPanel ? "100%" : "auto",
            display: "flex",
            justifyContent: hasExpandedPanel ? "flex-start" : "flex-end",
          }}
        >
          {child}
        </Box>
      ))}
    </Box>
  );
}

function MapLayerControlOption({
  active,
  label,
  onClick,
  icon: Icon,
  inactiveIcon: InactiveIcon,
}) {
  const VisibleIcon = active ? Icon : InactiveIcon;

  return (
    <Box component="button" type="button" onClick={onClick} sx={mapControlOptionButtonSx}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: active ? "var(--text-main)" : "rgba(24, 45, 40, 0.6)",
        }}
      >
        <VisibleIcon fontSize="small" />
      </Box>
      <Typography
        sx={{
          fontSize: "0.88rem",
          fontWeight: active ? 700 : 600,
          color: "var(--text-main)",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

/**
 * Shared layer panel used by both Leaflet and the custom map runtime.
 */
function MapLayerControl({
  basemapOptions,
  activeBasemapId,
  isOpen,
  onBasemapChange,
  onOpenChange,
  overlayOptions,
  overlayVisibility,
  onToggleOverlay,
}) {
  return (
    <ClickAwayListener onClickAway={() => onOpenChange(false)}>
      <Paper
        elevation={0}
        sx={{
          ...mapControlShellSx,
          width: isOpen ? "min(260px, calc(100vw - 24px))" : MAP_CONTROL_BUTTON_SIZE,
          maxWidth: "calc(100vw - 24px)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isOpen
              ? `${MAP_CONTROL_BUTTON_SIZE}px minmax(0, 1fr)`
              : `${MAP_CONTROL_BUTTON_SIZE}px`,
            alignItems: "center",
          }}
        >
          <IconButton
            onClick={() => onOpenChange(!isOpen)}
            size="small"
            title={isOpen ? "Close map layers" : "Open map layers"}
            aria-label={isOpen ? "Close map layers" : "Open map layers"}
            aria-expanded={isOpen}
            sx={mapControlButtonSx}
          >
            <LayersIcon fontSize="small" />
          </IconButton>
          {isOpen && (
            <Typography
              sx={{
                paddingRight: "14px",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "rgba(24, 45, 40, 0.72)",
              }}
            >
              Map layers
            </Typography>
          )}
        </Box>

        {isOpen && (
          <Box
            sx={{
              display: "grid",
              gap: "12px",
              padding: "10px 12px 12px",
              borderTop: "1px solid rgba(18, 47, 40, 0.12)",
            }}
          >
            <Box sx={{ display: "grid", gap: "4px" }}>
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "rgba(24, 45, 40, 0.72)",
                }}
              >
                Basemap
              </Typography>
              {basemapOptions.map((option) => (
                <MapLayerControlOption
                  key={option.id}
                  active={activeBasemapId === option.id}
                  label={option.label}
                  onClick={() => onBasemapChange(option.id)}
                  icon={RadioButtonCheckedIcon}
                  inactiveIcon={RadioButtonUncheckedIcon}
                />
              ))}
            </Box>

            <Divider sx={{ borderColor: "rgba(18, 47, 40, 0.12)" }} />

            <Box sx={{ display: "grid", gap: "4px" }}>
              <Typography
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "rgba(24, 45, 40, 0.72)",
                }}
              >
                Overlays
              </Typography>
              {overlayOptions.map((option) => (
                <MapLayerControlOption
                  key={option.id}
                  active={overlayVisibility[option.id] !== false}
                  label={option.label}
                  onClick={() => onToggleOverlay(option.id)}
                  icon={CheckBoxIcon}
                  inactiveIcon={CheckBoxOutlineBlankIcon}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>
    </ClickAwayListener>
  );
}

/**
 * Shared zoom controls work in both runtimes.
 */
function MapZoomControl({ isMobile, onZoomIn, onZoomOut }) {
  if (isMobile) {
    return null;
  }

  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <Box sx={{ display: "grid" }}>
        <IconButton
          onClick={onZoomIn}
          size="small"
          sx={mapControlButtonSx}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <AddIcon fontSize="small" />
        </IconButton>
        <Box sx={{ height: 1, backgroundColor: "rgba(18, 47, 40, 0.1)" }} />
        <IconButton
          onClick={onZoomOut}
          size="small"
          sx={mapControlButtonSx}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

function CustomZoomControl({ isMobile }) {
  const map = useMap();

  return (
    <MapZoomControl
      isMobile={isMobile}
      onZoomIn={() => map.zoomIn()}
      onZoomOut={() => map.zoomOut()}
    />
  );
}

/**
 * Component that restricts map bounds and zoom levels to the cemetery area
 * Uses Turf.js for geospatial calculations
 */
function MapBounds({ fitMapBounds }) {
  const map = useMap();

  useEffect(() => {
    // Set map constraints
    map.setMaxBounds(PADDED_BOUNDARY_BOUNDS);
    map.setMinZoom(13);
    map.setMaxZoom(25);

    // Initial fit to bounds
    map.whenReady(() => {
      fitMapBounds(map, PADDED_BOUNDARY_BOUNDS);
    });
  }, [fitMapBounds, map]);

  return null;
}

/**
 * Component that renders the ESRI vector basemap
 */
function VectorBasemap({ name }) {
  return (
    <BasemapLayer
      name={name}
      maxZoom={25}
      maxNativeZoom={19}
      keepBuffer={BASEMAP_KEEP_BUFFER}
      updateWhenIdle
      updateWhenZooming={false}
    />
  );
}

function ActiveLeafletBasemap({ basemap }) {
  if (!basemap) {
    return null;
  }

  return <VectorBasemap name={basemap.id === "streets" ? "Streets" : "ImageryClarity"} />;
}

/**
 * Component that manages map state and provides access to the map instance
 */
function MapController({ mapRef }) {
  const leafletMap = useMap();

  useEffect(() => {
    const runtime = createLeafletMapRuntime(leafletMap);
    mapRef.current = runtime;

    return () => {
      if (mapRef.current === runtime) {
        mapRef.current = null;
      }
    };
  }, [leafletMap, mapRef]);

  return null;
}

/**
 * Optional PMTiles experiment for validating vector rendering in development.
 * This stays off the main path so Leaflet clustering remains the default UX,
 * but uses differentiated translucent glyphs so overlapping burials can still
 * be read individually.
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
          url: buildPublicAssetUrl("/data/geo_burials.pmtiles"),
          pane: "overlayPane",
          paintRules: [
            {
              dataLayer: "burials",
              symbolizer: new ExperimentalBurialGlyphSymbolizer("approximate"),
              filter: (_zoom, feature) => !hasIndexedBurialPlacement(feature?.props),
            },
            {
              dataLayer: "burials",
              symbolizer: new ExperimentalBurialGlyphSymbolizer("indexed"),
              filter: (_zoom, feature) => hasIndexedBurialPlacement(feature?.props),
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

function PmtilesExperimentLegend() {
  return (
    <Paper
      elevation={0}
      sx={{
        ...mapControlShellSx,
        width: 228,
        maxWidth: "calc(100vw - 24px)",
        padding: "12px 14px",
        pointerEvents: "none",
        borderRadius: "18px",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "rgba(24, 45, 40, 0.72)",
        }}
      >
        PMTiles Experiment
      </Typography>
      <Typography
        sx={{
          marginTop: "4px",
          fontSize: "0.88rem",
          fontWeight: 600,
          color: "var(--text-main)",
        }}
      >
        Dev grave glyphs
      </Typography>
      <Box sx={{ display: "grid", gap: "10px", marginTop: "10px" }}>
        {Object.entries(PMTILES_EXPERIMENT_GLYPH_PALETTE).map(([variant, definition]) => (
          <Box
            key={variant}
            sx={{
              display: "grid",
              gridTemplateColumns: "18px minmax(0, 1fr)",
              columnGap: "10px",
              alignItems: "start",
            }}
          >
            <Box sx={{ position: "relative", width: 18, height: 18, marginTop: "2px" }}>
              <Box
                sx={{
                  position: "absolute",
                  left: 1,
                  top: 8,
                  width: 8,
                  height: 1,
                  backgroundColor: definition.guide,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  right: 1,
                  top: 3,
                  width: 12,
                  height: 12,
                  borderRadius: variant === "approximate" ? "999px" : "2px",
                  border: `1.2px solid ${definition.stroke}`,
                  backgroundColor: definition.fill,
                  transform: variant === "indexed" ? "rotate(45deg)" : "none",
                }}
              />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: "var(--text-main)",
                }}
              >
                {definition.label}
              </Typography>
              <Typography
                sx={{
                  marginTop: "2px",
                  fontSize: "0.7rem",
                  lineHeight: 1.35,
                  color: "rgba(24, 45, 40, 0.72)",
                }}
              >
                {definition.detail}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Typography
        sx={{
          marginTop: "10px",
          fontSize: "0.68rem",
          lineHeight: 1.4,
          color: "rgba(24, 45, 40, 0.64)",
        }}
      >
        Small offsets separate stacked records without claiming an exact grave footprint.
      </Typography>
    </Paper>
  );
}

function SiteTwinDebugToggleRow({ checked, disabled = false, label, onChange, detail }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "10px",
        alignItems: "center",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.78rem",
            fontWeight: 600,
            lineHeight: 1.25,
            color: "var(--text-main)",
          }}
        >
          {label}
        </Typography>
        {detail ? (
          <Typography
            sx={{
              marginTop: "2px",
              fontSize: "0.68rem",
              lineHeight: 1.35,
              color: "rgba(24, 45, 40, 0.64)",
            }}
          >
            {detail}
          </Typography>
        ) : null}
      </Box>
      <Switch checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} size="small" />
    </Box>
  );
}

function SiteTwinDebugSlider({ label, detail, value, min, max, step, onChange, formatValue }) {
  return (
    <Box sx={{ display: "grid", gap: "6px" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: "10px",
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 600,
              lineHeight: 1.25,
              color: "var(--text-main)",
            }}
          >
            {label}
          </Typography>
          {detail ? (
            <Typography
              sx={{
                marginTop: "2px",
                fontSize: "0.68rem",
                lineHeight: 1.35,
                color: "rgba(24, 45, 40, 0.64)",
              }}
            >
              {detail}
            </Typography>
          ) : null}
        </Box>
        <Typography
          sx={{
            fontSize: "0.72rem",
            fontWeight: 700,
            lineHeight: 1.4,
            color: "rgba(24, 45, 40, 0.72)",
          }}
        >
          {formatValue(value)}
        </Typography>
      </Box>
      <Slider
        size="small"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(_event, nextValue) => onChange(Array.isArray(nextValue) ? nextValue[0] : nextValue)}
        sx={{
          color: "var(--text-main)",
          py: 0,
          '& .MuiSlider-thumb': {
            width: 12,
            height: 12,
          },
        }}
      />
    </Box>
  );
}

function SiteTwinDebugControl({
  isOverlayEnabled,
  mapEngine,
  manifest,
  loadedSummary = {},
  filteredSummary = {},
  debugState = DEFAULT_SITE_TWIN_DEBUG_STATE,
  onToggleOverlay,
  onUpdateDebugState,
  onResetDebugState,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const totalCount = loadedSummary?.count || manifest?.graveCandidates?.count || 0;
  const knownHeadstoneCount = loadedSummary?.knownHeadstoneCount || manifest?.graveCandidates?.knownHeadstoneCount || 0;
  const filteredCount = Number(filteredSummary?.count) || 0;
  const filteredHeightP95Meters = Number(filteredSummary?.heightP95Meters) || 0;
  const filteredMeanConfidence = Number(filteredSummary?.meanConfidence) || 0;
  const renderMode = manifest?.mode || manifest?.status || "unbuilt";

  return (
    <ClickAwayListener onClickAway={() => setIsOpen(false)}>
      <Paper
        elevation={0}
        sx={{
          ...mapControlShellSx,
          width: isOpen ? "min(300px, calc(100vw - 24px))" : MAP_CONTROL_BUTTON_SIZE,
          maxWidth: "calc(100vw - 24px)",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isOpen
              ? `${MAP_CONTROL_BUTTON_SIZE}px minmax(0, 1fr)`
              : `${MAP_CONTROL_BUTTON_SIZE}px`,
            alignItems: "center",
          }}
        >
          <IconButton
            onClick={() => setIsOpen((current) => !current)}
            size="small"
            title={isOpen ? "Close site twin debug panel" : "Open site twin debug panel"}
            aria-label={isOpen ? "Close site twin debug panel" : "Open site twin debug panel"}
            aria-expanded={isOpen}
            sx={mapControlButtonSx}
          >
            <TuneIcon fontSize="small" />
          </IconButton>
          {isOpen && (
            <Typography
              sx={{
                paddingRight: "14px",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "rgba(24, 45, 40, 0.72)",
              }}
            >
              Site Twin
            </Typography>
          )}
        </Box>

        {isOpen && (
          <Box
            sx={{
              display: "grid",
              gap: "12px",
              padding: "10px 12px 12px",
              borderTop: "1px solid rgba(18, 47, 40, 0.12)",
            }}
          >
            <Box sx={{ display: "grid", gap: "2px" }}>
              <Typography
                sx={{
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "var(--text-main)",
                }}
              >
                {renderMode === "terrain-only" ? "Terrain-only prototype" : "Ortho-relief package"}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  lineHeight: 1.45,
                  color: "rgba(24, 45, 40, 0.64)",
                }}
              >
                {manifest?.sourceVintageNote || "Static site-twin assets not loaded yet."}
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              <Box sx={{ padding: "8px 10px", borderRadius: "14px", backgroundColor: "rgba(24, 45, 40, 0.06)" }}>
                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(24, 45, 40, 0.64)" }}>
                  Candidates
                </Typography>
                <Typography sx={{ marginTop: "2px", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {filteredCount.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", color: "rgba(24, 45, 40, 0.64)" }}>
                  of {totalCount.toLocaleString()} loaded
                </Typography>
              </Box>
              <Box sx={{ padding: "8px 10px", borderRadius: "14px", backgroundColor: "rgba(24, 45, 40, 0.06)" }}>
                <Typography sx={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(24, 45, 40, 0.64)" }}>
                  Headstones
                </Typography>
                <Typography sx={{ marginTop: "2px", fontSize: "0.92rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {knownHeadstoneCount.toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: "0.68rem", color: "rgba(24, 45, 40, 0.64)" }}>
                  p95 height {filteredHeightP95Meters.toFixed(2)} m
                </Typography>
              </Box>
            </Box>

            <SiteTwinDebugToggleRow
              checked={isOverlayEnabled}
              label="Twin overlay"
              detail="Master toggle for the terrain surface and monument pass."
              onChange={onToggleOverlay}
            />
            <SiteTwinDebugToggleRow
              checked={debugState.showSurface}
              label="Terrain surface"
              detail="Shows the static PNG ground plane."
              onChange={(checked) => onUpdateDebugState({ showSurface: checked })}
            />
            <SiteTwinDebugToggleRow
              checked={debugState.showMonuments}
              label="Monument extrusions"
              detail={mapEngine === "custom"
                ? "Renders clustered grave/marker candidates in the custom renderer."
                : "Custom renderer only. Switch renderer in the app menu to inspect extrusions."}
              onChange={(checked) => onUpdateDebugState({ showMonuments: checked })}
            />
            <SiteTwinDebugToggleRow
              checked={debugState.knownHeadstonesOnly}
              label="Known headstones only"
              detail="Filters out burial-anchor estimates and keeps surveyed headstone anchors."
              onChange={(checked) => onUpdateDebugState({ knownHeadstonesOnly: checked })}
            />

            <Divider sx={{ borderColor: "rgba(18, 47, 40, 0.12)" }} />

            <SiteTwinDebugSlider
              label="Terrain opacity"
              detail="Overrides the overlay alpha without changing the static package."
              value={debugState.surfaceOpacity}
              min={0.1}
              max={1}
              step={0.01}
              onChange={(value) => onUpdateDebugState({ surfaceOpacity: value })}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
            <SiteTwinDebugSlider
              label="Monument height scale"
              detail="Exaggerates or flattens the pseudo-3D monument pass."
              value={debugState.monumentHeightScale}
              min={0.5}
              max={3}
              step={0.05}
              onChange={(value) => onUpdateDebugState({ monumentHeightScale: value })}
              formatValue={(value) => `${value.toFixed(2)}x`}
            />
            <SiteTwinDebugSlider
              label="Minimum confidence"
              detail="Keeps only candidates above this confidence threshold."
              value={debugState.minConfidence}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => onUpdateDebugState({ minConfidence: value })}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
            <SiteTwinDebugSlider
              label="Minimum height"
              detail="Drops low-relief candidates that do not clear the threshold."
              value={debugState.minHeightMeters}
              min={0}
              max={2}
              step={0.02}
              onChange={(value) => onUpdateDebugState({ minHeightMeters: value })}
              formatValue={(value) => `${value.toFixed(2)} m`}
            />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.68rem",
                  lineHeight: 1.45,
                  color: "rgba(24, 45, 40, 0.64)",
                }}
              >
                Mean confidence {filteredMeanConfidence.toFixed(2)}
              </Typography>
              <Box
                component="button"
                type="button"
                onClick={onResetDebugState}
                sx={{
                  border: "1px solid rgba(18, 47, 40, 0.12)",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  color: "var(--text-main)",
                  borderRadius: "999px",
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reset
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </ClickAwayListener>
  );
}

/**
 * Shared home control works in both runtimes.
 */
function MapHomeButton({ onClick }) {
  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <IconButton
        onClick={onClick}
        size="small"
        title="Return to Default Extent"
        aria-label="Return to default extent"
        sx={mapControlButtonSx}
      >
        <HomeIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

/**
 * Button component that resets the map view to the default extent
 */
function DefaultExtentButton({ fitMapBounds }) {
  const map = useMap();

  return (
    <MapHomeButton onClick={() => fitMapBounds(map, DEFAULT_VIEW_BOUNDS)} />
  );
}

function MobileLocateButton({ isMobile, onLocate }) {
  if (!isMobile) {
    return null;
  }

  return (
    <Paper elevation={0} sx={mapControlShellSx}>
      <IconButton
        onClick={() => {
          void onLocate?.();
        }}
        size="small"
        title="Use my location"
        aria-label="Use my location"
        sx={mapControlButtonSx}
      >
        <MyLocationIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}

/**
 * Component that manages routing between two points
 */
function RouteStatusOverlay({ isCalculating, routingError }) {
  if (!isCalculating && !routingError) {
    return null;
  }

  const isError = Boolean(routingError);

  return (
    <Paper
      elevation={0}
      sx={{
        position: "absolute",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        px: 1.6,
        py: 1.1,
        borderRadius: "18px",
        border: isError
          ? "1px solid rgba(170, 52, 48, 0.18)"
          : "1px solid rgba(20, 33, 43, 0.08)",
        backgroundColor: isError
          ? "rgba(167, 46, 42, 0.96)"
          : "rgba(255, 255, 255, 0.96)",
        color: isError ? "#ffffff" : "var(--text-main)",
        boxShadow: "0 18px 36px rgba(20, 33, 43, 0.18)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <Typography variant="body2" sx={{ color: "inherit", fontWeight: 600 }}>
        {isError ? routingError : "Calculating route..."}
      </Typography>
    </Paper>
  );
}

//=============================================================================
// Helper Functions
//=============================================================================

/**
 * Creates a numbered marker icon for search results.
 * The icon shell stays stable so hover/active states can be toggled with CSS
 * instead of replacing the DOM node under the pointer.
 *
 * @param {number} number - The number to display in the marker
 * @returns {L.DivIcon} A Leaflet div icon configured with the specified number
 */
const createNumberedIcon = (number) => {
  const cacheKey = String(number);
  const cachedIcon = NUMBERED_ICON_CACHE.get(cacheKey);
  if (cachedIcon) {
    return cachedIcon;
  }

  const colorIndex = (number - 1) % MARKER_COLORS.length;
  const color = MARKER_COLORS[colorIndex];

  const icon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div
        class="custom-div-icon__badge"
        data-marker-number="${number}"
        style="--marker-color: ${color};"
      >
        ${number}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
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
  return createMapRecordKey(burial, index);
};

/**
 * Creates a marker for a tour point
 * @param {string} tourKey - The key identifying the tour
 * @returns {Function} A function that creates a Leaflet marker or circle marker
 */
const createTourMarker = (tourKey, tourStyles) => {
  const tourInfo = tourStyles[tourKey] || null;
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

const bindReactPopup = ({
  layer,
  record,
  onOpenDirectionsMenu,
  onPopupClose,
  onPopupOpen,
  onRemove,
  schedulePopupLayout,
  shouldRenderPopup = () => true,
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
          schedulePopupLayout={schedulePopupLayout}
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
    if (!shouldRenderPopup()) {
      layer.closePopup();
      return;
    }

    onPopupOpen?.(record);
    renderPopup();
    schedulePopupLayout(popup);
  });
  layer.on("popupclose", () => {
    onPopupClose?.(record);
    unmountPopup();
  });
  layer.on("remove", unmountPopup);
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

const getSectionOverviewMarkerRadius = (count = 0) => {
  if (count >= 2000) return 9;
  if (count >= 1000) return 8;
  if (count >= 300) return 7;
  return 6;
};

const MapSectionOverviewMarkers = memo(function MapSectionOverviewMarkers({
  markers,
  onSelectSection,
}) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.lat, marker.lng]}
          radius={getSectionOverviewMarkerRadius(marker.count)}
          pathOptions={{
            color: "rgba(29, 63, 54, 0.42)",
            weight: 1.5,
            fillColor: "rgba(255, 255, 255, 0.96)",
            fillOpacity: 0.92,
          }}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            {formatSectionOverviewMarkerLabel(marker)}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
});

/**
 * Keep the basemap and static overlays off the render path for selection/menu state.
 */
const MapStaticLayers = memo(function MapStaticLayers({
  activeBasemap,
  boundaryData,
  burialRecordsByObjectId,
  fitMapBoundsInViewport,
  getSectionStyle,
  isDev,
  isLayerControlOpen,
  isMobile,
  isPmtilesEnabled,
  mapRef,
  mapEngine,
  onBasemapChange,
  onEachSectionFeature,
  onLayerControlOpenChange,
  onLocateMarker,
  onResetSiteTwinDebugState,
  onSelectSection,
  onToggleOverlay,
  onSelectBurial,
  onUpdateSiteTwinDebugState,
  overlayVisibility,
  overlayMaps,
  roadsData,
  sectionsData,
  siteTwinDebugState,
  siteTwinFilteredSummary,
  siteTwinLoadedSummary,
  siteTwinManifest,
  showSiteTwinSurface,
  siteTwinSurfaceOpacity,
  sectionOverviewMarkers,
  selectedTour,
  showSections,
  showSectionOverviewMarkers,
  tourNames,
}) {
  return (
    <>
      <MapControlStack isMobile={isMobile} hasExpandedPanel={isLayerControlOpen}>
        <MapLayerControl
          basemapOptions={MAP_CONTROLLED_BASEMAPS}
          activeBasemapId={activeBasemap?.id || ""}
          isOpen={isLayerControlOpen}
          onBasemapChange={onBasemapChange}
          onOpenChange={onLayerControlOpenChange}
          overlayOptions={MAP_OVERLAY_OPTIONS}
          overlayVisibility={overlayVisibility}
          onToggleOverlay={onToggleOverlay}
        />
        <DefaultExtentButton fitMapBounds={fitMapBoundsInViewport} />
        <CustomZoomControl isMobile={isMobile} />
        <MobileLocateButton isMobile={isMobile} onLocate={onLocateMarker} />
        {isDev && isPmtilesEnabled && <PmtilesExperimentLegend />}
        {isDev && SITE_TWIN_CONFIG && (
          <SiteTwinDebugControl
            isOverlayEnabled={overlayVisibility.siteTwin !== false}
            mapEngine={mapEngine}
            manifest={siteTwinManifest}
            loadedSummary={siteTwinLoadedSummary}
            filteredSummary={siteTwinFilteredSummary}
            debugState={siteTwinDebugState}
            onToggleOverlay={(checked) => {
              if (checked !== (overlayVisibility.siteTwin !== false)) {
                onToggleOverlay("siteTwin");
              }
            }}
            onUpdateDebugState={onUpdateSiteTwinDebugState}
            onResetDebugState={onResetSiteTwinDebugState}
          />
        )}
      </MapControlStack>
      <ActiveLeafletBasemap basemap={activeBasemap} />
      {isDev && isPmtilesEnabled && (
        <ExperimentalVectorBurialLayer
          burialRecordsByObjectId={burialRecordsByObjectId}
          onSelectBurial={onSelectBurial}
        />
      )}
      <MapBounds fitMapBounds={fitMapBoundsInViewport} />
      <MapController mapRef={mapRef} />
      <MapTourController selectedTour={selectedTour} overlayMaps={overlayMaps} tourNames={tourNames} />
      {overlayVisibility.siteTwin && showSiteTwinSurface && isSiteTwinReady(siteTwinManifest) && (
        <ImageOverlay
          url={siteTwinManifest.terrainImage.url}
          bounds={siteTwinManifest.terrainImage.bounds}
          opacity={siteTwinSurfaceOpacity}
          interactive={false}
        />
      )}
      {overlayVisibility.roads && <GeoJSON data={roadsData} style={roadStyle} />}
      {overlayVisibility.boundary && <GeoJSON data={boundaryData} style={exteriorStyle} />}
      {showSections && (
        <GeoJSON
          data={sectionsData}
          style={getSectionStyle}
          onEachFeature={onEachSectionFeature}
        />
      )}
      {showSectionOverviewMarkers && (
        <MapSectionOverviewMarkers
          markers={sectionOverviewMarkers}
          onSelectSection={onSelectSection}
        />
      )}
    </>
  );
});

/**
 * Creates event handlers for tour features
 * @param {string} tourKey - The key identifying the tour
 * @returns {Function} Event handler for the tour feature
 */
const createOnEachTourFeature = (
  tourKey,
  tourName,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onOpenDirectionsMenu,
  onPopupClose,
  onPopupOpen,
  onRemoveResult,
  onRegisterLayer,
  resolveTourBrowseResult,
  schedulePopupLayout,
  shouldRenderPopup
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
      onPopupClose,
      onPopupOpen,
      onRemove: () => {
        onRemoveResult(browseResult.id);
        layer.closePopup();
      },
      schedulePopupLayout,
      shouldRenderPopup,
    });
    if (onRegisterLayer) {
      onRegisterLayer(browseResult, layer);
    }
    layer.on('mouseover', () => {
      onHoverStart?.(browseResult.id);
    });
    layer.on('mouseout', () => {
      onHoverEnd?.(browseResult.id);
    });
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
  const runtimeEnv = useMemo(() => getRuntimeEnv(), []);
  const {
    isDev,
    featureFlags,
  } = runtimeEnv;
  const routingProvider = featureFlags.routingProvider || "api";
  const isFieldPacketsEnabled = featureFlags.fieldPackets;
  const tourDefinitions = featureFlags.fabTours ? TOUR_DEFINITIONS : EMPTY_TOUR_DEFINITIONS;
  const tourStyles = featureFlags.fabTours ? TOUR_STYLES : EMPTY_TOUR_STYLES;
  /**
   * `BurialMap` keeps the runtime wiring: React state, Leaflet lifecycles, and
   * user interaction orchestration. Pure record formatting and tour/burial
   * reconciliation live in dedicated feature modules so maintainers can
   * change presentation rules without also reading map-effect code.
   */
  //-----------------------------------------------------------------------------
  // State Management
  //-----------------------------------------------------------------------------

  // Map and UI State
  const [overlayMaps, setOverlayMaps] = useState({});
  const [tourGeoJsonByName, setTourGeoJsonByName] = useState({});
  const [tourBoundsByName, setTourBoundsByName] = useState({});
  const [tourResultsByName, setTourResultsByName] = useState({});
  const [currentZoom, setCurrentZoom] = useState(14);
  const [isLayerControlOpen, setIsLayerControlOpen] = useState(false);
  const [selectionState, setSelectionState] = useState(() => createMapSelectionState());
  const [mapEngine, setMapEngine] = useState(() => (
    featureFlags.customMapEngine ? "custom" : "leaflet"
  ));
  const [selectedTour, setSelectedTour] = useState(null);
  const [activeBasemapId, setActiveBasemapId] = useState(() => (
    MAP_CONTROLLED_BASEMAPS.some((basemap) => basemap.id === DEFAULT_BASEMAP_ID)
      ? DEFAULT_BASEMAP_ID
      : (MAP_CONTROLLED_BASEMAPS[0]?.id || MAP_BASEMAPS[0]?.id || "")
  ));
  const [overlayVisibility, setOverlayVisibility] = useState(DEFAULT_MAP_OVERLAY_VISIBILITY);
  const [siteTwinManifest, setSiteTwinManifest] = useState(EMPTY_SITE_TWIN_MANIFEST);
  const [siteTwinCandidates, setSiteTwinCandidates] = useState(() => normalizeSiteTwinFeatureCollection());
  const [siteTwinDebugState, setSiteTwinDebugState] = useState(() => getDefaultSiteTwinDebugState());
  const [coreMapData, setCoreMapData] = useState(getEmptyCoreMapData);

  // Search and Filter State
  const { activeBurialId, hoveredBurialId, selectedBurials } = selectionState;
  const [showAllBurials, setShowAllBurials] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [lotTierFilter, setLotTierFilter] = useState('');
  const [filterType, setFilterType] = useState('lot');
  const [baseBurialRecords, setBaseBurialRecords] = useState([]);
  const [tourMatches, setTourMatches] = useState({});
  const [isBurialDataLoading, setIsBurialDataLoading] = useState(false);
  const [burialDataError, setBurialDataError] = useState('');
  const [mapDataError, setMapDataError] = useState('');
  const [tourLayerError, setTourLayerError] = useState('');
  const [loadingTourName, setLoadingTourName] = useState('');
  const [searchIndex, setSearchIndex] = useState(null);
  const [isSearchIndexReady, setIsSearchIndexReady] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [isPmtilesEnabled, setIsPmtilesEnabled] = useState(false);
  const [hasRequestedBurialData, setHasRequestedBurialData] = useState(false);
  const [fieldPacket, setFieldPacket] = useState(null);
  const [fieldPacketNotice, setFieldPacketNotice] = useState(null);
  const [sharedLinkLandingState, setSharedLinkLandingState] = useState(null);
  const [uniqueSections, setUniqueSections] = useState([]);

  // Location and Routing State
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [status, setStatus] = useState(LOCATION_MESSAGES.inactive);
  const [routingOrigin, setRoutingOrigin] = useState(null);
  const [routingDestination, setRoutingDestination] = useState(null);
  const [routeGeoJson, setRouteGeoJson] = useState(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [activeRouteBurialId, setActiveRouteBurialId] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [appMenuAnchorEl, setAppMenuAnchorEl] = useState(null);
  const [directionsMenuAnchorEl, setDirectionsMenuAnchorEl] = useState(null);
  const [directionsMenuBurial, setDirectionsMenuBurial] = useState(null);
  const { boundaryData, roadsData, sectionsData } = coreMapData;

  // Component References
  // Leaflet layers outlive individual renders, so these refs act as the
  // imperative bridge between React state and map objects.
  const markerClusterRef = useRef(null);
  const mapRef = useRef(null);
  const sidebarOverlayRef = useRef(null);
  const sectionFeatureLayersRef = useRef(new Map());
  const sectionMarkersByIdRef = useRef(new Map());
  const activeSectionMarkerIdRef = useRef(null);
  const activeBurialIdRef = useRef(null);
  const hoveredBurialIdRef = useRef(null);
  const hoveredSectionIdRef = useRef(null);
  const hoveredSectionLayerRef = useRef(null);
  const canSectionHoverRef = useRef(true);
  const recentTouchSectionInteractionRef = useRef(false);
  const sectionTooltipSyncFrameRef = useRef(null);
  const didApplyUrlStateRef = useRef(false);
  const loadedTourNamesRef = useRef(new Set());
  const loadingTourNamesRef = useRef(new Set());
  const selectedBurialRefs = useRef(new Map());
  const selectedMarkerLayersRef = useRef(new Map());
  const tourFeatureLayersRef = useRef(new Map());
  const pendingPopupBurialRef = useRef(null);
  const popupBurialIdRef = useRef(null);
  const activeRouteBurialIdRef = useRef(null);
  const directionsMenuBurialRef = useRef(null);

  //-----------------------------------------------------------------------------
  // Memoized Values
  //-----------------------------------------------------------------------------

  const sectionBoundsById = useMemo(
    () => buildSectionBoundsById(sectionsData),
    [sectionsData]
  );
  const roadRoutingGraph = useMemo(
    () => buildRoadRoutingGraph(roadsData),
    [roadsData]
  );
  const isCustomMapEngineEnabled = mapEngine === "custom";
  const {
    showSectionOverviewMarkers,
    showSections,
  } = useMemo(() => resolveSectionOverlayVisibility({
    currentZoom,
    sectionDetailMinZoom: ZOOM_LEVELS.SECTION,
    sectionFilter,
    sectionOverviewMarkerMinZoom: SECTION_OVERVIEW_MARKER_MIN_ZOOM,
    selectedTour,
  }), [currentZoom, sectionFilter, selectedTour]);
  const selectedMarkerOrderById = useMemo(
    () => new Map(selectedBurials.map((burial, index) => [burial.id, index + 1])),
    [selectedBurials]
  );

  const getTourName = useCallback(
    (option = {}) => cleanRecordValue(
      option.tourName ||
      tourStyles[option.title]?.name ||
      tourStyles[option.tourKey]?.name ||
      option.title ||
      option.tourKey ||
      ''
    ),
    [tourStyles]
  );

  const tourDefinitionsByName = useMemo(
    () => new Map(tourDefinitions.map((definition) => [definition.name, definition])),
    [tourDefinitions]
  );
  const tourNames = useMemo(
    () => tourDefinitions.map((definition) => definition.name),
    [tourDefinitions]
  );
  const basemapById = useMemo(
    () => new Map(MAP_BASEMAPS.map((basemap) => [basemap.id, basemap])),
    []
  );
  const defaultBasemap = useMemo(
    () => basemapById.get(DEFAULT_BASEMAP_ID) || MAP_CONTROLLED_BASEMAPS[0] || MAP_BASEMAPS[0] || null,
    [basemapById]
  );
  const activeBasemap = useMemo(
    () => basemapById.get(activeBasemapId) || defaultBasemap,
    [activeBasemapId, basemapById, defaultBasemap]
  );
  const normalizedSiteTwinDebugState = useMemo(
    () => normalizeSiteTwinDebugState(siteTwinDebugState),
    [siteTwinDebugState]
  );
  const filteredSiteTwinCandidates = useMemo(
    () => filterSiteTwinFeatureCollection(siteTwinCandidates, normalizedSiteTwinDebugState),
    [siteTwinCandidates, normalizedSiteTwinDebugState]
  );
  const siteTwinLoadedSummary = useMemo(
    () => summarizeSiteTwinFeatureCollection(siteTwinCandidates),
    [siteTwinCandidates]
  );
  const siteTwinFilteredSummary = useMemo(
    () => summarizeSiteTwinFeatureCollection(filteredSiteTwinCandidates),
    [filteredSiteTwinCandidates]
  );
  const siteTwinSurfaceOpacity = normalizedSiteTwinDebugState.surfaceOpacity;
  const selectedTourLayer = useMemo(
    () => (selectedTour ? overlayMaps[selectedTour] || null : null),
    [overlayMaps, selectedTour]
  );
  const selectedTourGeoJson = useMemo(
    () => (selectedTour ? tourGeoJsonByName[selectedTour] || null : null),
    [selectedTour, tourGeoJsonByName]
  );
  const selectedTourBounds = useMemo(
    () => (selectedTour ? tourBoundsByName[selectedTour] || null : null),
    [selectedTour, tourBoundsByName]
  );
  const initialDeepLinkRef = useRef(null);
  if (initialDeepLinkRef.current === null && typeof window !== "undefined") {
    initialDeepLinkRef.current = parseDeepLinkState(window.location.search, tourNames);
  }
  const initialFieldPacket = initialDeepLinkRef.current?.fieldPacket || null;
  const initialDeepLinkNeedsBurialData = Boolean(
    initialDeepLinkRef.current?.query ||
    initialDeepLinkRef.current?.section ||
    initialDeepLinkRef.current?.showBurialsView ||
    (
      isFieldPacketsEnabled &&
      initialFieldPacket &&
      (
        initialFieldPacket.selectedRecords?.length > 0 ||
        initialFieldPacket.sectionFilter
      )
    )
  );
  const appMenuOpen = Boolean(appMenuAnchorEl);
  const directionsMenuOpen = Boolean(directionsMenuAnchorEl);
  const isAppleMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;

    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);
  const showIosInstallHint = isAppleMobile && !isInstalled && !installPromptEvent;
  const initialBrowseQuery = initialDeepLinkRef.current?.query || "";
  const fieldPacketPresentation = useMemo(
    () => buildSharedSelectionPresentation(fieldPacket || {}),
    [fieldPacket]
  );
  const isMobile = useMediaQuery("(max-width:840px)");
  const shouldReduceMapMotion = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return isMobile;
    }

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData) {
      return true;
    }

    if (connection?.effectiveType && SLOW_CONNECTION_TYPES.has(connection.effectiveType)) {
      return true;
    }

    if (navigator.deviceMemory && navigator.deviceMemory <= 4) {
      return true;
    }

    return isMobile;
  }, [isMobile]);
  const shouldUseMapPopups = !isMobile;
  const shouldUseMapPopupsRef = useRef(shouldUseMapPopups);
  const handleBasemapChange = useCallback((nextBasemapId) => {
    setActiveBasemapId(nextBasemapId);
  }, []);
  const handleToggleOverlay = useCallback((overlayId) => {
    setOverlayVisibility((current) => ({
      ...current,
      [overlayId]: !(current[overlayId] !== false),
    }));
  }, []);
  const handleUpdateSiteTwinDebugState = useCallback((partialState) => {
    setSiteTwinDebugState((currentState) => normalizeSiteTwinDebugState({
      ...currentState,
      ...partialState,
    }));
  }, []);
  const handleResetSiteTwinDebugState = useCallback(() => {
    setSiteTwinDebugState(getDefaultSiteTwinDebugState());
  }, []);
  const handleMapEngineChange = useCallback((nextEngine) => {
    if (!isDev) {
      return;
    }

    if (nextEngine !== "leaflet" && nextEngine !== "custom") {
      return;
    }

    setMapEngine((currentEngine) => {
      if (currentEngine === nextEngine) {
        return currentEngine;
      }

      setStoredCustomMapEngineOverride(nextEngine === "custom");
      return nextEngine;
    });
  }, [isDev]);
  const getMapInstance = useCallback(() => mapRef.current, []);
  const updateSelectionState = useCallback((updater) => {
    setSelectionState((currentSelectionState) => {
      const nextSelectionState = createMapSelectionState(
        typeof updater === "function"
          ? updater(currentSelectionState)
          : updater
      );
      activeBurialIdRef.current = nextSelectionState.activeBurialId;
      hoveredBurialIdRef.current = nextSelectionState.hoveredBurialId;
      return nextSelectionState;
    });
  }, []);
  const closeMapPopup = useCallback(() => {
    pendingPopupBurialRef.current = null;
    popupBurialIdRef.current = null;
    getMapInstance()?.closePopup?.();
  }, [getMapInstance]);
  const clearActiveBurialFocus = useCallback(({ clearHover = false, closePopup = true } = {}) => {
    updateSelectionState((currentSelectionState) => clearSelectionFocus(currentSelectionState, { clearHover }));

    if (closePopup) {
      closeMapPopup();
    }
  }, [closeMapPopup, updateSelectionState]);

  useEffect(() => {
    if (basemapById.has(activeBasemapId)) {
      return;
    }

    if (defaultBasemap?.id) {
      setActiveBasemapId(defaultBasemap.id);
    }
  }, [activeBasemapId, basemapById, defaultBasemap]);

  useEffect(() => {
    if (!SITE_TWIN_CONFIG?.manifestPublicPath || typeof window === "undefined") {
      return undefined;
    }

    const controller = new AbortController();
    const manifestUrl = buildPublicAssetUrl(SITE_TWIN_CONFIG.manifestPublicPath);

    fetch(manifestUrl, { signal: controller.signal })
      .then((response) => (
        response.ok
          ? response.json()
          : EMPTY_SITE_TWIN_MANIFEST
      ))
      .then((manifest) => {
        setSiteTwinManifest(normalizeSiteTwinManifest(manifest));
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        setSiteTwinManifest(EMPTY_SITE_TWIN_MANIFEST);
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadSiteTwinCandidates({
      isDev,
      isOverlayVisible: overlayVisibility.siteTwin !== false,
      manifest: siteTwinManifest,
    }) || typeof window === "undefined") {
      return undefined;
    }

    const controller = new AbortController();
    const candidatesUrl = buildPublicAssetUrl(siteTwinManifest.graveCandidates.url);

    fetch(candidatesUrl, { signal: controller.signal })
      .then((response) => (
        response.ok
          ? response.json()
          : normalizeSiteTwinFeatureCollection()
      ))
      .then((featureCollection) => {
        setSiteTwinCandidates(normalizeSiteTwinFeatureCollection(featureCollection));
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return;
        }

        setSiteTwinCandidates(normalizeSiteTwinFeatureCollection());
      });

    return () => {
      controller.abort();
    };
  }, [isDev, overlayVisibility.siteTwin, siteTwinManifest]);

  const getOverlayElement = useCallback(() => sidebarOverlayRef.current, []);
  const fitMapBoundsInViewport = useCallback((map, bounds, options = {}) => {
    fitBoundsInVisibleViewport(map, bounds, {
      ...options,
      getOverlayElement,
    });
  }, [getOverlayElement]);
  const panMapIntoViewport = useCallback((map, latLng, options = {}) => {
    panIntoVisibleViewport(map, latLng, {
      ...options,
      getOverlayElement,
    });
  }, [getOverlayElement]);
  const schedulePopupLayout = useCallback((popup) => {
    if (!popup) {
      return;
    }

    if (popup.__customRuntimePopup) {
      return;
    }

    schedulePopupInView(popup, { getOverlayElement });
  }, [getOverlayElement]);
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
    shouldUseMapPopupsRef.current = shouldUseMapPopups;

    if (shouldUseMapPopups) {
      return;
    }

    closeMapPopup();
  }, [closeMapPopup, shouldUseMapPopups]);

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

  useEffect(() => {
    if (!isDev || typeof window === "undefined") {
      setSiteTwinDebugState(getDefaultSiteTwinDebugState());
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(SITE_TWIN_DEBUG_STORAGE_KEY);
      if (!storedValue) {
        setSiteTwinDebugState(getDefaultSiteTwinDebugState());
        return;
      }

      setSiteTwinDebugState(normalizeSiteTwinDebugState(JSON.parse(storedValue)));
    } catch (_error) {
      setSiteTwinDebugState(getDefaultSiteTwinDebugState());
    }
  }, [isDev]);

  useEffect(() => {
    if (!isDev || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        SITE_TWIN_DEBUG_STORAGE_KEY,
        JSON.stringify(normalizeSiteTwinDebugState(siteTwinDebugState))
      );
    } catch (_error) {
      // Ignore storage failures in private browsing and constrained environments.
    }
  }, [isDev, siteTwinDebugState]);

  useEffect(() => {
    if (isFieldPacketsEnabled) return;

    setFieldPacket(null);
    setFieldPacketNotice(null);
    setSharedLinkLandingState(null);
  }, [isFieldPacketsEnabled]);

  useEffect(() => {
    if (!fieldPacketNotice || typeof window === "undefined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFieldPacketNotice(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fieldPacketNotice]);

  useEffect(() => {
    const nextTitle = fieldPacket?.selectedRecords?.length
      ? `${fieldPacketPresentation.title} | ${APP_DOCUMENT_TITLE}`
      : APP_DOCUMENT_TITLE;
    const nextDescription = fieldPacket?.selectedRecords?.length
      ? fieldPacketPresentation.description
      : APP_DESCRIPTION;

    syncDocumentMetadata({
      title: nextTitle,
      description: nextDescription,
      url: typeof window === "undefined" ? "" : window.location.href,
    });
  }, [
    fieldPacket,
    fieldPacketPresentation.description,
    fieldPacketPresentation.title,
  ]);

  useEffect(() => {
    if (initialDeepLinkNeedsBurialData) {
      setHasRequestedBurialData(true);
    }
  }, [initialDeepLinkNeedsBurialData]);

  const burialRecords = useMemo(() => (
    baseBurialRecords.map((record) => harmonizeBurialBrowseResult(record, tourMatches))
  ), [baseBurialRecords, tourMatches]);

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
  const burialSectionIndex = useMemo(
    () => buildBurialSectionIndex(burialRecords),
    [burialRecords]
  );
  const sectionBurialCounts = useMemo(() => {
    const counts = new Map();

    burialSectionIndex.forEach((sectionEntry, sectionValue) => {
      counts.set(sectionValue, sectionEntry.records.length);
    });

    return counts;
  }, [burialSectionIndex]);
  const sectionOverviewMarkers = useMemo(
    () => buildSectionOverviewMarkers(sectionsData, sectionBurialCounts),
    [sectionBurialCounts, sectionsData]
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
    }, {
      sectionIndex: burialSectionIndex,
    })
  ), [burialRecords, burialSectionIndex, filterType, lotTierFilter, sectionFilter]);

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
    const CHUNK_SIZE = 5000;
    setIsSearchIndexReady(false);

    /**
     * Build the search index in chunks to avoid blocking the main thread for long tasks (>50ms).
     * This keeps the interface fluid (especially LCP paint and interactions) while 97k records are indexed.
     */
    const indexChunk = (startIndex, currentIndex) => {
      if (cancelled) return;

      const chunk = burialRecords.slice(startIndex, startIndex + CHUNK_SIZE);
      const nextIndex = buildSearchIndex(chunk, { getTourName, initialIndex: currentIndex });

      if (startIndex + CHUNK_SIZE < burialRecords.length) {
        const nextStep = () => indexChunk(startIndex + CHUNK_SIZE, nextIndex);
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          handle = window.requestIdleCallback(nextStep, { timeout: 2000 });
        } else {
          handle = setTimeout(nextStep, 16);
        }
      } else {
        setSearchIndex(nextIndex);
        setIsSearchIndexReady(true);
      }
    };

    indexChunk(0, null);

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && typeof handle === 'number') {
        if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(handle);
        } else {
          clearTimeout(handle);
        }
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
    const currentPoint = point([position.coords.longitude, position.coords.latitude]);
    const isWithinBuffer = booleanPointInPolygon(currentPoint, LOCATION_BUFFER_BOUNDARY);

    if (isWithinBuffer) {
      setStatus(LOCATION_MESSAGES.active);
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    }

    setStatus(LOCATION_MESSAGES.outOfBounds);
    setLat(null);
    setLng(null);
    return null;
  }, []);

  const handleLocationError = useCallback((error) => {
    setStatus(LOCATION_MESSAGES.unavailable);
    console.error('Geolocation error:', error);
    return null;
  }, []);

  const requestCurrentLocation = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) {
      setStatus(LOCATION_MESSAGES.unsupported);
      resolve(null);
      return;
    }

    setStatus(LOCATION_MESSAGES.locating);
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

  const focusUserLocationOnMap = useCallback((location, { animate = !shouldReduceMapMotion } = {}) => {
    const map = getMapInstance();
    if (!map || !location) {
      return;
    }

    const targetLatLng = {
      lat: location.latitude,
      lng: location.longitude,
    };
    const targetZoom = Math.max(
      typeof map.getZoom === "function" ? map.getZoom() : MAP_ZOOM,
      ZOOM_LEVELS.SECTION
    );

    map.setView(targetLatLng, targetZoom, { animate });
    panMapIntoViewport(map, targetLatLng, { animate: false });
  }, [getMapInstance, panMapIntoViewport, shouldReduceMapMotion]);

  const onLocateMarker = useCallback(async () => {
    const location = await requestCurrentLocation();
    if (!location || !navigator.geolocation) {
      return;
    }

    focusUserLocationOnMap(location);

    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = updateLocationFromPosition(position);
        if (nextLocation && activeRouteBurialIdRef.current) {
          setRoutingOrigin([nextLocation.latitude, nextLocation.longitude]);
        }
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
  }, [
    focusUserLocationOnMap,
    handleLocationError,
    requestCurrentLocation,
    updateLocationFromPosition,
    watchId,
  ]);

  const getPopupLayerForBurial = useCallback((burial) => {
    if (!burial) return null;

    if (burial.source === "tour") {
      return tourFeatureLayersRef.current.get(burial.id) || null;
    }

    return selectedMarkerLayersRef.current.get(burial.id) || null;
  }, []);
  const handlePopupBurialOpen = useCallback((burial) => {
    popupBurialIdRef.current = burial?.id || null;
  }, []);
  const handlePopupBurialClose = useCallback((burial) => {
    pendingPopupBurialRef.current = null;

    const burialId = cleanRecordValue(burial?.id) || popupBurialIdRef.current;
    if (!burialId) {
      return;
    }

    if (popupBurialIdRef.current === burialId) {
      popupBurialIdRef.current = null;
    }

    if (!shouldUseMapPopupsRef.current) {
      return;
    }

    updateSelectionState((currentSelectionState) => (
      currentSelectionState.activeBurialId === burialId
        ? clearSelectionFocus(currentSelectionState)
        : currentSelectionState
    ));
  }, [updateSelectionState]);

  const openPopupForBurial = useCallback((burial) => {
    if (!shouldUseMapPopups) {
      return false;
    }

    const layer = getPopupLayerForBurial(burial);
    if (!layer?.openPopup) {
      return false;
    }

    layer.openPopup();
    schedulePopupLayout(layer.getPopup?.());
    return true;
  }, [getPopupLayerForBurial, schedulePopupLayout, shouldUseMapPopups]);

  const focusBurialPopup = useCallback((burial, map) => {
    if (!burial) return;
    if (!shouldUseMapPopups) {
      pendingPopupBurialRef.current = null;
      return;
    }

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
  }, [openPopupForBurial, shouldUseMapPopups]);

  /**
   * Focuses a burial consistently regardless of whether it was found by search or map click.
   */
  const focusBurial = useCallback((
    burial,
    {
      animate = true,
      openTourPopup = true,
      preserveViewport = false,
    } = {}
  ) => {
    if (!burial) return;

    updateSelectionState((currentSelectionState) => focusSelectionBurial(currentSelectionState, burial));

    const map = getMapInstance();
    if (map && Array.isArray(burial.coordinates)) {
      const targetLatLng = {
        lat: burial.coordinates[1],
        lng: burial.coordinates[0],
      };

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
      const finalizeViewport = () => {
        panMapIntoViewport(map, targetLatLng, { animate: false });
        if (openTourPopup) {
          focusBurialPopup(burial);
        }
      };

      if (!shouldAnimate) {
        map.setView(targetLatLng, targetZoom, { animate: false });
        finalizeViewport();
        return;
      }

      map.stop();
      map.once("moveend", finalizeViewport);

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
  }, [focusBurialPopup, getMapInstance, panMapIntoViewport, updateSelectionState]);

  const selectBurial = useCallback((burial, options = {}) => {
    focusBurial(burial, options);
  }, [focusBurial]);

  /**
   * Removes a burial from search results
   */
  const removeFromResults = useCallback((burialId) => {
    updateSelectionState((currentSelectionState) => removeSelectionBurial(currentSelectionState, burialId));

    if (activeRouteBurialIdRef.current === burialId) {
      setRoutingOrigin(null);
      setRoutingDestination(null);
      setRouteGeoJson(null);
      setIsRouteLoading(false);
      setRouteError("");
      setActiveRouteBurialId(null);
    }

    if (directionsMenuBurialRef.current?.id === burialId) {
      setDirectionsMenuAnchorEl(null);
      setDirectionsMenuBurial(null);
    }
  }, [updateSelectionState]);

  /**
   * Clears all search results
   */
  const clearSelectedBurials = useCallback(() => {
    updateSelectionState(createMapSelectionState());
    setRoutingOrigin(null);
    setRoutingDestination(null);
    setRouteGeoJson(null);
    setIsRouteLoading(false);
    setRouteError("");
    setActiveRouteBurialId(null);
    setDirectionsMenuAnchorEl(null);
    setDirectionsMenuBurial(null);
    closeMapPopup();
  }, [closeMapPopup, updateSelectionState]);

  const handleOpenAppMenu = useCallback((event) => {
    setAppMenuAnchorEl(event.currentTarget);
  }, []);

  const handleCloseAppMenu = useCallback(() => {
    setAppMenuAnchorEl(null);
  }, []);

  const handleTogglePmtilesExperiment = useCallback(() => {
    setIsPmtilesEnabled((current) => !current);
  }, []);

  const requestBurialDataLoad = useCallback(() => {
    setHasRequestedBurialData(true);
  }, []);

  const showFieldPacketNotice = useCallback((message, tone = "neutral") => {
    const nextMessage = String(message || "").trim();
    if (!nextMessage) {
      setFieldPacketNotice(null);
      return;
    }

    setFieldPacketNotice({
      message: nextMessage,
      tone,
    });
  }, []);

  const getCurrentMapBoundsSnapshot = useCallback(() => {
    const bounds = getMapInstance()?.getBounds?.();
    if (!bounds?.isValid?.()) return null;

    return [
      [bounds.getSouth(), bounds.getWest()],
      [bounds.getNorth(), bounds.getEast()],
    ];
  }, [getMapInstance]);

  const createFieldPacketFromSelection = useCallback(({ announce = true } = {}) => {
    if (!isFieldPacketsEnabled) return null;

    if (selectedBurials.length === 0) {
      if (announce) {
        showFieldPacketNotice("Select one or more records to create a share link.", "warning");
      }
      return null;
    }

    const nextFieldPacket = buildFieldPacketState({
      name: fieldPacket?.name,
      note: fieldPacket?.note,
      selectedRecords: selectedBurials,
      activeBurialId,
      sectionFilter,
      selectedTour,
      mapBounds: getCurrentMapBoundsSnapshot(),
    });

    setFieldPacket(nextFieldPacket);
    if (announce) {
      showFieldPacketNotice(
        fieldPacket
          ? "Share details updated from the current selection."
          : "Share link created from the current selection.",
        "success"
      );
    }

    return nextFieldPacket;
  }, [
    activeBurialId,
    fieldPacket,
    getCurrentMapBoundsSnapshot,
    isFieldPacketsEnabled,
    sectionFilter,
    selectedBurials,
    selectedTour,
    showFieldPacketNotice,
  ]);

  const updateFieldPacket = useCallback((updates = {}) => {
    setFieldPacket((current) => {
      if (!current) return current;

      return buildFieldPacketState({
        ...current,
        ...updates,
        selectedRecords: updates.selectedRecords || current.selectedRecords,
      });
    });
  }, []);

  const resolveFieldPacketForSharing = useCallback(() => {
    if (!isFieldPacketsEnabled) {
      return null;
    }

    if (selectedBurials.length > 0) {
      return createFieldPacketFromSelection({ announce: false });
    }

    return fieldPacket;
  }, [
    createFieldPacketFromSelection,
    fieldPacket,
    isFieldPacketsEnabled,
    selectedBurials.length,
  ]);

  const getFieldPacketShareUrl = useCallback((packetState = null) => {
    if (!isFieldPacketsEnabled || typeof window === "undefined") {
      return "";
    }

    const nextPacket = packetState?.selectedRecords?.length
      ? packetState
      : resolveFieldPacketForSharing();
    if (!nextPacket) return "";

    return buildFieldPacketShareUrl({
      packet: nextPacket,
      currentUrl: window.location.href,
    });
  }, [isFieldPacketsEnabled, resolveFieldPacketForSharing]);

  const copyFieldPacketLink = useCallback(async () => {
    const nextPacket = resolveFieldPacketForSharing();
    const shareUrl = getFieldPacketShareUrl(nextPacket);
    if (!shareUrl) {
      showFieldPacketNotice("Share link unavailable.", "warning");
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showFieldPacketNotice("Share link copied.", "success");
        return;
      }

      if (typeof window !== "undefined" && typeof window.prompt === "function") {
        window.prompt("Copy share link", shareUrl);
        showFieldPacketNotice("Share link ready to copy.", "neutral");
        return;
      }

      showFieldPacketNotice("Clipboard access unavailable in this browser.", "warning");
    } catch (error) {
      console.error("Failed to copy share link:", error);
      showFieldPacketNotice("Failed to copy the share link.", "warning");
    }
  }, [getFieldPacketShareUrl, resolveFieldPacketForSharing, showFieldPacketNotice]);

  const shareFieldPacket = useCallback(async () => {
    const nextPacket = resolveFieldPacketForSharing();
    if (!nextPacket) return;
    const nextPacketPresentation = buildSharedSelectionPresentation(nextPacket);

    const shareUrl = getFieldPacketShareUrl(nextPacket);
    if (!shareUrl) {
      showFieldPacketNotice("Share link unavailable.", "warning");
      return;
    }

    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      await copyFieldPacketLink();
      return;
    }

    try {
      await navigator.share({
        title: nextPacketPresentation.title,
        text: nextPacketPresentation.description,
        url: shareUrl,
      });
      showFieldPacketNotice("Share link shared.", "success");
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("Failed to share link:", error);
      showFieldPacketNotice("Unable to open the native share sheet.", "warning");
    }
  }, [
    copyFieldPacketLink,
    getFieldPacketShareUrl,
    resolveFieldPacketForSharing,
    showFieldPacketNotice,
  ]);

  const clearFieldPacket = useCallback(() => {
    setFieldPacket(null);
    setSharedLinkLandingState(null);
    showFieldPacketNotice("Saved share details cleared.", "neutral");
  }, [showFieldPacketNotice]);

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
          iconSize: [30, 30],
          iconAnchor: [15, 15],
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

  const showSectionTooltip = useCallback((layer, tooltip, label) => {
    tooltip.setContent(label);
    if (!layer.getTooltip()) {
      layer.bindTooltip(tooltip);
    }
    layer.openTooltip();
  }, []);

  const hideSectionTooltip = useCallback((layer) => {
    if (typeof layer.closeTooltip === 'function') {
      layer.closeTooltip();
    }
    if (layer.getTooltip()) {
      layer.unbindTooltip();
    }
  }, []);

  const syncSectionTooltips = useCallback(() => {
    const map = getMapInstance();
    if (!map) return;

    const zoom = map.getZoom();
    sectionFeatureLayersRef.current.forEach(({ layer, tooltip, sectionValue, label }) => {
      const shouldShowTooltip =
        zoom >= ZOOM_LEVELS.SECTION ||
        `${sectionValue}` === `${sectionFilter}`;

      if (shouldShowTooltip) {
        showSectionTooltip(layer, tooltip, label);
        return;
      }

      hideSectionTooltip(layer);
    });
  }, [getMapInstance, hideSectionTooltip, sectionFilter, showSectionTooltip]);

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

  const restoreSectionLayerWeight = useCallback((sectionId, layerOverride = null) => {
    const section = sectionFeatureLayersRef.current.get(String(sectionId));
    const targetLayer = layerOverride || section?.layer;
    if (!targetLayer) return;

    targetLayer.setStyle({
      weight: `${sectionId}` === `${sectionFilter}` ? 2 : 1,
    });
  }, [sectionFilter]);

  const clearHoveredSection = useCallback(() => {
    const { clearedHoverState } = clearLeafletSectionHover({
      sectionId: hoveredSectionIdRef.current,
      layer: hoveredSectionLayerRef.current,
    });
    if (!clearedHoverState) return;

    hoveredSectionIdRef.current = null;
    hoveredSectionLayerRef.current = null;

    hideSectionTooltip(clearedHoverState.layer);
    restoreSectionLayerWeight(clearedHoverState.sectionId, clearedHoverState.layer);

    scheduleSectionTooltipSync();
  }, [
    hideSectionTooltip,
    restoreSectionLayerWeight,
    scheduleSectionTooltipSync,
  ]);

  const handleHoverBurialChange = useCallback((nextBurialId) => {
    updateSelectionState((currentSelectionState) => setSelectionHover(currentSelectionState, nextBurialId));
  }, [updateSelectionState]);

  const clearHoveredBurialIfCurrent = useCallback((burialId) => {
    if (!burialId) {
      handleHoverBurialChange(null);
      return;
    }

    updateSelectionState((currentSelectionState) => (
      currentSelectionState.hoveredBurialId === burialId
        ? setSelectionHover(currentSelectionState, null)
        : currentSelectionState
    ));
  }, [handleHoverBurialChange, updateSelectionState]);

  const syncLeafletSelectedMarkerIcon = useCallback((burialId, layerOverride = null) => {
    if (isCustomMapEngineEnabled || !burialId) {
      return;
    }

    const layer = layerOverride || selectedMarkerLayersRef.current.get(burialId);
    const markerNumber = selectedMarkerOrderById.get(burialId);
    if (!layer || !markerNumber) {
      return;
    }

    const isHighlighted =
      hoveredBurialIdRef.current === burialId ||
      activeBurialIdRef.current === burialId;

    const markerElement = layer.getElement?.();
    markerElement?.classList.toggle("custom-div-icon--highlighted", isHighlighted);
    if (typeof layer.setZIndexOffset === "function") {
      layer.setZIndexOffset(isHighlighted ? 1200 : 1000);
    }
  }, [isCustomMapEngineEnabled, selectedMarkerOrderById]);

  const syncLeafletSelectedMarkerIcons = useCallback(() => {
    if (isCustomMapEngineEnabled) {
      return;
    }

    selectedMarkerOrderById.forEach((_, burialId) => {
      syncLeafletSelectedMarkerIcon(burialId);
    });
  }, [isCustomMapEngineEnabled, selectedMarkerOrderById, syncLeafletSelectedMarkerIcon]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const handleHoverCapabilityChange = (event) => {
      canSectionHoverRef.current = event.matches;
      recentTouchSectionInteractionRef.current = !event.matches;

      if (!event.matches) {
        clearHoveredSection();
      }
    };

    canSectionHoverRef.current = mediaQuery.matches;
    recentTouchSectionInteractionRef.current = !mediaQuery.matches;

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleHoverCapabilityChange);
      return () => {
        mediaQuery.removeEventListener('change', handleHoverCapabilityChange);
      };
    }

    mediaQuery.addListener(handleHoverCapabilityChange);
    return () => {
      mediaQuery.removeListener(handleHoverCapabilityChange);
    };
  }, [clearHoveredSection]);

  const markSectionInputMode = useCallback((event) => {
    const pointerType = inferPointerType(event);
    if (isTouchLikePointerType(pointerType)) {
      recentTouchSectionInteractionRef.current = true;
      clearHoveredSection();
      return;
    }

    recentTouchSectionInteractionRef.current = false;
  }, [clearHoveredSection]);

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
    const snappedDestination = snapPointToRoadNetwork(
      burial.coordinates[1],
      burial.coordinates[0],
      roadRoutingGraph
    );

    setRouteError("");
    setRoutingOrigin([location.latitude, location.longitude]);
    setRoutingDestination(
      snappedDestination
        ? [snappedDestination.lat, snappedDestination.lng]
        : [burial.coordinates[1], burial.coordinates[0]]
    );
    setActiveRouteBurialId(burial.id);
  }, [lat, lng, requestCurrentLocation, roadRoutingGraph, selectBurial]);

  /**
   * Stops the current navigation
   */
  const stopRouting = useCallback(() => {
    setRoutingOrigin(null);
    setRoutingDestination(null);
    setRouteGeoJson(null);
    setIsRouteLoading(false);
    setRouteError("");
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

  useEffect(() => {
    if (!routingOrigin || !routingDestination) {
      setRouteGeoJson(null);
      setIsRouteLoading(false);
      return undefined;
    }

    const abortController = typeof AbortController === "function"
      ? new AbortController()
      : null;
    let ignore = false;

    setRouteGeoJson(null);
    setIsRouteLoading(true);
    setRouteError("");

    void calculateWalkingRoute({
      from: routingOrigin,
      provider: routingProvider,
      roadGraph: roadRoutingGraph,
      to: routingDestination,
      signal: abortController?.signal,
    }).then((routeResult) => {
      if (ignore) {
        return;
      }

      setRouteGeoJson(routeResult.geojson);
      setIsRouteLoading(false);

      if (isLatLngBoundsExpressionValid(routeResult.bounds)) {
        const map = getMapInstance();
        if (map) {
          fitMapBoundsInViewport(map, routeResult.bounds, {
            maxZoom: ZOOM_LEVELS.INDIVIDUAL,
          });
        }
      }
    }).catch((error) => {
      if (ignore || error?.name === "AbortError") {
        return;
      }

      console.error("Routing error:", error);
      setRouteGeoJson(null);
      setIsRouteLoading(false);
      setRouteError(getRoutingErrorMessage(error));
      setRoutingOrigin(null);
      setRoutingDestination(null);
      setActiveRouteBurialId(null);
    });

    return () => {
      ignore = true;
      abortController?.abort?.();
    };
  }, [
    fitMapBoundsInViewport,
    getMapInstance,
    roadRoutingGraph,
    routingProvider,
    routingDestination,
    routingOrigin,
  ]);

  //-----------------------------------------------------------------------------
  // Effects
  //-----------------------------------------------------------------------------

  useEffect(() => {
    let ignore = false;

    const loadMapData = async () => {
      setMapDataError("");

      try {
        const nextCoreMapData = await loadCoreMapData(APP_PROFILE);

        if (!ignore) {
          setCoreMapData(nextCoreMapData);
        }
      } catch (error) {
        console.error("Failed to load core map data:", error);

        if (!ignore) {
          setCoreMapData(getEmptyCoreMapData());
          setMapDataError("Map layers failed to load. Refresh and try again.");
        }
      }
    };

    void loadMapData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (initialDeepLinkNeedsBurialData || hasRequestedBurialData || typeof window === "undefined") {
      return undefined;
    }

    let idleHandle;
    let timeoutHandle;

    const scheduleLoad = () => {
      if ('requestIdleCallback' in window) {
        idleHandle = window.requestIdleCallback(() => {
          setHasRequestedBurialData(true);
        }, { timeout: 4000 });
        return;
      }

      timeoutHandle = window.setTimeout(() => {
        setHasRequestedBurialData(true);
      }, 1200);
    };

    if (document.readyState === "complete") {
      scheduleLoad();
    } else {
      window.addEventListener('load', scheduleLoad, { once: true });
    }

    return () => {
      window.removeEventListener('load', scheduleLoad);
      if ('cancelIdleCallback' in window && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle);
      }
      if (typeof timeoutHandle === 'number') {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [hasRequestedBurialData, initialDeepLinkNeedsBurialData]);

  /**
   * Load the lightweight burial search index asynchronously.
   */
  useEffect(() => {
    if (!hasRequestedBurialData) {
      return undefined;
    }

    let ignore = false;

    const loadBurials = async () => {
      setIsBurialDataLoading(true);
      setBurialDataError('');
      try {
        // Fetch the lightweight search index from public directory
        const response = await fetch(buildPublicAssetUrl(SEARCH_INDEX_PUBLIC_PATH));
        if (!response.ok) throw new Error('Failed to fetch search index');
        const minifiedData = await response.json();

        if (!ignore) {
          const nextUniqueSections = new Set();
          const records = minifiedData.map((item) => {
            const nextRecord = buildBurialBrowseResult(
              {
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
                  title: item.tk,
                  fullNameNormalized: item.n,
                  searchableLabelLower: item.sl,
                  nameVariantsNormalized: item.nv,
                },
                geometry: item.c ? { type: 'Point', coordinates: item.c } : null,
              },
              { getTourName }
            );

            if (nextRecord.Section) {
              nextUniqueSections.add(nextRecord.Section);
            }

            return nextRecord;
          });

          setBaseBurialRecords(records);
          setUniqueSections(Array.from(nextUniqueSections).sort(sortSectionValues));
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
  }, [getTourName, hasRequestedBurialData]);

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
    activeRouteBurialIdRef.current = activeRouteBurialId;
  }, [activeRouteBurialId]);

  useEffect(() => {
    directionsMenuBurialRef.current = directionsMenuBurial;
  }, [directionsMenuBurial]);

  useEffect(() => {
    if (!burialRecordsById.size) return;

    updateSelectionState((currentSelectionState) => {
      let changed = false;
      const nextSelectionState = refreshSelectionBurials(currentSelectionState, (burial) => {
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
      return changed ? nextSelectionState : currentSelectionState;
    });

    setDirectionsMenuBurial((current) => {
      if (current?.source !== "burial") return current;

      const latest = burialRecordsById.get(current.id);
      return latest || current;
    });
  }, [burialRecordsById, updateSelectionState]);

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

  const buildSectionMarker = useCallback((burial) => {
    if (!Array.isArray(burial.coordinates)) {
      return null;
    }

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
      onPopupClose: handlePopupBurialClose,
      onPopupOpen: handlePopupBurialOpen,
      onRemove: () => {
        removeFromResults(burial.id);
        marker.closePopup();
      },
      schedulePopupLayout,
      shouldRenderPopup: () => shouldUseMapPopupsRef.current,
    });

    marker.on('click', () => {
      selectBurial(burial, {
        animate: false,
        openTourPopup: true,
        preserveViewport: true,
      });
    });
    marker.on('mouseover', () => {
      handleHoverBurialChange(burial.id);
    });
    marker.on('mouseout', () => {
      clearHoveredBurialIfCurrent(burial.id);
    });

    return marker;
  }, [
    clearHoveredBurialIfCurrent,
    handleOpenDirectionsMenu,
    handlePopupBurialClose,
    handlePopupBurialOpen,
    handleHoverBurialChange,
    removeFromResults,
    schedulePopupLayout,
    selectBurial,
  ]);

  /**
   * Update section burial marker display
   */
  useEffect(() => {
    if (isCustomMapEngineEnabled) {
      sectionMarkersByIdRef.current = new Map();
      activeSectionMarkerIdRef.current = null;
      return undefined;
    }

    const map = getMapInstance();
    if (!map || !showAllBurials || !sectionFilter) return;

    if (markerClusterRef.current && map.hasLayer(markerClusterRef.current)) {
      markerClusterRef.current.clearLayers();
      map.removeLayer(markerClusterRef.current);
    }

    const clusterGroup = createClusterGroup();
    const nextSectionMarkers = new Map();
    let nextIndex = 0;
    let cancelled = false;
    let handle = null;

    markerClusterRef.current = clusterGroup;
    sectionMarkersByIdRef.current = nextSectionMarkers;
    activeSectionMarkerIdRef.current = null;
    map.addLayer(clusterGroup);

    const addNextMarkerBatch = () => {
      if (cancelled) {
        return;
      }

      const batchMarkers = [];
      const batchEnd = Math.min(nextIndex + SECTION_MARKER_BATCH_SIZE, sectionBurials.length);

      for (; nextIndex < batchEnd; nextIndex += 1) {
        const burial = sectionBurials[nextIndex];
        const marker = buildSectionMarker(burial);

        if (!marker) {
          continue;
        }

        nextSectionMarkers.set(burial.id, marker);
        batchMarkers.push(marker);
      }

      if (batchMarkers.length > 0) {
        clusterGroup.addLayers(batchMarkers);
        syncActiveSectionMarker(activeBurialIdRef.current);
      }

      if (nextIndex < sectionBurials.length) {
        handle = scheduleIdleTask(addNextMarkerBatch, {
          timeout: 250,
          fallbackDelay: 16,
        });
        return;
      }

      handle = null;
      syncActiveSectionMarker(activeBurialIdRef.current);
    };

    addNextMarkerBatch();

    return () => {
      cancelled = true;
      cancelIdleTask(handle);

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
    buildSectionMarker,
    createClusterGroup,
    sectionBurials,
    sectionFilter,
    showAllBurials,
    syncActiveSectionMarker,
    getMapInstance,
    isCustomMapEngineEnabled,
  ]);

  useEffect(() => {
    syncActiveSectionMarker(activeBurialId);
  }, [activeBurialId, syncActiveSectionMarker]);

  useEffect(() => {
    syncLeafletSelectedMarkerIcons();
  }, [
    activeBurialId,
    hoveredBurialId,
    isCustomMapEngineEnabled,
    selectedMarkerOrderById,
    syncLeafletSelectedMarkerIcons,
  ]);

  useEffect(() => {
    if (!shouldUseMapPopups) {
      pendingPopupBurialRef.current = null;
      return;
    }

    const pendingBurial = pendingPopupBurialRef.current;
    if (!pendingBurial) return;

    if (openPopupForBurial(pendingBurial)) {
      pendingPopupBurialRef.current = null;
    }
  }, [activeBurialId, isCustomMapEngineEnabled, openPopupForBurial, selectedBurials, selectedTour, shouldUseMapPopups]);

  useEffect(() => {
    if (!shouldUseMapPopups || activeBurialId === null || typeof window === "undefined") {
      return undefined;
    }

    const activeBurial = selectedBurials.find((burial) => burial.id === activeBurialId);
    if (!activeBurial) {
      return undefined;
    }

    let animationFrame = null;
    animationFrame = window.requestAnimationFrame(() => {
      if (!openPopupForBurial(activeBurial)) {
        pendingPopupBurialRef.current = activeBurial;
      }
    });

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [activeBurialId, isCustomMapEngineEnabled, openPopupForBurial, selectedBurials, shouldUseMapPopups]);

  /**
   * Handle map zoom changes
   */
  const handleZoomEnd = useCallback((e) => {
    const map = e.target;
    setCurrentZoom(map.getZoom());
  }, []);

  useEffect(() => {
    const map = getMapInstance();
    if (!map) return;

    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [getMapInstance, handleZoomEnd]);

  useEffect(() => {
    if (isCustomMapEngineEnabled) {
      return undefined;
    }

    scheduleSectionTooltipSync();

    return () => {
      if (sectionTooltipSyncFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(sectionTooltipSyncFrameRef.current);
        sectionTooltipSyncFrameRef.current = null;
      }
    };
  }, [currentZoom, isCustomMapEngineEnabled, scheduleSectionTooltipSync, sectionFilter]);

  useEffect(() => {
    if (isCustomMapEngineEnabled) {
      return undefined;
    }

    const map = getMapInstance();
    if (!map) return undefined;
    const container = typeof map.getContainer === 'function' ? map.getContainer() : null;
    const handleInterruptedSectionHover = () => {
      clearHoveredSection();
    };
    const handleSectionInputStart = (event) => {
      markSectionInputMode(event);
    };
    const handleSectionInputMove = (event) => {
      if (inferPointerType(event) === 'mouse') {
        recentTouchSectionInteractionRef.current = false;
      }
    };

    map.on('movestart', handleInterruptedSectionHover);
    map.on('zoomstart', handleInterruptedSectionHover);
    container?.addEventListener('pointermove', handleSectionInputMove);
    container?.addEventListener('mousemove', handleSectionInputMove);
    container?.addEventListener('pointerleave', handleInterruptedSectionHover);
    container?.addEventListener('mouseleave', handleInterruptedSectionHover);
    window.addEventListener('pointerdown', handleSectionInputStart, true);
    window.addEventListener('touchstart', handleSectionInputStart, true);
    window.addEventListener('blur', handleInterruptedSectionHover);

    return () => {
      map.off('movestart', handleInterruptedSectionHover);
      map.off('zoomstart', handleInterruptedSectionHover);
      container?.removeEventListener('pointermove', handleSectionInputMove);
      container?.removeEventListener('mousemove', handleSectionInputMove);
      container?.removeEventListener('pointerleave', handleInterruptedSectionHover);
      container?.removeEventListener('mouseleave', handleInterruptedSectionHover);
      window.removeEventListener('pointerdown', handleSectionInputStart, true);
      window.removeEventListener('touchstart', handleSectionInputStart, true);
      window.removeEventListener('blur', handleInterruptedSectionHover);
    };
  }, [clearHoveredSection, getMapInstance, isCustomMapEngineEnabled, markSectionInputMode]);

  useEffect(() => {
    if (isCustomMapEngineEnabled) {
      return undefined;
    }

    const map = getMapInstance();
    if (!map) return undefined;
    const clearInterruptedBurialHover = () => {
      const hoveredBurialId = hoveredBurialIdRef.current;
      if (!hoveredBurialId) {
        return;
      }

      clearHoveredBurialIfCurrent(hoveredBurialId);
    };

    map.on("movestart", clearInterruptedBurialHover);
    map.on("zoomstart", clearInterruptedBurialHover);
    window.addEventListener("blur", clearInterruptedBurialHover);

    return () => {
      map.off("movestart", clearInterruptedBurialHover);
      map.off("zoomstart", clearInterruptedBurialHover);
      window.removeEventListener("blur", clearInterruptedBurialHover);
    };
  }, [clearHoveredBurialIfCurrent, getMapInstance, isCustomMapEngineEnabled]);

  const resetMapToDefaultBounds = useCallback(() => {
    const map = getMapInstance();
    if (!map) return;

    fitMapBoundsInViewport(map, DEFAULT_VIEW_BOUNDS);
  }, [fitMapBoundsInViewport, getMapInstance]);

  const focusSectionOnMap = useCallback((sectionValue, bounds) => {
    const map = getMapInstance();
    if (!map || !sectionValue) return;

    const sectionBounds = bounds || sectionBoundsById.get(String(sectionValue));
    if (!isRenderableBounds(sectionBounds)) {
      return;
    }

    fitMapBoundsInViewport(map, sectionBounds, {
      maxZoom: ZOOM_LEVELS.CLUSTER,
    });
  }, [fitMapBoundsInViewport, getMapInstance, sectionBoundsById]);

  const activateSectionBrowse = useCallback((sectionValue, bounds) => {
    const nextSection = sectionValue || "";
    requestBurialDataLoad();
    clearActiveBurialFocus({ clearHover: true });
    setSectionFilter(nextSection);
    setLotTierFilter("");
    setFilterType("lot");

    if (nextSection) {
      setSelectedTour(null);
      const sectionBurialCount = sectionBurialCounts.get(String(nextSection));
      const shouldAutoShowMarkers = Number.isFinite(sectionBurialCount) &&
        sectionBurialCount > 0;
      setShowAllBurials(shouldAutoShowMarkers);
      focusSectionOnMap(nextSection, bounds);
      return;
    }

    setShowAllBurials(false);
  }, [clearActiveBurialFocus, focusSectionOnMap, requestBurialDataLoad, sectionBurialCounts]);

  const clearSectionFilters = useCallback(() => {
    clearActiveBurialFocus({ clearHover: true });
    setLotTierFilter("");
    setFilterType("lot");
    setSectionFilter("");
    setShowAllBurials(false);
    resetMapToDefaultBounds();
  }, [clearActiveBurialFocus, resetMapToDefaultBounds]);

  const handleTourSelect = useCallback((tourName) => {
    clearActiveBurialFocus({ clearHover: true });
    setSelectedTour(tourName);
    setSectionFilter("");
    setLotTierFilter("");
    setFilterType("lot");
    setShowAllBurials(false);
  }, [clearActiveBurialFocus]);

  const focusTourOnMap = useCallback((tourName) => {
    const map = getMapInstance();
    if (!map || !tourName) return;

    const bounds = tourBoundsByName[tourName];
    if (!isLatLngBoundsExpressionValid(bounds)) return;

    fitMapBoundsInViewport(map, bounds, {
      maxZoom: ZOOM_LEVELS.CLUSTER,
    });
  }, [fitMapBoundsInViewport, getMapInstance, tourBoundsByName]);

  /**
   * Apply URL-driven state once data is available for deep links from the companion app.
   */
  useEffect(() => {
    if (didApplyUrlStateRef.current) return;
    if (isBurialDataLoading) return;
    if (initialDeepLinkNeedsBurialData && burialRecords.length === 0) return;

    const deepLink = initialDeepLinkRef.current || parseDeepLinkState(window.location.search, tourNames);

    if (isFieldPacketsEnabled && deepLink.fieldPacket) {
      const nextFieldPacket = deepLink.fieldPacket;
      const packetSelections = (nextFieldPacket.selectedRecords || []).map((record) => (
        record?.source === "burial"
          ? burialRecordsById.get(record.id) || record
          : record
      ));
      const nextActiveBurial = nextFieldPacket.activeBurialId
        ? packetSelections.find((record) => record.id === nextFieldPacket.activeBurialId) || null
        : null;

      if (nextFieldPacket.selectedTour) {
        handleTourSelect(nextFieldPacket.selectedTour);
      } else if (nextFieldPacket.sectionFilter) {
        activateSectionBrowse(nextFieldPacket.sectionFilter);
      }

      setFieldPacket(nextFieldPacket);
      setSharedLinkLandingState({
        restoredAt: Date.now(),
      });

      if (packetSelections.length > 0) {
        updateSelectionState((currentSelectionState) => replaceSelectionBurials(currentSelectionState, {
          selectedBurials: packetSelections,
          activeBurialId: nextActiveBurial?.id || null,
          hoveredBurialId: null,
        }));

        const map = getMapInstance();
        if (map) {
          if (isLatLngBoundsExpressionValid(nextFieldPacket.mapBounds)) {
            fitMapBoundsInViewport(map, nextFieldPacket.mapBounds);
          } else if (nextActiveBurial?.coordinates) {
            focusBurial(nextActiveBurial, {
              addToSelection: false,
              animate: false,
              openTourPopup: false,
            });
          }
        }
      }

      showFieldPacketNotice("Shared selection loaded from link.", "neutral");
      didApplyUrlStateRef.current = true;
      return;
    }

    setSharedLinkLandingState(null);

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
    burialRecordsById,
    fitMapBoundsInViewport,
    focusBurial,
    getTourName,
    getMapInstance,
    handleTourSelect,
    initialDeepLinkNeedsBurialData,
    isBurialDataLoading,
    isFieldPacketsEnabled,
    searchIndex,
    selectBurial,
    showFieldPacketNotice,
    tourNames,
    updateSelectionState,
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
    const sectionId = String(sectionValue);
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
        clearHoveredSection();
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
        if (!shouldHandleSectionHover({
          canHover: canSectionHoverRef.current,
          recentTouchInteraction: recentTouchSectionInteractionRef.current,
        })) {
          return;
        }

        const { clearedHoverState, nextHoverState } = beginLeafletSectionHover(
          {
            sectionId: hoveredSectionIdRef.current,
            layer: hoveredSectionLayerRef.current,
          },
          {
            sectionId,
            layer,
          }
        );

        if (clearedHoverState) {
          hideSectionTooltip(clearedHoverState.layer);
          restoreSectionLayerWeight(clearedHoverState.sectionId, clearedHoverState.layer);
          scheduleSectionTooltipSync();
        }

        hoveredSectionIdRef.current = nextHoverState.sectionId;
        hoveredSectionLayerRef.current = nextHoverState.layer;
        layer.setStyle({ weight: 6 });
        showSectionTooltip(layer, tooltip, label);
      },
      mouseout: () => {
        if (isLeafletSectionLayerHovered({
          sectionId: hoveredSectionIdRef.current,
          layer: hoveredSectionLayerRef.current,
        }, layer)) {
          clearHoveredSection();
          return;
        }

        restoreSectionLayerWeight(sectionId);
      },
      add: () => {
        hideSectionTooltip(layer);
        scheduleSectionTooltipSync();
      },
      remove: () => {
        if (isLeafletSectionLayerHovered({
          sectionId: hoveredSectionIdRef.current,
          layer: hoveredSectionLayerRef.current,
        }, layer)) {
          hoveredSectionIdRef.current = null;
          hoveredSectionLayerRef.current = null;
        }
        hideSectionTooltip(layer);
        sectionFeatureLayersRef.current.delete(String(sectionValue));
        scheduleSectionTooltipSync();
      },
    });
  }, [
    activateSectionBrowse,
    clearHoveredSection,
    hideSectionTooltip,
    restoreSectionLayerWeight,
    scheduleSectionTooltipSync,
    sectionFilter,
    showSectionTooltip,
  ]);

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
      let layer = null;

      if (!isCustomMapEngineEnabled) {
        layer = L.geoJSON(sanitizedGeoJson, {
          pointToLayer: createTourMarker(definition.key, tourStyles),
          onEachFeature: createOnEachTourFeature(
            definition.key,
            tourName,
            selectBurial,
            handleHoverBurialChange,
            clearHoveredBurialIfCurrent,
            handleOpenDirectionsMenu,
            handlePopupBurialClose,
            handlePopupBurialOpen,
            removeFromResults,
            (browseResult, featureLayer) => {
              tourFeatureLayersRef.current.set(browseResult.id, featureLayer);
            },
            resolveTourBrowseResult,
            schedulePopupLayout,
            () => shouldUseMapPopupsRef.current
          )
        });
      }

      loadedTourNamesRef.current.add(tourName);
      setTourResultsByName((current) => ({
        ...current,
        [tourName]: normalizedTourResults,
      }));
      setTourGeoJsonByName((current) => ({
        ...current,
        [tourName]: sanitizedGeoJson,
      }));
      setTourBoundsByName((current) => ({
        ...current,
        [tourName]: tourBounds,
      }));
      if (layer) {
        setOverlayMaps((current) => ({
          ...current,
          [tourName]: layer
        }));
      }
    } catch (error) {
      console.error('Error loading tour layer:', error);
      setTourLayerError(`Unable to load "${tourName}". Please try again.`);
    } finally {
      loadingTourNamesRef.current.delete(tourName);
      setLoadingTourName((current) => (current === tourName ? '' : current));
    }
  }, [
    clearHoveredBurialIfCurrent,
    handleOpenDirectionsMenu,
    handlePopupBurialClose,
    handlePopupBurialOpen,
    handleHoverBurialChange,
    removeFromResults,
    resolveTourBrowseResult,
    schedulePopupLayout,
    selectBurial,
    isCustomMapEngineEnabled,
    tourDefinitionsByName,
    tourStyles,
  ]);

  /**
   * Load the selected tour layer on demand.
   */
  useEffect(() => {
    if (!selectedTour) return;
    void ensureTourLayerLoaded(selectedTour);
  }, [selectedTour, ensureTourLayerLoaded]);

  useEffect(() => {
    if (!selectedTour || !selectedTourBounds) return;
    if (!isCustomMapEngineEnabled && !selectedTourLayer) return;
    if (isCustomMapEngineEnabled && !selectedTourGeoJson) return;
    focusTourOnMap(selectedTour);
  }, [
    focusTourOnMap,
    isCustomMapEngineEnabled,
    selectedTour,
    selectedTourBounds,
    selectedTourGeoJson,
    selectedTourLayer,
  ]);

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
        fieldPacket={fieldPacket}
        fieldPacketNotice={fieldPacketNotice}
        filterType={filterType}
        getTourName={getTourName}
        hoveredBurialId={hoveredBurialId}
        initialQuery={initialBrowseQuery}
        installPromptEvent={installPromptEvent}
        isFieldPacketsEnabled={isFieldPacketsEnabled}
        isBurialDataLoading={isBurialDataLoading}
        isInstalled={isInstalled}
        isMobile={isMobile}
        isOnline={isOnline}
        isSearchIndexReady={isSearchIndexReady}
        loadingTourName={loadingTourName}
        lotTierFilter={lotTierFilter}
        mapDataError={mapDataError}
        markerColors={MARKER_COLORS}
        rootRef={sidebarOverlayRef}
        onBrowseResultSelect={selectBurial}
        onClearSectionFilters={clearSectionFilters}
        onClearSelectedBurials={clearSelectedBurials}
        onFilterTypeChange={setFilterType}
        onFocusSelectedBurial={handleResultClick}
        onHoverBurialChange={handleHoverBurialChange}
        onOpenExternalDirections={openExternalDirections}
        onLocateMarker={onLocateMarker}
        onLotTierFilterChange={setLotTierFilter}
        onClearFieldPacket={clearFieldPacket}
        onCopyFieldPacketLink={copyFieldPacketLink}
        onInstallApp={handleInstallApp}
        onOpenAppMenu={handleOpenAppMenu}
        onOpenDirectionsMenu={handleOpenDirectionsMenu}
        onRemoveSelectedBurial={removeFromResults}
        onRequestBurialDataLoad={requestBurialDataLoad}
        onSectionChange={activateSectionBrowse}
        onShareFieldPacket={shareFieldPacket}
        onStartRouting={startRouting}
        onStopRouting={stopRouting}
        onToggleSectionMarkers={() => {
          requestBurialDataLoad();
          setShowAllBurials((current) => !current);
        }}
        onTourChange={handleTourSelect}
        onUpdateFieldPacket={updateFieldPacket}
        searchIndex={searchIndex}
        sectionIndex={burialSectionIndex}
        sectionFilter={sectionFilter}
        selectedBurialRefs={selectedBurialRefs}
        selectedBurials={selectedBurials}
        selectedTour={selectedTour}
        showAllBurials={showAllBurials}
        showIosInstallHint={showIosInstallHint}
        sharedLinkLandingState={sharedLinkLandingState}
        status={status}
        tourDefinitions={tourDefinitions}
        tourLayerError={tourLayerError}
        tourResults={selectedTour ? (tourResultsByName[selectedTour] || EMPTY_TOUR_RESULTS) : EMPTY_TOUR_RESULTS}
        tourStyles={tourStyles}
        uniqueSections={uniqueSections}
        iosAppStoreUrl={isAppleMobile ? IOS_APP_STORE_URL : ""}
      />

      <Menu
        anchorEl={appMenuAnchorEl}
        open={appMenuOpen}
        onClose={handleCloseAppMenu}
      >
        {isDev && <MenuItem disabled>{`Renderer: ${mapEngine === "custom" ? "Custom Renderer (Preview)" : "Leaflet (Production)"}`}</MenuItem>}
        {isDev && mapEngine !== "leaflet" && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              handleMapEngineChange("leaflet");
            }}
          >
            Use Leaflet (Production)
          </MenuItem>
        )}
        {isDev && mapEngine !== "custom" && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              handleMapEngineChange("custom");
            }}
          >
            Use Custom Renderer (Preview)
          </MenuItem>
        )}
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
        {isFieldPacketsEnabled && (
          <MenuItem
            disabled={!fieldPacket?.selectedRecords?.length && selectedBurials.length === 0}
            onClick={() => {
              handleCloseAppMenu();
              void copyFieldPacketLink();
            }}
          >
            Copy share link
          </MenuItem>
        )}
        {isFieldPacketsEnabled && fieldPacket?.selectedRecords?.length > 0 && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              clearFieldPacket();
            }}
          >
            Clear saved share details
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

      <RouteStatusOverlay
        isCalculating={isRouteLoading}
        routingError={routeError}
      />

      {isCustomMapEngineEnabled ? (
        <>
        <MapControlStack isMobile={isMobile} hasExpandedPanel={isLayerControlOpen}>
          <MapLayerControl
            basemapOptions={MAP_CONTROLLED_BASEMAPS}
            activeBasemapId={activeBasemap?.id || ""}
            isOpen={isLayerControlOpen}
            onBasemapChange={handleBasemapChange}
            onOpenChange={setIsLayerControlOpen}
            overlayOptions={MAP_OVERLAY_OPTIONS}
            overlayVisibility={overlayVisibility}
            onToggleOverlay={handleToggleOverlay}
          />
          <MapHomeButton onClick={resetMapToDefaultBounds} />
          <MapZoomControl
            isMobile={isMobile}
            onZoomIn={() => mapRef.current?.zoomIn?.()}
            onZoomOut={() => mapRef.current?.zoomOut?.()}
          />
          <MobileLocateButton isMobile={isMobile} onLocate={onLocateMarker} />
          {isDev && SITE_TWIN_CONFIG && (
            <SiteTwinDebugControl
              isOverlayEnabled={overlayVisibility.siteTwin !== false}
              mapEngine={mapEngine}
              manifest={siteTwinManifest}
              loadedSummary={siteTwinLoadedSummary}
              filteredSummary={siteTwinFilteredSummary}
              debugState={normalizedSiteTwinDebugState}
              onToggleOverlay={(checked) => {
                if (checked !== (overlayVisibility.siteTwin !== false)) {
                  handleToggleOverlay("siteTwin");
                }
              }}
              onUpdateDebugState={handleUpdateSiteTwinDebugState}
              onResetDebugState={handleResetSiteTwinDebugState}
            />
          )}
        </MapControlStack>

          <CustomMapSurface
            activeBurialId={activeBurialId}
            basemap={activeBasemap}
            boundaryData={boundaryData}
            defaultCenter={MAP_CENTER}
            defaultZoom={MAP_ZOOM}
            getOverlayElement={getOverlayElement}
            hoveredBurialId={hoveredBurialId}
            lat={lat}
            lng={lng}
            mapRef={mapRef}
            markerColors={MARKER_COLORS}
            maxBounds={PADDED_BOUNDARY_BOUNDS}
            maxZoom={25}
            minZoom={13}
            onActivateSectionBrowse={activateSectionBrowse}
            onHoverBurialChange={handleHoverBurialChange}
            onOpenDirectionsMenu={handleOpenDirectionsMenu}
            onPopupClose={handlePopupBurialClose}
            onPopupOpen={handlePopupBurialOpen}
            onRemoveSelectedBurial={removeFromResults}
            onSelectBurial={selectBurial}
            onZoomChange={handleZoomEnd}
            roadsData={roadsData}
            routeGeoJson={routeGeoJson}
            schedulePopupLayout={schedulePopupLayout}
            sectionBurials={sectionBurials}
            sectionFilter={sectionFilter}
            sectionOverviewMarkers={sectionOverviewMarkers}
            sectionsData={sectionsData}
            selectedBurials={selectedBurials}
            selectedMarkerLayersRef={selectedMarkerLayersRef}
            selectedTourResults={selectedTour ? (tourResultsByName[selectedTour] || EMPTY_TOUR_RESULTS) : EMPTY_TOUR_RESULTS}
            showSiteTwin={overlayVisibility.siteTwin !== false}
            showSiteTwinMonuments={normalizedSiteTwinDebugState.showMonuments}
            showSiteTwinSurface={normalizedSiteTwinDebugState.showSurface}
            shouldUseMapPopups={shouldUseMapPopups}
            showBoundary={overlayVisibility.boundary !== false}
            showAllBurials={showAllBurials}
            showRoads={overlayVisibility.roads !== false}
            showSections={overlayVisibility.sections !== false && showSections}
            showSectionOverviewMarkers={overlayVisibility.sections !== false && showSectionOverviewMarkers}
            siteTwinCandidates={filteredSiteTwinCandidates}
            siteTwinMonumentHeightScale={normalizedSiteTwinDebugState.monumentHeightScale}
            siteTwinManifest={siteTwinManifest}
            siteTwinSurfaceOpacity={siteTwinSurfaceOpacity}
            tourFeatureLayersRef={tourFeatureLayersRef}
            tourStyles={tourStyles}
          />
        </>
      ) : (
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          className="map"
          attributionControl={false}
          zoomControl={false}
          fadeAnimation={!shouldReduceMapMotion}
          maxZoom={25}
          markerZoomAnimation={!shouldReduceMapMotion}
          zoomAnimation={!shouldReduceMapMotion}
        >
          <MapStaticLayers
            activeBasemap={activeBasemap}
            boundaryData={boundaryData}
            burialRecordsByObjectId={burialRecordsByObjectId}
            fitMapBoundsInViewport={fitMapBoundsInViewport}
            getSectionStyle={getSectionStyle}
            isDev={isDev}
            isLayerControlOpen={isLayerControlOpen}
            isMobile={isMobile}
            isPmtilesEnabled={isPmtilesEnabled}
            mapEngine={mapEngine}
            mapRef={mapRef}
            onBasemapChange={handleBasemapChange}
            onEachSectionFeature={onEachSectionFeature}
            onLayerControlOpenChange={setIsLayerControlOpen}
            onLocateMarker={onLocateMarker}
            onResetSiteTwinDebugState={handleResetSiteTwinDebugState}
            onSelectSection={activateSectionBrowse}
            onToggleOverlay={handleToggleOverlay}
            onSelectBurial={selectBurial}
            onUpdateSiteTwinDebugState={handleUpdateSiteTwinDebugState}
            overlayVisibility={overlayVisibility}
            overlayMaps={overlayMaps}
            roadsData={roadsData}
            sectionsData={sectionsData}
            siteTwinDebugState={normalizedSiteTwinDebugState}
            siteTwinFilteredSummary={siteTwinFilteredSummary}
            siteTwinLoadedSummary={siteTwinLoadedSummary}
            siteTwinManifest={siteTwinManifest}
            showSiteTwinSurface={normalizedSiteTwinDebugState.showSurface}
            siteTwinSurfaceOpacity={siteTwinSurfaceOpacity}
            sectionOverviewMarkers={sectionOverviewMarkers}
            selectedTour={selectedTour}
            showSections={overlayVisibility.sections && showSections}
            showSectionOverviewMarkers={overlayVisibility.sections && showSectionOverviewMarkers}
            tourNames={tourNames}
          />

          {lat && lng && (
            <Marker position={[lat, lng]}>
              <Popup>You are here.</Popup>
            </Marker>
          )}

          {routeGeoJson && (
            <GeoJSON
              data={routeGeoJson}
              style={ROUTE_LINE_STYLE}
            />
          )}

          {selectedBurials.map((burial, index) => (
            <Marker
              key={createUniqueKey(burial, index)}
              ref={(layer) => {
                if (layer) {
                  selectedMarkerLayersRef.current.set(burial.id, layer);
                  syncLeafletSelectedMarkerIcon(burial.id, layer);
                } else {
                  selectedMarkerLayersRef.current.delete(burial.id);
                }
              }}
              position={[burial.coordinates[1], burial.coordinates[0]]}
              icon={createNumberedIcon(index + 1)}
              keyboard={false}
              eventHandlers={{
                mouseover: () => handleHoverBurialChange(burial.id),
                mouseout: () => clearHoveredBurialIfCurrent(burial.id),
                click: () => handleMarkerClick(burial),
                popupopen: ({ popup }) => {
                  handlePopupBurialOpen(burial);
                  schedulePopupLayout(popup);
                },
                popupclose: () => {
                  handlePopupBurialClose(burial);
                },
              }}
              zIndexOffset={1000}
            >
              {shouldUseMapPopups && burial.source !== "tour" && (
                <Popup>
                  <PopupCardContent
                    record={burial}
                    onOpenDirectionsMenu={(event) => handleOpenDirectionsMenu(event, burial)}
                    onRemove={() => {
                      removeFromResults(burial.id);
                    }}
                    schedulePopupLayout={schedulePopupLayout}
                    getPopup={() => selectedMarkerLayersRef.current.get(burial.id)?.getPopup?.()}
                  />
                </Popup>
              )}
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
