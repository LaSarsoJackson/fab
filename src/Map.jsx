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
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

// Material-UI Components and Icons
import {
  Menu,
  MenuItem,
  useMediaQuery,
} from "@mui/material";
import DirectionsIcon from '@mui/icons-material/Directions';
import LaunchIcon from '@mui/icons-material/Launch';

// Local Data and Styles
import { APP_PROFILE } from "./features/fab/profile";
import BurialSidebar from "./BurialSidebar";
import {
  buildBurialSectionIndex,
  buildBurialBrowseResult,
  buildTourBrowseResult,
  filterBurialRecordsBySection,
  formatBrowseResultName,
} from "./features/browse/browseResults";
import {
  buildSearchIndex,
  smartSearch,
  sortSectionValues,
} from "./features/browse/burialSearch";
import {
  areLocationCandidatesEquivalent,
  buildLocationAccuracyGeoJson,
  clearMapSelectionFocus,
  clearMapSelectionFocusForRecord,
  createMapSelectionState,
  buildSectionAffordanceMarkers,
  buildSectionBoundsById,
  buildSectionOverviewMarkers,
  beginLeafletSectionHover,
  clearLeafletSectionHover,
  focusMapSelectionRecord,
  formatSectionOverviewMarkerLabel,
  MAP_PRESENTATION_POLICY,
  getSectionBurialMarkerStyle,
  getSectionPolygonStyle,
  hasIndexedBurialPlacement,
  LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS,
  LOCATION_RECENT_FIX_WINDOW_MS,
  normalizeLocationPosition,
  inferPointerType,
  isLeafletSectionLayerHovered,
  isTouchLikePointerType,
  PMTILES_EXPERIMENT_GLYPH_PALETTE,
  ROAD_LAYER_STYLE,
  reduceMapSelectionState,
  refreshMapSelectionRecords,
  removeMapSelectionRecord,
  replaceMapSelectionRecords,
  resolveClusterExpansionZoom,
  resolveMapPresentationPolicy,
  selectBestRecentLocationCandidate,
  shouldShowPersistentSectionTooltips,
  shouldRejectLocationCandidate,
  smoothLocationCandidate,
  shouldHandleSectionHover,
  shouldIgnoreSectionBackgroundSelection,
  resetMapSelection,
  setMapSelectionHover,
  ExperimentalBurialGlyphSymbolizer,
} from "./features/map/mapDomain";
import { getEmptyCoreMapData, loadCoreMapData } from "./features/map/coreMapData";
import {
  ActiveLeafletBasemap,
  CustomZoomControl,
  DefaultExtentButton,
  fitBoundsInVisibleViewport,
  LeafletGeoJsonLayer,
  MapBounds,
  MapControlStack,
  MapController,
  MapHomeButton,
  MapLayerControl,
  MapZoomControl,
  MobileLocateButton,
  PmtilesExperimentLegend,
  RouteStatusOverlay,
  panIntoVisibleViewport,
  schedulePopupInView,
  SiteTwinDebugControl,
} from "./features/map/mapChrome";
import { cleanRecordValue } from "./features/map/mapRecordPresentation";
import { PopupCardContent, createMapRecordKey } from "./features/map/popupCardContent";
import { calculateWalkingRoute, getRoutingErrorMessage, buildRoadRoutingGraph } from "./features/map/mapRouting";
import { CustomMapSurface } from "./features/map/engine/CustomMapSurface";
import {
  buildFieldPacketShareUrl,
  buildFieldPacketState,
} from "./features/deeplinks/fieldPackets";
import { buildSharedSelectionPresentation } from "./features/deeplinks/sharePresentation";
import {
  parseDeepLinkState,
} from "./features/deeplinks/urlState";
import {
  buildBurialLookup,
  harmonizeBurialBrowseResult,
  harmonizeTourBrowseResult,
} from "./features/tours/tourRecordHarmonization";
import { TOUR_DEFINITIONS, TOUR_STYLES } from "./features/fab/profile";
import { getGeoJsonBounds, hasValidGeoJsonCoordinates, isLatLngBoundsExpressionValid } from "./shared/geo/geoJsonBounds";
import { buildDirectionsLink } from "./shared/routing";
import {
  cancelIdleTask,
  buildPublicAssetUrl,
  DEVELOPMENT_SURFACES,
  getDevelopmentRoutingProvider,
  getMapEngineKind,
  getRuntimeEnv,
  isFieldPacketsEnabled as resolveFieldPacketsEnabled,
  scheduleIdleTask,
  setStoredDevelopmentSurfaceOverride,
  syncDocumentMetadata,
} from "./shared/runtime/runtimeEnv";
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
 * Colors used for numbered markers in search results
 * Cycles through these colors for multiple markers
 */
const MARKER_COLORS = [
  "#2f6b57",
  "#547487",
  "#8a6848",
  "#6f5c78",
  "#63745d",
  "#885c56",
];

const FOCUS_ZOOM_LEVEL = MAP_PRESENTATION_POLICY.burialFocusMinZoom;

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

const ROUTE_LINE_STYLE = {
  color: "#0f67c6",
  weight: 5,
  opacity: 0.86,
};

const LOCATION_ACCURACY_STYLE = {
  color: "#185e4a",
  weight: 2,
  opacity: 0.72,
  fillColor: "#2f8f73",
  fillOpacity: 0.16,
};

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
const GEOLOCATION_REQUEST_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20000,
};
const PMTILES_EXPERIMENT_SURFACE = DEVELOPMENT_SURFACES.pmtilesExperiment;
const SECTION_MARKER_BATCH_SIZE = 300;
const SEARCH_INDEX_PUBLIC_PATH = APP_PROFILE.artifacts.searchIndexPublicPath;
const EMPTY_TOUR_RESULTS = [];
const MAP_BASEMAPS = APP_PROFILE.map.basemaps || [];
const MAP_CONTROLLED_BASEMAPS = MAP_BASEMAPS.filter((basemap) => basemap.type !== "pmtiles-vector");
const DEFAULT_BASEMAP_ID = APP_PROFILE.map.defaultBasemapId || MAP_BASEMAPS[0]?.id || "";
const DEFAULT_MAX_MAP_ZOOM = MAP_BASEMAPS.reduce((highestZoom, basemap) => (
  Number.isFinite(basemap?.maxZoom)
    ? Math.max(highestZoom, basemap.maxZoom)
    : highestZoom
), MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom);
const SITE_TWIN_CONFIG = APP_PROFILE.map.siteTwin || null;
const SITE_TWIN_DEBUG_STORAGE_KEY = APP_PROFILE.devStorageKeys.siteTwinDebug;
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
const CEMETERY_CLUSTER_GLYPH = `
  <svg class="cemetery-cluster__glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path
      d="M10 27V12.5C10 8.91 12.91 6 16.5 6S23 8.91 23 12.5V27H25.5V29H7.5V27H10Z"
      fill="#657b72"
      fill-opacity="0.78"
      stroke="rgba(47, 75, 67, 0.78)"
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
const SECTION_AFFORDANCE_GLYPH = `
  <svg class="section-affordance__glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path
      d="M10 27V12.5C10 8.91 12.91 6 16.5 6S23 8.91 23 12.5V27H25.5V29H7.5V27H10Z"
      fill="rgba(108, 121, 131, 0.32)"
      stroke="rgba(242, 247, 249, 0.82)"
      stroke-width="1.35"
      stroke-linejoin="round"
    />
    <path
      d="M13.2 12.2H19.8"
      stroke="rgba(255,255,255,0.82)"
      stroke-width="1.35"
      stroke-linecap="round"
    />
    <path
      d="M16.5 9.4V15"
      stroke="rgba(255,255,255,0.82)"
      stroke-width="1.35"
      stroke-linecap="round"
    />
  </svg>
`;
let sectionAffordanceIcon = null;

const getSectionAffordanceIcon = () => {
  if (!sectionAffordanceIcon) {
    sectionAffordanceIcon = L.divIcon({
      html: `<div class="section-affordance">${SECTION_AFFORDANCE_GLYPH}</div>`,
      className: "section-affordance-icon",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  return sectionAffordanceIcon;
};

const isRenderableBounds = (bounds) => (
  isLatLngBoundsExpressionValid(bounds) ||
  (typeof bounds?.isValid === "function" && bounds.isValid())
);

const getMapMaxZoom = (basemap) => (
  Number.isFinite(basemap?.maxZoom) ? basemap.maxZoom : DEFAULT_MAX_MAP_ZOOM
);

const getSectionBurialMarkerId = (burial) => {
  const properties = burial?.properties || burial || {};
  return burial?.id || properties.id || createMapRecordKey(properties);
};

//=============================================================================
// React Components
//=============================================================================

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
          <Tooltip
            direction="top"
            offset={[0, -6]}
            className="section-label section-label--overview"
          >
            {formatSectionOverviewMarkerLabel(marker)}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
});

const MapSectionAffordanceMarkers = memo(function MapSectionAffordanceMarkers({
  markers,
  onSelectSection,
}) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={getSectionAffordanceIcon()}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="section-label section-label--overview"
          >
            {`View graves in section ${marker.sectionValue}`}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
});

/**
 * Keep the basemap and static overlays off the render path for selection/menu state.
 */
const MapStaticLayers = memo(function MapStaticLayers({
  activeBasemap,
  activeBasemapMaxZoom,
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
  sectionAffordanceMarkers,
  sectionOverviewMarkers,
  selectedTour,
  showRoads,
  showSectionAffordanceMarkers,
  showSections,
  showSectionOverviewMarkers,
  tourNames,
}) {
  return (
    <>
      <MapControlStack isMobile={isMobile}>
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
        <DefaultExtentButton
          defaultViewBounds={DEFAULT_VIEW_BOUNDS}
          fitMapBounds={fitMapBoundsInViewport}
        />
        <CustomZoomControl isMobile={isMobile} />
        <MobileLocateButton isMobile={isMobile} onLocate={onLocateMarker} />
        {isDev && isPmtilesEnabled && (
          <PmtilesExperimentLegend glyphPalette={PMTILES_EXPERIMENT_GLYPH_PALETTE} />
        )}
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
      <MapBounds
        fitMapBounds={fitMapBoundsInViewport}
        paddedBoundaryBounds={PADDED_BOUNDARY_BOUNDS}
        maxZoom={activeBasemapMaxZoom}
      />
      <MapController mapRef={mapRef} />
      <MapTourController selectedTour={selectedTour} overlayMaps={overlayMaps} tourNames={tourNames} />
      {overlayVisibility.siteTwin && showSiteTwinSurface && isSiteTwinReady(siteTwinManifest) && (
        <ImageOverlay
          url={buildPublicAssetUrl(siteTwinManifest.terrainImage.url)}
          bounds={siteTwinManifest.terrainImage.bounds}
          opacity={siteTwinSurfaceOpacity}
          interactive={false}
        />
      )}
      {showRoads && (
        <LeafletGeoJsonLayer
          layerId="roads"
          data={roadsData}
          style={ROAD_LAYER_STYLE}
        />
      )}
      {overlayVisibility.boundary && (
        <LeafletGeoJsonLayer
          layerId="boundary"
          data={boundaryData}
          style={exteriorStyle}
        />
      )}
      {showSections && (
        <LeafletGeoJsonLayer
          layerId="sections"
          data={sectionsData}
          style={getSectionStyle}
          onEachFeature={onEachSectionFeature}
        />
      )}
      {showSectionAffordanceMarkers && (
        <MapSectionAffordanceMarkers
          markers={sectionAffordanceMarkers}
          onSelectSection={onSelectSection}
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
    devSurfaces,
    featureFlags,
  } = runtimeEnv;
  const routingProvider = getDevelopmentRoutingProvider(devSurfaces);
  const isFieldPacketsEnabled = resolveFieldPacketsEnabled(featureFlags);
  const tourDefinitions = TOUR_DEFINITIONS;
  const tourStyles = TOUR_STYLES;
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
  const [mapEngine, setMapEngine] = useState(() => getMapEngineKind(devSurfaces));
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
  const [isPmtilesEnabled, setIsPmtilesEnabled] = useState(() => Boolean(devSurfaces.pmtilesExperiment));
  const [hasRequestedBurialData, setHasRequestedBurialData] = useState(false);
  const [fieldPacket, setFieldPacket] = useState(null);
  const [fieldPacketNotice, setFieldPacketNotice] = useState(null);
  const [sharedLinkLandingState, setSharedLinkLandingState] = useState(null);
  const [uniqueSections, setUniqueSections] = useState([]);

  // Location and Routing State
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState(null);
  const [status, setStatus] = useState(LOCATION_MESSAGES.inactive);
  const [routingOrigin, setRoutingOrigin] = useState(null);
  const [routingDestination, setRoutingDestination] = useState(null);
  const [routeGeoJson, setRouteGeoJson] = useState(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [activeRouteBurialId, setActiveRouteBurialId] = useState(null);
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
  const hoveredSectionMarkerIdRef = useRef(null);
  const activeBurialIdRef = useRef(null);
  const hoveredBurialIdRef = useRef(null);
  const currentZoomRef = useRef(MAP_ZOOM);
  const sectionBurialIndividualMarkerMinZoomRef = useRef(
    MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom
  );
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
  const watchIdRef = useRef(null);
  const acceptedLocationRef = useRef(null);
  const locationRecentCandidatesRef = useRef([]);
  const selectedLocationFixRef = useRef(null);
  const focusLocationOnNextAcceptedFixRef = useRef(false);

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
  const isCustomMapRuntimeActive = mapEngine === "custom";
  const selectedMarkerOrderById = useMemo(
    () => new Map(selectedBurials.map((burial, index) => [burial.id, index + 1])),
    [selectedBurials]
  );
  const locationAccuracyGeoJson = useMemo(() => buildLocationAccuracyGeoJson(
    Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(locationAccuracyMeters)
      ? {
        latitude: lat,
        longitude: lng,
        accuracyMeters: locationAccuracyMeters,
      }
      : null
  ), [lat, lng, locationAccuracyMeters]);
  const trackedLocation = useMemo(() => (
    Number.isFinite(lat) && Number.isFinite(lng)
      ? {
        latitude: lat,
        longitude: lng,
        accuracyMeters: locationAccuracyMeters,
      }
      : null
  ), [lat, lng, locationAccuracyMeters]);

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
  const activeBasemapMaxZoom = useMemo(
    () => getMapMaxZoom(activeBasemap),
    [activeBasemap]
  );
  const hasActiveRoute = Boolean(routeGeoJson?.features?.length);
  const mapPresentationPolicy = useMemo(() => resolveMapPresentationPolicy({
    currentZoom,
    hasActiveRoute,
    hasTrackedLocation: Boolean(trackedLocation),
    maxZoom: activeBasemapMaxZoom,
    roadOverlayVisible: overlayVisibility.roads === true,
    sectionFilter,
    selectedTour,
  }), [
    activeBasemapMaxZoom,
    currentZoom,
    hasActiveRoute,
    overlayVisibility.roads,
    sectionFilter,
    selectedTour,
    trackedLocation,
  ]);
  const {
    sectionBrowseFocusMaxZoom,
    sectionBurialClusterRadius,
    sectionBurialDisableClusteringZoom,
    sectionBurialIndividualMarkerMinZoom,
    sectionDetailMinZoom,
    showRoads,
    showSectionAffordanceMarkers,
    showSectionOverviewMarkers,
    showSections,
  } = mapPresentationPolicy;
  currentZoomRef.current = currentZoom;
  sectionBurialIndividualMarkerMinZoomRef.current = sectionBurialIndividualMarkerMinZoom;
  const sectionBurialPresentationBand = currentZoom >= sectionBurialIndividualMarkerMinZoom
    ? "individual"
    : currentZoom >= sectionBurialIndividualMarkerMinZoom - 1
      ? "preview"
      : "cluster";
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

      setStoredDevelopmentSurfaceOverride(
        DEVELOPMENT_SURFACES.customMapEngine.id,
        nextEngine === "custom"
      );
      return nextEngine;
    });
  }, [isDev]);
  const getMapInstance = useCallback(() => mapRef.current, []);
  const dispatchSelectionAction = useCallback((action) => {
    setSelectionState((currentSelectionState) => {
      const nextSelectionState = reduceMapSelectionState(currentSelectionState, action);
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
    dispatchSelectionAction(clearMapSelectionFocus({ clearHover }));

    if (closePopup) {
      closeMapPopup();
    }
  }, [closeMapPopup, dispatchSelectionAction]);

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
    if (!isDev) {
      setIsPmtilesEnabled(false);
      return;
    }

    setStoredDevelopmentSurfaceOverride(
      PMTILES_EXPERIMENT_SURFACE.id,
      isPmtilesEnabled
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
  const sectionAffordanceMarkers = useMemo(
    () => buildSectionAffordanceMarkers(sectionsData),
    [sectionsData]
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
  const resetLocationCandidateWindow = useCallback(() => {
    locationRecentCandidatesRef.current = [];
    selectedLocationFixRef.current = null;
  }, []);

  const clearAcceptedLocation = useCallback((nextStatus = LOCATION_MESSAGES.inactive) => {
    acceptedLocationRef.current = null;
    resetLocationCandidateWindow();
    setStatus(nextStatus);
    setLat(null);
    setLng(null);
    setLocationAccuracyMeters(null);
  }, [resetLocationCandidateWindow]);

  const commitAcceptedLocation = useCallback((location) => {
    if (!location) {
      return null;
    }

    acceptedLocationRef.current = location;
    setStatus(LOCATION_MESSAGES.active);
    setLat(location.latitude);
    setLng(location.longitude);
    setLocationAccuracyMeters(location.accuracyMeters);

    if (activeRouteBurialIdRef.current) {
      setRoutingOrigin([location.latitude, location.longitude]);
    }

    return location;
  }, []);

  const updateLocationFromPosition = useCallback((position) => {
    const candidate = normalizeLocationPosition(position);
    if (!candidate) {
      return acceptedLocationRef.current;
    }

    const currentPoint = point([candidate.longitude, candidate.latitude]);
    const isWithinBuffer = booleanPointInPolygon(currentPoint, LOCATION_BUFFER_BOUNDARY);

    if (!isWithinBuffer) {
      if (acceptedLocationRef.current) {
        return acceptedLocationRef.current;
      }

      clearAcceptedLocation(LOCATION_MESSAGES.outOfBounds);
      return null;
    }

    const maxAcceptedAccuracyMeters = acceptedLocationRef.current
      ? undefined
      : LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS;

    if (shouldRejectLocationCandidate(candidate, { maxAcceptedAccuracyMeters })) {
      return acceptedLocationRef.current;
    }

    const cutoff = candidate.recordedAt - LOCATION_RECENT_FIX_WINDOW_MS;
    const nextCandidates = locationRecentCandidatesRef.current
      .filter((entry) => Number(entry?.recordedAt) >= cutoff);
    nextCandidates.push(candidate);
    locationRecentCandidatesRef.current = nextCandidates;

    const nextBestCandidate = selectBestRecentLocationCandidate(nextCandidates);
    if (!nextBestCandidate) {
      return acceptedLocationRef.current;
    }

    if (areLocationCandidatesEquivalent(selectedLocationFixRef.current, nextBestCandidate)) {
      return acceptedLocationRef.current;
    }

    selectedLocationFixRef.current = nextBestCandidate;

    return commitAcceptedLocation(
      smoothLocationCandidate(acceptedLocationRef.current, nextBestCandidate)
    );
  }, [clearAcceptedLocation, commitAcceptedLocation]);

  const handleLocationError = useCallback((error) => {
    if (!acceptedLocationRef.current) {
      setStatus(LOCATION_MESSAGES.unavailable);
    }
    console.error('Geolocation error:', error);
    return acceptedLocationRef.current;
  }, []);

  const waitForAcceptedLocation = useCallback((timeoutMs = GEOLOCATION_REQUEST_OPTIONS.timeout) => new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    const startedAt = Date.now();

    const poll = () => {
      if (acceptedLocationRef.current) {
        resolve(acceptedLocationRef.current);
        return;
      }

      if ((Date.now() - startedAt) >= timeoutMs) {
        resolve(null);
        return;
      }

      window.setTimeout(poll, 250);
    };

    poll();
  }), []);

  const requestCurrentLocation = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) {
      setStatus(LOCATION_MESSAGES.unsupported);
      resolve(null);
      return;
    }

    setStatus(LOCATION_MESSAGES.locating);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = updateLocationFromPosition(position);
        if (nextLocation || watchIdRef.current === null) {
          resolve(nextLocation);
          return;
        }

        void waitForAcceptedLocation().then(resolve);
      },
      (error) => {
        const fallbackLocation = handleLocationError(error);
        if (fallbackLocation || watchIdRef.current === null) {
          resolve(fallbackLocation);
          return;
        }

        void waitForAcceptedLocation().then((nextLocation) => {
          resolve(nextLocation || fallbackLocation);
        });
      },
      GEOLOCATION_REQUEST_OPTIONS
    );
  }), [handleLocationError, updateLocationFromPosition, waitForAcceptedLocation]);

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
      sectionDetailMinZoom
    );

    map.setView(targetLatLng, targetZoom, { animate });
    panMapIntoViewport(map, targetLatLng, { animate: false });
  }, [getMapInstance, panMapIntoViewport, sectionDetailMinZoom, shouldReduceMapMotion]);

  const ensureLocationWatchActive = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus(LOCATION_MESSAGES.unsupported);
      return null;
    }

    if (watchIdRef.current !== null) {
      return watchIdRef.current;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = updateLocationFromPosition(position);
        if (nextLocation && focusLocationOnNextAcceptedFixRef.current) {
          focusLocationOnNextAcceptedFixRef.current = false;
          focusUserLocationOnMap(nextLocation);
        }
      },
      (error) => {
        handleLocationError(error);
      },
      GEOLOCATION_REQUEST_OPTIONS
    );

    watchIdRef.current = watchId;
    return watchId;
  }, [focusUserLocationOnMap, handleLocationError, updateLocationFromPosition]);

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const onLocateMarker = useCallback(async () => {
    focusLocationOnNextAcceptedFixRef.current = true;
    resetLocationCandidateWindow();
    ensureLocationWatchActive();

    const location = await requestCurrentLocation();
    if (location) {
      focusLocationOnNextAcceptedFixRef.current = false;
      focusUserLocationOnMap(location);
    }
  }, [
    ensureLocationWatchActive,
    focusUserLocationOnMap,
    requestCurrentLocation,
    resetLocationCandidateWindow,
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

    dispatchSelectionAction(clearMapSelectionFocusForRecord(burialId));
  }, [dispatchSelectionAction]);

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

    dispatchSelectionAction(focusMapSelectionRecord(burial));

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

      const targetZoom = Math.min(
        getMapMaxZoom(activeBasemap),
        Math.max(map.getZoom(), FOCUS_ZOOM_LEVEL)
      );
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
  }, [activeBasemap, dispatchSelectionAction, focusBurialPopup, getMapInstance, panMapIntoViewport]);

  const selectBurial = useCallback((burial, options = {}) => {
    focusBurial(burial, options);
  }, [focusBurial]);

  /**
   * Removes a burial from search results
   */
  const removeFromResults = useCallback((burialId) => {
    dispatchSelectionAction(removeMapSelectionRecord(burialId));

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
  }, [dispatchSelectionAction]);

  /**
   * Clears all search results
   */
  const clearSelectedBurials = useCallback(() => {
    dispatchSelectionAction(resetMapSelection());
    setRoutingOrigin(null);
    setRoutingDestination(null);
    setRouteGeoJson(null);
    setIsRouteLoading(false);
    setRouteError("");
    setActiveRouteBurialId(null);
    setDirectionsMenuAnchorEl(null);
    setDirectionsMenuBurial(null);
    closeMapPopup();
  }, [closeMapPopup, dispatchSelectionAction]);

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
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: sectionBurialClusterRadius,
      disableClusteringAtZoom: sectionBurialDisableClusteringZoom,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
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

    clusterGroup.on("clusterclick", (event) => {
      const map = clusterGroup._map || event?.target?._map;
      const cluster = event?.layer;
      const clusterBounds = cluster?.getBounds?.();

      if (!map || !clusterBounds) {
        return;
      }

      event?.originalEvent?.preventDefault?.();
      const targetZoom = resolveClusterExpansionZoom({
        currentZoom: map.getZoom?.(),
        disableClusteringAtZoom: sectionBurialDisableClusteringZoom,
      });
      const targetLatLng = cluster.getLatLng?.() || clusterBounds.getCenter?.();

      clusterGroup.eachLayer?.((marker) => {
        const burial = marker?.burialRecord;
        if (!marker || !burial || typeof marker.setStyle !== "function") {
          return;
        }

        marker.setStyle(getSectionBurialMarkerStyle(burial, {
          currentZoom: targetZoom,
          individualMarkerMinZoom: sectionBurialIndividualMarkerMinZoomRef.current,
        }));
      });

      if (targetLatLng && targetZoom > map.getZoom()) {
        map.setView(targetLatLng, targetZoom, { animate: !shouldReduceMapMotion });
        return;
      }

      fitMapBoundsInViewport(map, clusterBounds, {
        animate: !shouldReduceMapMotion,
        maxZoom: targetZoom,
      });
    });

    return clusterGroup;
  }, [
    fitMapBoundsInViewport,
    sectionBurialClusterRadius,
    sectionBurialDisableClusteringZoom,
    shouldReduceMapMotion,
  ]);

  const getSectionBurialPresentationZoom = useCallback(() => {
    const map = getMapInstance();
    const mapZoom = map?.getZoom?.();
    return Number.isFinite(mapZoom) ? mapZoom : currentZoomRef.current;
  }, [getMapInstance]);

  const syncInteractiveSectionMarkers = useCallback((nextActiveId, nextHoveredId) => {
    const sectionMarkers = sectionMarkersByIdRef.current;
    const markerIdsToSync = new Set([
      activeSectionMarkerIdRef.current,
      hoveredSectionMarkerIdRef.current,
      nextActiveId,
      nextHoveredId,
    ].filter(Boolean));

    markerIdsToSync.forEach((markerId) => {
      const marker = sectionMarkers.get(markerId);
      const burial = marker?.burialRecord;

      if (!marker || !burial) {
        return;
      }

      const isActive = markerId === nextActiveId;
      const isHovered = !isActive && markerId === nextHoveredId;

      marker.setStyle(getSectionBurialMarkerStyle(burial, {
        currentZoom: getSectionBurialPresentationZoom(),
        individualMarkerMinZoom: sectionBurialIndividualMarkerMinZoomRef.current,
        isActive,
        isHovered,
      }));

      if ((isActive || isHovered) && typeof marker.bringToFront === "function") {
        marker.bringToFront();
      }
    });

    activeSectionMarkerIdRef.current = nextActiveId || null;
    hoveredSectionMarkerIdRef.current = nextHoveredId || null;
  }, [getSectionBurialPresentationZoom]);

  const syncAllSectionMarkerPresentation = useCallback(() => {
    const markersToSync = new Set(sectionMarkersByIdRef.current.values());
    markerClusterRef.current?.eachLayer?.((marker) => {
      markersToSync.add(marker);
    });

    markersToSync.forEach((marker) => {
      const burial = marker?.burialRecord;
      if (!marker || !burial) {
        return;
      }

      const markerId = getSectionBurialMarkerId(burial);
      const burialId = burial.id || markerId;
      const isActive = activeBurialIdRef.current === burialId || activeBurialIdRef.current === markerId;
      const isHovered = !isActive && (
        hoveredBurialIdRef.current === burialId ||
        hoveredBurialIdRef.current === markerId
      );
      marker.setStyle(getSectionBurialMarkerStyle(burial, {
        currentZoom: getSectionBurialPresentationZoom(),
        individualMarkerMinZoom: sectionBurialIndividualMarkerMinZoomRef.current,
        isActive,
        isHovered,
      }));
    });
  }, [getSectionBurialPresentationZoom]);

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
    sectionFeatureLayersRef.current.forEach(({ layer, tooltip, label }) => {
      const shouldShowTooltip = shouldShowPersistentSectionTooltips({
        currentZoom: zoom,
        sectionDetailMinZoom,
        showAllBurials,
      });

      if (shouldShowTooltip) {
        showSectionTooltip(layer, tooltip, label);
        return;
      }

      hideSectionTooltip(layer);
    });
  }, [getMapInstance, hideSectionTooltip, sectionDetailMinZoom, showAllBurials, showSectionTooltip]);

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

  const restoreSectionLayerStyle = useCallback((sectionId, layerOverride = null) => {
    const section = sectionFeatureLayersRef.current.get(String(sectionId));
    const targetLayer = layerOverride || section?.layer;
    if (!targetLayer) return;

    targetLayer.setStyle(getSectionPolygonStyle({
      sectionId,
      activeSectionId: sectionFilter,
      showAllBurials,
    }));
  }, [sectionFilter, showAllBurials]);

  const clearHoveredSection = useCallback(() => {
    const { clearedHoverState } = clearLeafletSectionHover({
      sectionId: hoveredSectionIdRef.current,
      layer: hoveredSectionLayerRef.current,
    });
    if (!clearedHoverState) return;

    hoveredSectionIdRef.current = null;
    hoveredSectionLayerRef.current = null;

    hideSectionTooltip(clearedHoverState.layer);
    restoreSectionLayerStyle(clearedHoverState.sectionId, clearedHoverState.layer);

    scheduleSectionTooltipSync();
  }, [
    hideSectionTooltip,
    restoreSectionLayerStyle,
    scheduleSectionTooltipSync,
  ]);

  const handleHoverBurialChange = useCallback((nextBurialId) => {
    dispatchSelectionAction(setMapSelectionHover(nextBurialId));
  }, [dispatchSelectionAction]);

  const clearHoveredBurialIfCurrent = useCallback((burialId) => {
    if (!burialId) {
      handleHoverBurialChange(null);
      return;
    }

    if (hoveredBurialIdRef.current === burialId) {
      dispatchSelectionAction(setMapSelectionHover(null));
    }
  }, [dispatchSelectionAction, handleHoverBurialChange]);

  const syncLeafletSelectedMarkerIcon = useCallback((burialId, layerOverride = null) => {
    if (isCustomMapRuntimeActive || !burialId) {
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
  }, [isCustomMapRuntimeActive, selectedMarkerOrderById]);

  const syncLeafletSelectedMarkerIcons = useCallback(() => {
    if (isCustomMapRuntimeActive) {
      return;
    }

    selectedMarkerOrderById.forEach((_, burialId) => {
      syncLeafletSelectedMarkerIcon(burialId);
    });
  }, [isCustomMapRuntimeActive, selectedMarkerOrderById, syncLeafletSelectedMarkerIcon]);

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

    resetLocationCandidateWindow();
    ensureLocationWatchActive();

    const location = acceptedLocationRef.current || await requestCurrentLocation();

    if (!location) {
      return;
    }

    selectBurial(burial, {
      animate: false,
      openTourPopup: true,
    });

    setRouteError("");
    setRoutingOrigin([location.latitude, location.longitude]);
    setRoutingDestination([burial.coordinates[1], burial.coordinates[0]]);
    setActiveRouteBurialId(burial.id);
  }, [
    ensureLocationWatchActive,
    requestCurrentLocation,
    resetLocationCandidateWindow,
    selectBurial,
  ]);

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
            maxZoom: sectionBurialIndividualMarkerMinZoom,
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
    sectionBurialIndividualMarkerMinZoom,
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

    dispatchSelectionAction(refreshMapSelectionRecords((burial) => {
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

      return latest;
    }));

    setDirectionsMenuBurial((current) => {
      if (current?.source !== "burial") return current;

      const latest = burialRecordsById.get(current.id);
      return latest || current;
    });
  }, [burialRecordsById, dispatchSelectionAction]);

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
    return stopLocationWatch;
  }, [stopLocationWatch]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && watchIdRef.current !== null) {
        void requestCurrentLocation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestCurrentLocation]);

  const buildSectionMarker = useCallback((burial) => {
    if (!Array.isArray(burial.coordinates)) {
      return null;
    }

    const isActive = activeBurialIdRef.current === burial.id;
    const isHovered = !isActive && hoveredBurialIdRef.current === burial.id;
    const marker = L.circleMarker(
      [burial.coordinates[1], burial.coordinates[0]],
      getSectionBurialMarkerStyle(burial, {
        currentZoom: getSectionBurialPresentationZoom(),
        individualMarkerMinZoom: sectionBurialIndividualMarkerMinZoomRef.current,
        isActive,
        isHovered,
      })
    );
    marker.burialRecord = burial;

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
    getSectionBurialPresentationZoom,
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
    if (isCustomMapRuntimeActive) {
      sectionMarkersByIdRef.current = new Map();
      activeSectionMarkerIdRef.current = null;
      hoveredSectionMarkerIdRef.current = null;
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
    hoveredSectionMarkerIdRef.current = null;
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

        nextSectionMarkers.set(getSectionBurialMarkerId(burial), marker);
        batchMarkers.push(marker);
      }

      if (batchMarkers.length > 0) {
        clusterGroup.addLayers(batchMarkers);
        syncInteractiveSectionMarkers(activeBurialIdRef.current, hoveredBurialIdRef.current);
      }

      if (nextIndex < sectionBurials.length) {
        handle = scheduleIdleTask(addNextMarkerBatch, {
          timeout: 250,
          fallbackDelay: 16,
        });
        return;
      }

      handle = null;
      syncInteractiveSectionMarkers(activeBurialIdRef.current, hoveredBurialIdRef.current);
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
      hoveredSectionMarkerIdRef.current = null;
      clusterGroup.clearLayers();
      if (map.hasLayer(clusterGroup)) {
        map.removeLayer(clusterGroup);
      }
    };
  }, [
    buildSectionMarker,
    createClusterGroup,
    sectionBurialPresentationBand,
    sectionBurials,
    sectionFilter,
    showAllBurials,
    syncInteractiveSectionMarkers,
    getMapInstance,
    isCustomMapRuntimeActive,
  ]);

  useEffect(() => {
    if (isCustomMapRuntimeActive || !showAllBurials || !sectionFilter) {
      return;
    }

    syncAllSectionMarkerPresentation();
  }, [
    currentZoom,
    isCustomMapRuntimeActive,
    sectionFilter,
    showAllBurials,
    syncAllSectionMarkerPresentation,
  ]);

  useEffect(() => {
    syncInteractiveSectionMarkers(activeBurialId, hoveredBurialId);
  }, [activeBurialId, hoveredBurialId, syncInteractiveSectionMarkers]);

  useEffect(() => {
    syncLeafletSelectedMarkerIcons();
  }, [
    activeBurialId,
    hoveredBurialId,
    isCustomMapRuntimeActive,
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
  }, [activeBurialId, isCustomMapRuntimeActive, openPopupForBurial, selectedBurials, selectedTour, shouldUseMapPopups]);

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
  }, [activeBurialId, isCustomMapRuntimeActive, openPopupForBurial, selectedBurials, shouldUseMapPopups]);

  /**
   * Handle map zoom changes
   */
  const handleZoomEnd = useCallback((e) => {
    const map = e.target;
    const nextZoom = map.getZoom();
    currentZoomRef.current = nextZoom;
    setCurrentZoom(nextZoom);
    syncAllSectionMarkerPresentation();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame?.(syncAllSectionMarkerPresentation);
      window.setTimeout(syncAllSectionMarkerPresentation, 180);
    }
  }, [syncAllSectionMarkerPresentation]);

  useEffect(() => {
    const map = getMapInstance();
    if (!map) return;

    map.on('zoomend', handleZoomEnd);

    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [getMapInstance, handleZoomEnd]);

  useEffect(() => {
    if (isCustomMapRuntimeActive) {
      return undefined;
    }

    scheduleSectionTooltipSync();

    return () => {
      if (sectionTooltipSyncFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(sectionTooltipSyncFrameRef.current);
        sectionTooltipSyncFrameRef.current = null;
      }
    };
  }, [currentZoom, isCustomMapRuntimeActive, scheduleSectionTooltipSync, sectionFilter, showAllBurials]);

  useEffect(() => {
    if (isCustomMapRuntimeActive) {
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
  }, [clearHoveredSection, getMapInstance, isCustomMapRuntimeActive, markSectionInputMode]);

  useEffect(() => {
    if (isCustomMapRuntimeActive) {
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
  }, [clearHoveredBurialIfCurrent, getMapInstance, isCustomMapRuntimeActive]);

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
      maxZoom: sectionBrowseFocusMaxZoom,
    });
  }, [fitMapBoundsInViewport, getMapInstance, sectionBoundsById, sectionBrowseFocusMaxZoom]);

  const activateSectionBrowse = useCallback((sectionValue, bounds) => {
    const nextSection = sectionValue || "";
    requestBurialDataLoad();
    clearActiveBurialFocus({ clearHover: true });
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
  }, [clearActiveBurialFocus, focusSectionOnMap, requestBurialDataLoad]);

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
      maxZoom: sectionBrowseFocusMaxZoom,
    });
  }, [fitMapBoundsInViewport, getMapInstance, sectionBrowseFocusMaxZoom, tourBoundsByName]);

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
        dispatchSelectionAction(replaceMapSelectionRecords({
          records: packetSelections,
          activeRecordId: nextActiveBurial?.id || null,
          hoveredRecordId: null,
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
    dispatchSelectionAction,
  ]);

  //=============================================================================
  // Map Layer Management
  //=============================================================================

  /**
   * Callback for handling section layer interactions
   */
  const getSectionStyle = useCallback((feature) => getSectionPolygonStyle({
    sectionId: feature?.properties?.Section,
    activeSectionId: sectionFilter,
    showAllBurials,
  }), [sectionFilter, showAllBurials]);

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
          restoreSectionLayerStyle(clearedHoverState.sectionId, clearedHoverState.layer);
          scheduleSectionTooltipSync();
        }

        hoveredSectionIdRef.current = nextHoverState.sectionId;
        hoveredSectionLayerRef.current = nextHoverState.layer;
        layer.setStyle({
          ...getSectionPolygonStyle({
            sectionId,
            activeSectionId: sectionFilter,
            hoveredSectionId: sectionId,
            showAllBurials,
          }),
          weight: 5.5,
        });
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

        restoreSectionLayerStyle(sectionId);
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
    restoreSectionLayerStyle,
    scheduleSectionTooltipSync,
    sectionFilter,
    showAllBurials,
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

      if (!isCustomMapRuntimeActive) {
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
    isCustomMapRuntimeActive,
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
    if (!isCustomMapRuntimeActive && !selectedTourLayer) return;
    if (isCustomMapRuntimeActive && !selectedTourGeoJson) return;
    focusTourOnMap(selectedTour);
  }, [
    focusTourOnMap,
    isCustomMapRuntimeActive,
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
        {isDev && <MenuItem disabled>{`Map mode: ${mapEngine === "custom" ? "Preview" : "Standard"}`}</MenuItem>}
        {isDev && mapEngine !== "leaflet" && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              handleMapEngineChange("leaflet");
            }}
          >
            Use standard map
          </MenuItem>
        )}
        {isDev && mapEngine !== "custom" && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              handleMapEngineChange("custom");
            }}
          >
            Try preview map
          </MenuItem>
        )}
        {isDev && (
          <MenuItem
            onClick={() => {
              handleCloseAppMenu();
              handleTogglePmtilesExperiment();
            }}
          >
            {isPmtilesEnabled ? 'Hide detailed grave layer' : 'Show detailed grave layer'}
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
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
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

      {isCustomMapRuntimeActive ? (
        <>
        <MapControlStack isMobile={isMobile}>
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
            locationAccuracyGeoJson={locationAccuracyGeoJson}
            mapRef={mapRef}
            markerColors={MARKER_COLORS}
            maxBounds={PADDED_BOUNDARY_BOUNDS}
            maxZoom={activeBasemapMaxZoom}
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
            sectionAffordanceMarkers={sectionAffordanceMarkers}
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
            showRoads={showRoads}
            showSectionAffordanceMarkers={overlayVisibility.sections !== false && showSectionAffordanceMarkers}
            showSections={overlayVisibility.sections !== false && showSections}
            showSectionOverviewMarkers={overlayVisibility.sections !== false && showSectionOverviewMarkers}
            siteTwinCandidates={filteredSiteTwinCandidates}
            siteTwinMonumentHeightScale={normalizedSiteTwinDebugState.monumentHeightScale}
            siteTwinManifest={siteTwinManifest}
            siteTwinSurfaceOpacity={siteTwinSurfaceOpacity}
            trackedLocation={trackedLocation}
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
          maxZoom={activeBasemapMaxZoom}
          markerZoomAnimation={!shouldReduceMapMotion}
          zoomAnimation={!shouldReduceMapMotion}
        >
          <MapStaticLayers
            activeBasemap={activeBasemap}
            activeBasemapMaxZoom={activeBasemapMaxZoom}
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
            sectionAffordanceMarkers={sectionAffordanceMarkers}
            sectionOverviewMarkers={sectionOverviewMarkers}
            selectedTour={selectedTour}
            showRoads={showRoads}
            showSectionAffordanceMarkers={overlayVisibility.sections && showSectionAffordanceMarkers}
            showSections={overlayVisibility.sections && showSections}
            showSectionOverviewMarkers={overlayVisibility.sections && showSectionOverviewMarkers}
            tourNames={tourNames}
          />

          {locationAccuracyGeoJson && (
            <GeoJSON
              data={locationAccuracyGeoJson}
              style={LOCATION_ACCURACY_STYLE}
            />
          )}

          {routeGeoJson && (
            <GeoJSON
              data={routeGeoJson}
              style={ROUTE_LINE_STYLE}
            />
          )}

          {trackedLocation && (
            <CircleMarker
              center={[trackedLocation.latitude, trackedLocation.longitude]}
              radius={8}
              interactive={false}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#1f8a69",
                fillOpacity: 0.96,
                opacity: 0.98,
                weight: 3,
              }}
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
