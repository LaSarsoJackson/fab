/**
 * Map shell and Leaflet orchestration.
 *
 * `BurialMap` is the runtime boundary for React state, Leaflet layer lifecycles,
 * viewport movement, popups, routing, and sidebar wiring. Pure record shaping,
 * search rules, tour reconciliation, and routing algorithms should stay in the
 * feature/shared modules imported below.
 *
 * Core flow: load map data, inflate burial/tour data on demand, derive indexes,
 * push selection changes through the map reducer, mirror active state into
 * imperative Leaflet refs, then render sidebar, popups, routes, and map layers.
 */

//=============================================================================
// External Dependencies
//=============================================================================

// React and Core Dependencies
import React, { memo, useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

// Leaflet and Map-related Dependencies
import { MapContainer, Popup, Marker, GeoJSON, CircleMarker, Tooltip, useMap } from "react-leaflet";
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
import {
  APP_PROFILE,
  getEmptyCoreMapData,
  loadCoreMapData,
  TOUR_DEFINITIONS,
  TOUR_STYLES,
} from "./features/fab/profile";
import BurialSidebar from "./BurialSidebar";
import {
  buildBurialSectionIndex,
  buildBurialBrowseResult,
  buildTourBrowseResult,
  findSectionBrowseDetailDefinition,
  formatBrowseResultName,
  resolveSectionBrowseRecords,
} from "./features/browse/browseResults";
import {
  buildSearchIndex,
  smartSearch,
  sortSectionValues,
} from "./features/browse/burialSearch";
import {
  areLocationCandidatesEquivalent,
  buildLocationAccuracyGeoJson,
  buildStackedRecordDisplayCoordinateMap,
  clearMapSelectionFocus,
  clearMapSelectionFocusForRecord,
  createViewportIntentController,
  createMapSelectionState,
  buildSectionAffordanceMarkers,
  buildSectionBoundsById,
  buildSectionOverviewMarkers,
  beginLeafletSectionHover,
  clearLeafletSectionHover,
  focusMapSelectionRecord,
  MAP_PRESENTATION_POLICY,
  getSectionBurialMarkerStyle,
  getSectionPolygonStyle,
  isApproximateLocationAccuracy,
  LOCATION_APPROXIMATE_MAX_ACCURACY_METERS,
  LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS,
  LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS,
  LOCATION_RECENT_FIX_WINDOW_MS,
  normalizeLocationPosition,
  inferPointerType,
  isLeafletSectionLayerHovered,
  isTouchLikePointerType,
  ROAD_LAYER_STYLES,
  reduceMapSelectionState,
  refreshMapSelectionRecords,
  removeMapSelectionRecord,
  replaceMapSelectionRecords,
  resolveClusterExpansionZoom,
  getClusterIconCount,
  resolveSameCoordinateSectionBrowseContext,
  resolveMapPresentationPolicy,
  selectBestRecentLocationCandidate,
  selectRouteTrackingLocationCandidate,
  shouldResetRouteGeometryForRequest,
  shouldShowPersistentSectionTooltips,
  shouldRejectLocationCandidate,
  smoothLocationCandidate,
  shouldHandleSectionHover,
  shouldIgnoreSectionBackgroundSelection,
  resetMapSelection,
  setMapSelectionHover,
} from "./features/map/mapDomain";
import {
  ActiveLeafletBasemap,
  CustomZoomControl,
  DefaultExtentButton,
  fitBoundsInVisibleViewport,
  LeafletGeoJsonLayer,
  MapBounds,
  MapControlStack,
  MapController,
  MapLayerControl,
  MobileLocateButton,
  RouteStatusOverlay,
  SidebarToggleControl,
  panIntoVisibleViewport,
  schedulePopupInView,
} from "./features/map/mapChrome";
import { cleanRecordValue } from "./features/map/mapRecordPresentation";
import { PopupCardContent, createMapRecordKey } from "./features/map/popupCardContent";
import { calculateWalkingRoute, getRoutingErrorMessage, buildRoadRoutingGraph } from "./features/map/mapRouting";
import {
  buildFieldPacketShareUrl,
  buildFieldPacketState,
  buildSharedSelectionPresentation,
  parseDeepLinkState,
} from "./features/fieldPackets";
import {
  buildBurialLookup,
  harmonizeBurialBrowseResult,
  harmonizeTourBrowseResult,
} from "./features/tours/tourRecordHarmonization";
import { getGeoJsonBounds, hasValidGeoJsonCoordinates, isLatLngBoundsExpressionValid } from "./shared/geoJsonBounds";
import { buildDirectionsLink } from "./shared/routing";
import {
  cancelIdleTask,
  buildPublicAssetUrl,
  getRuntimeEnv,
  isFieldPacketsEnabled as resolveFieldPacketsEnabled,
  scheduleIdleTask,
  syncDocumentMetadata,
} from "./shared/runtimeEnv";

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
// When the high-accuracy attempt errors or times out (common under tree canopy
// in the cemetery), fall back to a network-derived fix. A modest maximumAge
// lets the platform return a recent cell/Wi-Fi cached fix immediately, which
// is far more useful than declaring the locator unavailable.
const GEOLOCATION_FALLBACK_REQUEST_OPTIONS = {
  enableHighAccuracy: false,
  maximumAge: 60000,
  timeout: 10000,
};
const GEOLOCATION_PERMISSION_DENIED = 1;
const ROUTING_LOCATION_REQUIRED_MESSAGE = LOCATION_MESSAGES.routeLocationRequired ||
  "Route on Map needs your current location near the cemetery. Use Open in Maps for directions from farther away.";
const SECTION_MARKER_BATCH_SIZE = 300;
const SEARCH_INDEX_PUBLIC_PATH = APP_PROFILE.artifacts.searchIndexPublicPath;
const EMPTY_TOUR_RESULTS = [];
const MAP_BASEMAPS = APP_PROFILE.map.basemaps || [];
const MAP_CONTROLLED_BASEMAPS = MAP_BASEMAPS;
const DEFAULT_BASEMAP_ID = APP_PROFILE.map.defaultBasemapId || MAP_BASEMAPS[0]?.id || "";
const DEFAULT_MAX_MAP_ZOOM = MAP_BASEMAPS.reduce((highestZoom, basemap) => (
  Number.isFinite(basemap?.maxZoom)
    ? Math.max(highestZoom, basemap.maxZoom)
    : highestZoom
), MAP_PRESENTATION_POLICY.sectionBurialIndividualMinZoom);
const MAP_OVERLAY_OPTIONS = [
  { id: "roads", label: "Roads", defaultVisible: false },
  { id: "boundary", label: "Boundary", defaultVisible: true },
  { id: "sections", label: "Sections", defaultVisible: true },
];
const DEFAULT_MAP_OVERLAY_VISIBILITY = MAP_OVERLAY_OPTIONS.reduce((visibility, option) => ({
  ...visibility,
  [option.id]: option.defaultVisible,
}), {});

const isLocationCandidateWithinBuffer = (candidate) => {
  if (!candidate) {
    return false;
  }

  return booleanPointInPolygon(
    point([candidate.longitude, candidate.latitude]),
    LOCATION_BUFFER_BOUNDARY
  );
};

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
const sectionClusterIcons = new Map();

const formatSectionClusterCountLabel = (count = 0) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (normalizedCount >= 1000) {
    return `${(normalizedCount / 1000).toFixed(normalizedCount >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }

  return String(normalizedCount);
};

const getSectionClusterIconSize = (count = 0) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (normalizedCount >= 3000) return 34;
  if (normalizedCount >= 1500) return 32;
  if (normalizedCount >= 700) return 31;
  return 30;
};

const getSectionClusterIcon = (count = 0) => {
  const normalizedSize = getSectionClusterIconSize(count);
  const label = formatSectionClusterCountLabel(count);
  const cacheKey = `${normalizedSize}:${label}`;

  if (!sectionClusterIcons.has(cacheKey)) {
    sectionClusterIcons.set(cacheKey, L.divIcon({
      html: `
        <div class="cemetery-cluster section-cluster">
          ${CEMETERY_CLUSTER_GLYPH}
          <span class="cemetery-cluster__count">${label}</span>
        </div>
      `,
      className: 'custom-cluster-icon section-cluster-icon',
      iconSize: [normalizedSize, normalizedSize],
      iconAnchor: [normalizedSize / 2, normalizedSize / 2],
    }));
  }

  return sectionClusterIcons.get(cacheKey);
};

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
const sectionAffordanceIcons = new Map();

const getSectionAffordanceIcon = (size = 28) => {
  const normalizedSize = Number.isFinite(Number(size))
    ? Math.round(Number(size))
    : 28;

  if (!sectionAffordanceIcons.has(normalizedSize)) {
    sectionAffordanceIcons.set(normalizedSize, L.divIcon({
      html: `<div class="section-affordance">${SECTION_AFFORDANCE_GLYPH}</div>`,
      className: "section-affordance-icon",
      iconSize: [normalizedSize, normalizedSize],
      iconAnchor: [normalizedSize / 2, normalizedSize / 2],
    }));
  }

  return sectionAffordanceIcons.get(normalizedSize);
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

const createRouteGeoJsonRenderKey = (geojson) => {
  const coordinates = geojson?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return "active-route";
  }

  return coordinates
    .map((coordinate) => (
      `${Number(coordinate?.[0]).toFixed(7)},${Number(coordinate?.[1]).toFixed(7)}`
    ))
    .join("|");
};

/**
 * Creates the visual marker for a tour point.
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

/**
 * Binds a React popup to an imperative Leaflet layer. This is used for layers
 * created outside React, such as markercluster children and cached tour GeoJSON.
 */
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
            {`Section ${marker.sectionValue}`}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
});

const MapSectionClusterMarkers = memo(function MapSectionClusterMarkers({
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
          key={`cluster-${marker.id}`}
          position={[marker.lat, marker.lng]}
          icon={getSectionClusterIcon(marker.count)}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="section-label section-label--overview"
          >
            {`Section ${marker.sectionValue}`}
          </Tooltip>
        </Marker>
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
          icon={getSectionAffordanceIcon(marker.size)}
          eventHandlers={{
            click: () => onSelectSection?.(marker.sectionValue, marker.bounds),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="section-label section-label--overview"
          >
            {`Section ${marker.sectionValue}`}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
});

const MapRoadLayers = memo(function MapRoadLayers({ roadsData }) {
  return (
    <>
      {ROAD_LAYER_STYLES.map((style, index) => (
        <LeafletGeoJsonLayer
          key={`roads:${index}`}
          layerId={`roads:${index}`}
          data={roadsData}
          style={style}
        />
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
  fitMapBoundsInViewport,
  getSectionStyle,
  isLayerControlOpen,
  isMobile,
  isSearchPanelVisible,
  mapRef,
  onBasemapChange,
  onEachSectionFeature,
  onLayerControlOpenChange,
  onLocateMarker,
  onToggleSearchPanel,
  onViewportMoveStart,
  onZoomChange,
  onSelectSection,
  onToggleOverlay,
  overlayVisibility,
  overlayMaps,
  roadsData,
  sectionsData,
  sectionAffordanceMarkers,
  sectionOverviewMarkers,
  selectedTour,
  showRoads,
  showSectionAffordanceMarkers,
  showSectionClusterMarkers,
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
        <SidebarToggleControl
          isSearchPanelVisible={isSearchPanelVisible}
          onToggle={onToggleSearchPanel}
        />
        <CustomZoomControl isMobile={isMobile} />
        <MobileLocateButton isMobile={isMobile} onLocate={onLocateMarker} />
      </MapControlStack>
      <ActiveLeafletBasemap basemap={activeBasemap} />
      <MapBounds
        fitMapBounds={fitMapBoundsInViewport}
        paddedBoundaryBounds={PADDED_BOUNDARY_BOUNDS}
        maxZoom={activeBasemapMaxZoom}
      />
      <MapController
        mapRef={mapRef}
        onViewportMoveStart={onViewportMoveStart}
        onZoomChange={onZoomChange}
      />
      <MapTourController selectedTour={selectedTour} overlayMaps={overlayMaps} tourNames={tourNames} />
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
      {showRoads && (
        <MapRoadLayers roadsData={roadsData} />
      )}
      {showSectionAffordanceMarkers && (
        <MapSectionAffordanceMarkers
          markers={sectionAffordanceMarkers}
          onSelectSection={onSelectSection}
        />
      )}
      {showSectionClusterMarkers && (
        <MapSectionClusterMarkers
          markers={sectionOverviewMarkers}
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
    featureFlags,
  } = runtimeEnv;
  const isFieldPacketsEnabled = resolveFieldPacketsEnabled(featureFlags);
  const tourDefinitions = TOUR_DEFINITIONS;
  const tourStyles = TOUR_STYLES;
  /**
   * Editing guide:
   * - keep state and Leaflet side effects here
   * - put deterministic transforms in `src/features/*` or `src/shared/*`
   * - explain lifecycle constraints in comments, especially around refs,
   *   popup timing, deep-link restoration, and programmatic viewport movement
   */
  //-----------------------------------------------------------------------------
  // State Management
  //-----------------------------------------------------------------------------

  // Map and UI state. Add new state here only when it represents user/runtime
  // interaction; data derived from loaded records belongs in the memoized block.
  const [overlayMaps, setOverlayMaps] = useState({});
  const [tourBoundsByName, setTourBoundsByName] = useState({});
  const [tourResultsByName, setTourResultsByName] = useState({});
  const [currentZoom, setCurrentZoom] = useState(MAP_ZOOM);
  const [isLayerControlOpen, setIsLayerControlOpen] = useState(false);
  const [isSearchPanelVisible, setIsSearchPanelVisible] = useState(true);
  const [selectionState, setSelectionState] = useState(() => createMapSelectionState());
  const [selectedTour, setSelectedTour] = useState(null);
  const [activeBasemapId, setActiveBasemapId] = useState(() => (
    MAP_CONTROLLED_BASEMAPS.some((basemap) => basemap.id === DEFAULT_BASEMAP_ID)
      ? DEFAULT_BASEMAP_ID
      : (MAP_CONTROLLED_BASEMAPS[0]?.id || MAP_BASEMAPS[0]?.id || "")
  ));
  const [overlayVisibility, setOverlayVisibility] = useState(DEFAULT_MAP_OVERLAY_VISIBILITY);
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

  // Component references.
  // Leaflet layers and event handlers outlive individual renders. These refs are
  // the imperative bridge that lets hover, active selection, popups, and routing
  // observe current React state without re-binding thousands of map objects.
  const markerClusterRef = useRef(null);
  const mapRef = useRef(null);
  const sidebarOverlayRef = useRef(null);
  const hiddenMobileChromeContextRef = useRef(null);
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
  const activateSectionBrowseRef = useRef(null);
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
  // Reentrancy guard for the "Find Me" button. Without this, repeated taps in
  // weak signal would fan out into multiple in-flight high-accuracy requests
  // and flap the chrome status between locating/unavailable.
  const isLocateRequestInFlightRef = useRef(false);
  const renderedRouteDestinationRef = useRef(null);
  const viewportIntentControllerRef = useRef(null);
  if (viewportIntentControllerRef.current === null) {
    viewportIntentControllerRef.current = createViewportIntentController({
      onUserViewportIntent: () => {
        focusLocationOnNextAcceptedFixRef.current = false;
      },
    });
  }

  //-----------------------------------------------------------------------------
  // Memoized Values
  //-----------------------------------------------------------------------------

  // Derived map data and presentation policy. Keep expensive pure calculations
  // here; keep Leaflet mutation in effects and callbacks below.
  const sectionBoundsById = useMemo(
    () => buildSectionBoundsById(sectionsData),
    [sectionsData]
  );
  const roadRoutingGraph = useMemo(
    () => buildRoadRoutingGraph(roadsData),
    [roadsData]
  );
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
  const routeGeoJsonRenderKey = useMemo(
    () => createRouteGeoJsonRenderKey(routeGeoJson),
    [routeGeoJson]
  );
  const mapPresentationPolicy = useMemo(() => resolveMapPresentationPolicy({
    currentZoom,
    maxZoom: activeBasemapMaxZoom,
    roadOverlayVisible: overlayVisibility.roads === true,
    sectionFilter,
    selectedTour,
  }), [
    activeBasemapMaxZoom,
    currentZoom,
    overlayVisibility.roads,
    sectionFilter,
    selectedTour,
  ]);
  const {
    sectionBrowseFocusMaxZoom,
    sectionBurialClusterRadius,
    sectionBurialDisableClusteringZoom,
    sectionBurialIndividualMarkerMinZoom,
    sectionDetailMinZoom,
    showRoads,
    showSectionAffordanceMarkers,
    showSectionClusterMarkers,
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
    // Parse the initial URL once. Later URL changes should not unexpectedly
    // re-drive selection state after the user starts interacting with the map.
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
  const mobileChromeContextSignature = useMemo(() => (
    [
      activeBurialId || "",
      sectionFilter || "",
      lotTierFilter || "",
      selectedTour || "",
      selectedBurials.map((record) => cleanRecordValue(record.id)).sort().join("|"),
    ].join("::")
  ), [
    activeBurialId,
    lotTierFilter,
    sectionFilter,
    selectedBurials,
    selectedTour,
  ]);
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

  const getOverlayElement = useCallback(() => (
    isSearchPanelVisible ? sidebarOverlayRef.current : null
  ), [isSearchPanelVisible]);
  // All programmatic viewport moves go through the intent controller. It keeps
  // automatic focus from fighting a user who has just panned, dragged, or zoomed.
  const markExplicitViewportFocus = useCallback(() => {
    viewportIntentControllerRef.current?.markExplicitFocus();
  }, []);
  const runProgrammaticViewportMove = useCallback((map, moveCallback) => {
    return viewportIntentControllerRef.current?.runProgrammaticMove(map, moveCallback);
  }, []);
  const canApplyViewportFocus = useCallback(({ isExplicitFocus = false } = {}) => {
    return viewportIntentControllerRef.current?.canApplyFocus({ isExplicitFocus }) ?? true;
  }, []);
  const handleViewportMoveStart = useCallback((eventType) => {
    viewportIntentControllerRef.current?.handleMoveStart(eventType);
  }, []);
  const fitMapBoundsInViewport = useCallback((
    map,
    bounds,
    {
      ignoreViewportIntent = false,
      isExplicitFocus = false,
      ...options
    } = {}
  ) => {
    if (!ignoreViewportIntent && !canApplyViewportFocus({ isExplicitFocus })) {
      return false;
    }

    runProgrammaticViewportMove(map, () => {
      fitBoundsInVisibleViewport(map, bounds, {
        ...options,
        getOverlayElement,
      });
    });
    return true;
  }, [canApplyViewportFocus, getOverlayElement, runProgrammaticViewportMove]);
  const panMapIntoViewport = useCallback((
    map,
    latLng,
    {
      ignoreViewportIntent = false,
      isExplicitFocus = false,
      ...options
    } = {}
  ) => {
    if (!ignoreViewportIntent && !canApplyViewportFocus({ isExplicitFocus })) {
      return false;
    }

    runProgrammaticViewportMove(map, () => {
      panIntoVisibleViewport(map, latLng, {
        ...options,
        getOverlayElement,
      });
    });
    return true;
  }, [canApplyViewportFocus, getOverlayElement, runProgrammaticViewportMove]);
  const schedulePopupLayout = useCallback((popup) => {
    if (!popup) {
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
  const handleToggleSearchPanel = useCallback(() => {
    setIsSearchPanelVisible((current) => {
      const nextIsVisible = !current;

      if (isMobile && current && !nextIsVisible) {
        hiddenMobileChromeContextRef.current = mobileChromeContextSignature;
      } else if (nextIsVisible) {
        hiddenMobileChromeContextRef.current = null;
      }

      return nextIsVisible;
    });
  }, [isMobile, mobileChromeContextSignature]);

  useEffect(() => {
    if (isMobile) {
      setIsSearchPanelVisible(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || isSearchPanelVisible) {
      if (isSearchPanelVisible) {
        hiddenMobileChromeContextRef.current = null;
      }
      return;
    }

    if (hiddenMobileChromeContextRef.current === null) {
      hiddenMobileChromeContextRef.current = mobileChromeContextSignature;
      return;
    }

    if (hiddenMobileChromeContextRef.current !== mobileChromeContextSignature) {
      hiddenMobileChromeContextRef.current = null;
      setIsSearchPanelVisible(true);
    }
  }, [isMobile, isSearchPanelVisible, mobileChromeContextSignature]);

  useEffect(() => {
    const map = getMapInstance();
    if (!map || typeof map.invalidateSize !== "function") {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [getMapInstance, isMobile, isSearchPanelVisible]);

  useEffect(() => {
    shouldUseMapPopupsRef.current = shouldUseMapPopups;

    if (shouldUseMapPopups) {
      return;
    }

    closeMapPopup();
  }, [closeMapPopup, shouldUseMapPopups]);

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
    () => buildSectionAffordanceMarkers(sectionsData, sectionBurialCounts),
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

  const sectionDetailTourDefinition = useMemo(() => findSectionBrowseDetailDefinition(
    tourDefinitions,
    {
      sectionFilter,
      lotTierFilter,
      filterType,
    }
  ), [filterType, lotTierFilter, sectionFilter, tourDefinitions]);
  const sectionDetailTourName = sectionDetailTourDefinition?.name || "";

  const sectionRecordsOverride = useMemo(() => {
    if (!sectionDetailTourName) return null;

    return Object.prototype.hasOwnProperty.call(tourResultsByName, sectionDetailTourName)
      ? (tourResultsByName[sectionDetailTourName] || EMPTY_TOUR_RESULTS)
      : null;
  }, [sectionDetailTourName, tourResultsByName]);

  const sectionBurials = useMemo(() => (
    resolveSectionBrowseRecords({
      burialRecords,
      sectionRecordsOverride,
      sectionIndex: burialSectionIndex,
      sectionFilter,
      lotTierFilter,
      filterType,
    })
  ), [
    burialRecords,
    burialSectionIndex,
    filterType,
    lotTierFilter,
    sectionFilter,
    sectionRecordsOverride,
  ]);
  const sectionBurialDisplayCoordinatesById = useMemo(
    () => buildStackedRecordDisplayCoordinateMap(sectionBurials, {
      getRecordId: getSectionBurialMarkerId,
      offsetMeters: 1.15,
    }),
    [sectionBurials]
  );
  const selectedBurialDisplayCoordinatesById = useMemo(
    () => buildStackedRecordDisplayCoordinateMap(selectedBurials, {
      offsetMeters: 1.85,
    }),
    [selectedBurials]
  );

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
   * Location acceptance pipeline. One-shot requests and watch updates both pass
   * through the same buffer, accuracy, recency, and smoothing rules before they
   * can affect map state or active routing.
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

    // Tag accepted fixes with `isApproximate` so subsequent updates can decide
    // whether to upgrade (approximate -> accurate) and so the chrome can show
    // an informational tone instead of pretending we have a precise pin.
    const isApproximate = isApproximateLocationAccuracy(location.accuracyMeters);
    const annotatedLocation = location.isApproximate === isApproximate
      ? location
      : { ...location, isApproximate };

    acceptedLocationRef.current = annotatedLocation;
    setStatus(
      isApproximate
        ? (LOCATION_MESSAGES.approximate || LOCATION_MESSAGES.active)
        : LOCATION_MESSAGES.active
    );
    setLat(annotatedLocation.latitude);
    setLng(annotatedLocation.longitude);
    setLocationAccuracyMeters(annotatedLocation.accuracyMeters);

    if (activeRouteBurialIdRef.current) {
      setRoutingOrigin([annotatedLocation.latitude, annotatedLocation.longitude]);
    }

    return annotatedLocation;
  }, []);

  // The shell may opt in to accepting a coarse network/Wi-Fi fix as
  // "approximate" (e.g. after the high-accuracy attempt timed out under
  // canopy). Watch updates always run with the strict thresholds so we don't
  // accidentally downgrade an accurate pin.
  const resolveAcceptedAccuracyThreshold = useCallback((options) => {
    const { allowApproximateAcceptance = false } = options || {};
    const previousLocation = acceptedLocationRef.current;

    if (!previousLocation) {
      return allowApproximateAcceptance
        ? LOCATION_APPROXIMATE_MAX_ACCURACY_METERS
        : LOCATION_INITIAL_MAX_ACCEPTABLE_ACCURACY_METERS;
    }

    // While the accepted fix is still approximate, keep the door open for any
    // candidate that is not worse than the looser approximate threshold so a
    // 200m fix can replace a 600m one. selectBestRecentLocationCandidate then
    // picks the most accurate of the recent candidates.
    if (previousLocation.isApproximate) {
      return LOCATION_APPROXIMATE_MAX_ACCURACY_METERS;
    }

    return LOCATION_MAX_ACCEPTABLE_ACCURACY_METERS;
  }, []);

  const updateLocationFromPosition = useCallback((position, options = {}) => {
    const candidate = normalizeLocationPosition(position);
    if (!candidate) {
      return acceptedLocationRef.current;
    }

    if (!isLocationCandidateWithinBuffer(candidate)) {
      if (acceptedLocationRef.current) {
        // A noisy coarse fix near the boundary should not invalidate an
        // already-trusted on-site pin. Keep what we have and let the watch
        // refine it.
        return acceptedLocationRef.current;
      }

      // Without a prior fix, only treat a *confidently* off-site reading as
      // out-of-bounds. A coarse cell-tower fix that lands a few hundred meters
      // outside the buffer is more likely a low-accuracy estimate of someone
      // standing inside the cemetery than a real off-site visitor.
      if (isApproximateLocationAccuracy(candidate.accuracyMeters)) {
        // Keep the chrome aligned with reality: we ignored this reading and
        // the watch is still trying for a better one. Without this nudge the
        // status would stay frozen on "Locating..." (or whatever was set
        // upstream) and look like the request hung.
        if (watchIdRef.current !== null && LOCATION_MESSAGES.weakSignal) {
          setStatus(LOCATION_MESSAGES.weakSignal);
        }
        return null;
      }

      clearAcceptedLocation(LOCATION_MESSAGES.outOfBounds);
      return null;
    }

    const maxAcceptedAccuracyMeters = resolveAcceptedAccuracyThreshold(options);

    // The first accepted fix must be reasonably accurate; once we have a good
    // on-site fix, later watch updates can be smoothed against it.
    if (shouldRejectLocationCandidate(candidate, { maxAcceptedAccuracyMeters })) {
      return acceptedLocationRef.current;
    }

    const cutoff = candidate.recordedAt - LOCATION_RECENT_FIX_WINDOW_MS;
    const nextCandidates = locationRecentCandidatesRef.current
      .filter((entry) => Number(entry?.recordedAt) >= cutoff);
    nextCandidates.push(candidate);
    locationRecentCandidatesRef.current = nextCandidates;

    const nextBestCandidate = activeRouteBurialIdRef.current
      ? selectRouteTrackingLocationCandidate(nextCandidates, {
        previousLocation: acceptedLocationRef.current,
      })
      : selectBestRecentLocationCandidate(nextCandidates);
    if (!nextBestCandidate) {
      return acceptedLocationRef.current;
    }

    if (areLocationCandidatesEquivalent(selectedLocationFixRef.current, nextBestCandidate)) {
      return acceptedLocationRef.current;
    }

    selectedLocationFixRef.current = nextBestCandidate;

    // Smoothing is only useful between fixes of comparable quality. When we're
    // upgrading from an approximate (coarse) fix to a precise one, blending
    // would drag the new pin back toward the unreliable position; snap to the
    // accurate candidate instead.
    const previousLocation = acceptedLocationRef.current;
    const shouldSnapInsteadOfSmooth = previousLocation?.isApproximate
      && !isApproximateLocationAccuracy(nextBestCandidate.accuracyMeters);

    return commitAcceptedLocation(
      shouldSnapInsteadOfSmooth
        ? nextBestCandidate
        : smoothLocationCandidate(previousLocation, nextBestCandidate)
    );
  }, [clearAcceptedLocation, commitAcceptedLocation, resolveAcceptedAccuracyThreshold]);

  const handleLocationError = useCallback((error) => {
    const fallbackLocation = acceptedLocationRef.current;
    if (!fallbackLocation) {
      // Permission denial is a distinct user-facing condition: the user can
      // remediate it in browser/OS settings. Generic "unavailable" hides that.
      const isPermissionDenied = error?.code === GEOLOCATION_PERMISSION_DENIED;
      const message = isPermissionDenied
        ? (LOCATION_MESSAGES.permissionDenied || LOCATION_MESSAGES.unavailable)
        : LOCATION_MESSAGES.unavailable;
      setStatus(message);
      if (isPermissionDenied) {
        console.warn('Geolocation permission denied:', error);
      } else {
        console.error('Geolocation error:', error);
      }
      return null;
    }

    return fallbackLocation;
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
    let didResolve = false;
    let timeoutId = null;

    const resolveLocationRequest = (
      nextLocation,
      { markUnavailableWhenEmpty = false } = {}
    ) => {
      if (didResolve) {
        return;
      }

      didResolve = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      // Avoid showing "GPS unavailable" while the watch pipeline is still
      // actively trying. The watch's own error handler will surface the
      // unavailable state if it eventually fails.
      if (
        !nextLocation
        && markUnavailableWhenEmpty
        && !acceptedLocationRef.current
        && watchIdRef.current === null
      ) {
        setStatus(LOCATION_MESSAGES.unavailable);
      }
      resolve(nextLocation);
    };

    // The success and error paths from each geolocation stage have to share
    // identical wait-for-watch and resolve semantics, so we wrap them as
    // small helpers instead of duplicating the logic in every callback.
    const handleAcceptedPosition = (position, { allowApproximate = false } = {}) => {
      const requestedCandidate = normalizeLocationPosition(position);
      const isOutsideLocationBuffer = requestedCandidate
        && !isLocationCandidateWithinBuffer(requestedCandidate);
      const nextLocation = updateLocationFromPosition(position, {
        allowApproximateAcceptance: allowApproximate,
      });

      if (nextLocation || watchIdRef.current === null || isOutsideLocationBuffer) {
        resolveLocationRequest(nextLocation, {
          markUnavailableWhenEmpty: !isOutsideLocationBuffer,
        });
        return;
      }

      // The one-shot returned a fix but the pipeline rejected it as too
      // noisy. The watch may still accept a better candidate shortly.
      // Mirror the stage-2 retry path and tell the user we're still trying;
      // otherwise the chrome would sit silently on "Locating..." while we
      // wait, which feels indistinguishable from a stuck request.
      if (LOCATION_MESSAGES.weakSignal) {
        setStatus(LOCATION_MESSAGES.weakSignal);
      }
      void waitForAcceptedLocation().then((nextAcceptedLocation) => {
        resolveLocationRequest(nextAcceptedLocation, {
          markUnavailableWhenEmpty: true,
        });
      });
    };

    const finalizeAfterUnrecoverableError = (error) => {
      const fallbackLocation = handleLocationError(error);
      if (fallbackLocation || watchIdRef.current === null) {
        resolveLocationRequest(fallbackLocation, {
          markUnavailableWhenEmpty: true,
        });
        return;
      }

      void waitForAcceptedLocation().then((nextLocation) => {
        resolveLocationRequest(nextLocation || fallbackLocation, {
          markUnavailableWhenEmpty: true,
        });
      });
    };

    const handlePermissionDenied = (error) => {
      // Permission denied is fatal for this session - retrying would either
      // re-prompt or silently fail the same way. Surface a distinct message
      // so the user knows what to fix.
      const permissionDeniedMessage = LOCATION_MESSAGES.permissionDenied
        || LOCATION_MESSAGES.unavailable;
      setStatus(permissionDeniedMessage);
      console.warn('Geolocation permission denied:', error);
      resolveLocationRequest(acceptedLocationRef.current, {
        markUnavailableWhenEmpty: false,
      });
    };

    // Stage 2: low-accuracy / cached fallback. This is what saves us under
    // canopy: a recent cell-tower or Wi-Fi fix returns near-instantly and
    // (because we pass allowApproximate) is acceptable up to ~1km, marked as
    // an "approximate" pin that the watch can later upgrade.
    const startFallbackStage = (primaryError) => {
      // Tell the user we have not given up. This message is intentionally
      // surfaced before issuing the fallback request so the chrome doesn't
      // sit silent during the typical 2-10s low-accuracy round-trip.
      if (LOCATION_MESSAGES.weakSignal) {
        setStatus(LOCATION_MESSAGES.weakSignal);
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (didResolve) return;
          handleAcceptedPosition(position, { allowApproximate: true });
        },
        (fallbackError) => {
          if (didResolve) return;
          if (fallbackError?.code === GEOLOCATION_PERMISSION_DENIED) {
            handlePermissionDenied(fallbackError);
            return;
          }
          finalizeAfterUnrecoverableError(fallbackError || primaryError);
        },
        GEOLOCATION_FALLBACK_REQUEST_OPTIONS,
      );
    };

    // Outer deadline is a safety net in case both stages of the geolocation
    // API hang. The internal `timeout` options on each stage normally fire
    // first and route through the error handler.
    const outerDeadlineMs = GEOLOCATION_REQUEST_OPTIONS.timeout
      + GEOLOCATION_FALLBACK_REQUEST_OPTIONS.timeout
      + 2000;
    timeoutId = setTimeout(() => {
      resolveLocationRequest(acceptedLocationRef.current, {
        markUnavailableWhenEmpty: true,
      });
    }, outerDeadlineMs);

    // Stage 1: high-accuracy GPS. Most successful first-time fixes happen
    // here within 5-15s of clear sky.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (didResolve) return;
        handleAcceptedPosition(position, { allowApproximate: false });
      },
      (primaryError) => {
        if (didResolve) return;
        if (primaryError?.code === GEOLOCATION_PERMISSION_DENIED) {
          handlePermissionDenied(primaryError);
          return;
        }
        // TIMEOUT (code 3) and POSITION_UNAVAILABLE (code 2) both indicate
        // weak signal - both deserve the fallback retry instead of an
        // immediate "unavailable".
        startFallbackStage(primaryError);
      },
      GEOLOCATION_REQUEST_OPTIONS,
    );
  }), [handleLocationError, updateLocationFromPosition, waitForAcceptedLocation]);

  const focusUserLocationOnMap = useCallback((
    location,
    {
      animate = !shouldReduceMapMotion,
      isExplicitFocus = false,
    } = {}
  ) => {
    const map = getMapInstance();
    if (!map || !location) {
      return false;
    }

    if (!canApplyViewportFocus({ isExplicitFocus })) {
      return false;
    }

    const targetLatLng = {
      lat: location.latitude,
      lng: location.longitude,
    };
    const targetZoom = Math.max(
      typeof map.getZoom === "function" ? map.getZoom() : MAP_ZOOM,
      sectionDetailMinZoom
    );

    runProgrammaticViewportMove(map, () => {
      map.setView(targetLatLng, targetZoom, { animate });
    });
    panMapIntoViewport(map, targetLatLng, {
      animate: false,
      ignoreViewportIntent: true,
    });
    return true;
  }, [
    canApplyViewportFocus,
    getMapInstance,
    panMapIntoViewport,
    runProgrammaticViewportMove,
    sectionDetailMinZoom,
    shouldReduceMapMotion,
  ]);

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
        const previousLocation = acceptedLocationRef.current;
        const nextLocation = updateLocationFromPosition(position);
        const didAcceptNewLocation = nextLocation &&
          !areLocationCandidatesEquivalent(previousLocation, nextLocation);

        if (didAcceptNewLocation && focusLocationOnNextAcceptedFixRef.current) {
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
    // Guard against rapid double-tap: weak-signal users frequently mash the
    // Find Me button while waiting, which used to fan out into multiple
    // in-flight requests and flicker the chrome. While a request is pending,
    // additional taps just refocus the camera onto whatever fix we already
    // have so the action still feels responsive.
    if (isLocateRequestInFlightRef.current) {
      if (acceptedLocationRef.current) {
        focusUserLocationOnMap(acceptedLocationRef.current, { isExplicitFocus: true });
      }
      return;
    }

    isLocateRequestInFlightRef.current = true;
    try {
      markExplicitViewportFocus();
      focusLocationOnNextAcceptedFixRef.current = true;
      resetLocationCandidateWindow();
      ensureLocationWatchActive();

      const location = await requestCurrentLocation();
      if (location) {
        focusLocationOnNextAcceptedFixRef.current = false;
        focusUserLocationOnMap(location);
      }
    } finally {
      isLocateRequestInFlightRef.current = false;
    }
  }, [
    ensureLocationWatchActive,
    focusUserLocationOnMap,
    markExplicitViewportFocus,
    requestCurrentLocation,
    resetLocationCandidateWindow,
  ]);

  // A selected record can be backed by one of three Leaflet collections:
  // section browse markers, loaded tour layers, or selected-result markers.
  const getPopupLayerForBurial = useCallback((burial) => {
    if (!burial) return null;

    const sectionMarker = sectionMarkersByIdRef.current.get(getSectionBurialMarkerId(burial));
    if (sectionMarker) {
      return sectionMarker;
    }

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
   * Focuses a burial consistently regardless of whether it came from search,
   * section browse, a tour stop, a marker click, or a restored deep link.
   * Reducer state updates first for sidebar/mobile state, then the viewport
   * moves, then the popup opens after Leaflet finishes any animation.
   */
  const focusBurial = useCallback((
    burial,
    {
      animate = true,
      isExplicitFocus = false,
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

      if (!canApplyViewportFocus({ isExplicitFocus })) {
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
        panMapIntoViewport(map, targetLatLng, {
          animate: false,
          ignoreViewportIntent: true,
        });
        if (openTourPopup) {
          focusBurialPopup(burial);
        }
      };

      if (!shouldAnimate) {
        runProgrammaticViewportMove(map, () => {
          map.setView(targetLatLng, targetZoom, { animate: false });
        });
        finalizeViewport();
        return;
      }

      map.stop();
      map.once("moveend", finalizeViewport);

      runProgrammaticViewportMove(map, () => {
        map.flyTo(
          targetLatLng,
          targetZoom,
          {
            duration: 0.5,
            easeLinearity: 0.2,
          }
        );
      });
      return;
    }

    if (openTourPopup) {
      focusBurialPopup(burial);
    }
  }, [
    activeBasemap,
    canApplyViewportFocus,
    dispatchSelectionAction,
    focusBurialPopup,
    getMapInstance,
    panMapIntoViewport,
    runProgrammaticViewportMove,
  ]);

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
      activeRouteBurialIdRef.current = null;
      renderedRouteDestinationRef.current = null;
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
    activeRouteBurialIdRef.current = null;
    renderedRouteDestinationRef.current = null;
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

  const requestBurialDataLoad = useCallback(() => {
    setHasRequestedBurialData(true);
  }, []);

  // Field packets snapshot the selected records plus enough map context to
  // restore a shared link without mixing it with loose query/section params.
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
   * Search and browse result clicks are explicit focus requests, so they are
   * allowed to move the viewport even after manual panning.
   */
  const handleResultClick = useCallback((burial) => {
    focusBurial(burial, { isExplicitFocus: true });
  }, [focusBurial]);

  const handleBrowseResultSelect = useCallback((burial) => {
    selectBurial(burial, { isExplicitFocus: true });
  }, [selectBurial]);

  /**
   * Creates the section-burial cluster group. Same-coordinate stacks open the
   * section browse list; other clusters move to the next detail zoom band.
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
        const childMarkers = cluster.getAllChildMarkers?.() || [];
        const count = getClusterIconCount(cluster, childMarkers);
        return L.divIcon({
          html: `
            <div class="cemetery-cluster">
              ${CEMETERY_CLUSTER_GLYPH}
              <span class="cemetery-cluster__count">${count}</span>
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
      const childMarkers = cluster?.getAllChildMarkers?.() || [];
      const clusterBounds = cluster?.getBounds?.();

      if (!map || !cluster) {
        return;
      }

      event?.originalEvent?.preventDefault?.();

      const targetZoom = resolveClusterExpansionZoom({
        disableClusteringAtZoom: sectionBurialDisableClusteringZoom,
      });
      const targetLatLng = cluster.getLatLng?.() || clusterBounds?.getCenter?.();
      const stackBrowseContext = resolveSameCoordinateSectionBrowseContext(childMarkers);
      if (stackBrowseContext) {
        // A source-coordinate stack is already represented well by the sidebar.
        // Keep the map focused near it, but let the section browse list carry
        // the record-level selection work instead of building a second list.
        activateSectionBrowseRef.current?.(stackBrowseContext.sectionFilter, undefined, {
          focusMap: false,
          filterType: stackBrowseContext.filterType,
          isExplicitFocus: true,
          lotTierFilter: stackBrowseContext.lotTierFilter,
        });

        if (!targetLatLng) {
          return;
        }

        markExplicitViewportFocus();
        if (targetZoom > map.getZoom()) {
          runProgrammaticViewportMove(map, () => {
            map.setView(targetLatLng, targetZoom, { animate: !shouldReduceMapMotion });
          });
          return;
        }

        panMapIntoViewport(map, targetLatLng, {
          animate: !shouldReduceMapMotion,
          isExplicitFocus: true,
        });
        return;
      }

      if (!clusterBounds) {
        return;
      }

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
        markExplicitViewportFocus();
        runProgrammaticViewportMove(map, () => {
          map.setView(targetLatLng, targetZoom, { animate: !shouldReduceMapMotion });
        });
        return;
      }

      fitMapBoundsInViewport(map, clusterBounds, {
        animate: !shouldReduceMapMotion,
        isExplicitFocus: true,
        maxZoom: targetZoom,
      });
    });

    return clusterGroup;
  }, [
    fitMapBoundsInViewport,
    markExplicitViewportFocus,
    panMapIntoViewport,
    sectionBurialClusterRadius,
    sectionBurialDisableClusteringZoom,
    shouldReduceMapMotion,
    runProgrammaticViewportMove,
  ]);

  const getSectionBurialPresentationZoom = useCallback(() => {
    const map = getMapInstance();
    const mapZoom = map?.getZoom?.();
    return Number.isFinite(mapZoom) ? mapZoom : currentZoomRef.current;
  }, [getMapInstance]);

  // Section browse markers are manually managed circle markers inside
  // markercluster, so active/hover styling is synchronized through narrow
  // helpers instead of relying on React prop reconciliation.
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

  const selectMapBurial = useCallback((burial, options = {}) => {
    clearHoveredSection();
    selectBurial(burial, options);
  }, [clearHoveredSection, selectBurial]);

  const syncLeafletSelectedMarkerIcon = useCallback((burialId, layerOverride = null) => {
    if (!burialId) {
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
  }, [selectedMarkerOrderById]);

  const syncLeafletSelectedMarkerIcons = useCallback(() => {
    selectedMarkerOrderById.forEach((_, burialId) => {
      syncLeafletSelectedMarkerIcon(burialId);
    });
  }, [selectedMarkerOrderById, syncLeafletSelectedMarkerIcon]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    // Touch devices can emit synthetic mouse events after touch input. Track the
    // real hover capability so section polygons do not stay highlighted on tap.
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
   * Starts the in-map cemetery-road route to a burial location.
   * External Apple/Google Maps directions are handled by openExternalDirections.
   */
  const startRouting = useCallback(async (burial) => {
    if (!Array.isArray(burial?.coordinates)) {
      setStatus('Directions unavailable for this burial');
      return;
    }

    markExplicitViewportFocus();
    resetLocationCandidateWindow();
    ensureLocationWatchActive();

    const location = acceptedLocationRef.current || await requestCurrentLocation();

    if (!location) {
      setRouteError(ROUTING_LOCATION_REQUIRED_MESSAGE);
      return;
    }

    selectBurial(burial, {
      animate: false,
      isExplicitFocus: true,
      openTourPopup: true,
    });

    setRouteError("");
    setRoutingOrigin([location.latitude, location.longitude]);
    setRoutingDestination([burial.coordinates[1], burial.coordinates[0]]);
    activeRouteBurialIdRef.current = burial.id;
    setActiveRouteBurialId(burial.id);
  }, [
    ensureLocationWatchActive,
    markExplicitViewportFocus,
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
    activeRouteBurialIdRef.current = null;
    renderedRouteDestinationRef.current = null;
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
      renderedRouteDestinationRef.current = null;
      return undefined;
    }

    // Route recalculation is state-driven. Origin updates while tracking should
    // refresh the path, but only destination changes should blank the old line.
    const shouldResetRouteGeometry = shouldResetRouteGeometryForRequest({
      renderedDestination: renderedRouteDestinationRef.current,
      requestedDestination: routingDestination,
    });
    let ignore = false;

    if (shouldResetRouteGeometry) {
      setRouteGeoJson(null);
    }
    setIsRouteLoading(true);
    setRouteError("");

    void calculateWalkingRoute({
      from: routingOrigin,
      roadGraph: roadRoutingGraph,
      to: routingDestination,
    }).then((routeResult) => {
      if (ignore) {
        return;
      }

      setRouteGeoJson(routeResult.geojson);
      setIsRouteLoading(false);
      renderedRouteDestinationRef.current = routingDestination;

      if (shouldResetRouteGeometry && isLatLngBoundsExpressionValid(routeResult.bounds)) {
        const map = getMapInstance();
        if (map) {
          fitMapBoundsInViewport(map, routeResult.bounds, {
            maxZoom: sectionBurialIndividualMarkerMinZoom,
          });
        }
      }
    }).catch((error) => {
      if (ignore) {
        return;
      }

      console.error("Routing error:", error);
      setIsRouteLoading(false);
      setRouteError(getRoutingErrorMessage(error));
      if (!shouldResetRouteGeometry) {
        return;
      }

      setRouteGeoJson(null);
      setRoutingOrigin(null);
      setRoutingDestination(null);
      activeRouteBurialIdRef.current = null;
      renderedRouteDestinationRef.current = null;
      setActiveRouteBurialId(null);
    });

    return () => {
      ignore = true;
    };
  }, [
    fitMapBoundsInViewport,
    getMapInstance,
    roadRoutingGraph,
    routingDestination,
    routingOrigin,
    sectionBurialIndividualMarkerMinZoom,
  ]);

  //-----------------------------------------------------------------------------
  // Effects
  //-----------------------------------------------------------------------------

  // Core geography is small enough to load immediately. Burial records remain
  // lazy so first paint and map controls do not wait on the large search payload.
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
   * Load and inflate the minified burial browse payload only after search,
   * section browse, or deep-link restoration needs record-level data.
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

    // Tour metadata arrives after the base burial payload. Refresh selected
    // records in place so popup/sidebar data picks up biographies and tour labels
    // without changing selection order or active focus.
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
   * Stop any active geolocation watch when the map shell unmounts.
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
    const markerId = getSectionBurialMarkerId(burial);
    const displayCoordinates = sectionBurialDisplayCoordinatesById.get(markerId) || burial.coordinates;
    const marker = L.circleMarker(
      [displayCoordinates[1], displayCoordinates[0]],
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
      selectMapBurial(burial, {
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
    sectionBurialDisplayCoordinatesById,
    selectMapBurial,
  ]);

  /**
   * Render section browse burial markers imperatively. Large sections can contain
   * thousands of points, and markercluster is cheaper when it owns the batch.
   */
  useEffect(() => {
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
        // Large sections can contain thousands of burial markers. Batch marker
        // creation through idle callbacks so opening a section does not freeze
        // pan/zoom or the mobile drawer.
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
  ]);

  useEffect(() => {
    if (!showAllBurials || !sectionFilter) {
      return;
    }

    syncAllSectionMarkerPresentation();
  }, [
    currentZoom,
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
    selectedMarkerOrderById,
    syncLeafletSelectedMarkerIcons,
  ]);

  useEffect(() => {
    if (!shouldUseMapPopups) {
      pendingPopupBurialRef.current = null;
      return;
    }

    // Popup opening can race marker creation, tour layer loading, and mobile to
    // desktop transitions. Keep one pending target and retry after layers render.
    const pendingBurial = pendingPopupBurialRef.current;
    if (!pendingBurial) return;

    if (openPopupForBurial(pendingBurial)) {
      pendingPopupBurialRef.current = null;
    }
  }, [activeBurialId, openPopupForBurial, selectedBurials, selectedTour, shouldUseMapPopups]);

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
  }, [activeBurialId, openPopupForBurial, selectedBurials, shouldUseMapPopups]);

  /**
   * Keep markercluster child-marker styling in sync after zoom changes.
   * The delayed resync catches markers that markercluster rehydrates after the
   * immediate `zoomend` handler has already run.
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
    scheduleSectionTooltipSync();

    return () => {
      if (sectionTooltipSyncFrameRef.current && typeof window !== 'undefined') {
        window.cancelAnimationFrame(sectionTooltipSyncFrameRef.current);
        sectionTooltipSyncFrameRef.current = null;
      }
    };
  }, [currentZoom, scheduleSectionTooltipSync, sectionFilter, showAllBurials]);

  useEffect(() => {
    const map = getMapInstance();
    if (!map) return undefined;
    const container = typeof map.getContainer === 'function' ? map.getContainer() : null;
    // Section polygon hover is mouse-first. Map movement, pointer leave, window
    // blur, and touch input all clear hover state so tooltips cannot get stuck.
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
  }, [clearHoveredSection, getMapInstance, markSectionInputMode]);

  useEffect(() => {
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
  }, [clearHoveredBurialIfCurrent, getMapInstance]);

  // Browse mode transitions keep section and tour views mutually exclusive.
  // They also clear active burial focus so the map does not show stale context
  // from a previous search or tour selection.
  const resetMapToDefaultBounds = useCallback(({ isExplicitFocus = false } = {}) => {
    const map = getMapInstance();
    if (!map) return;

    fitMapBoundsInViewport(map, DEFAULT_VIEW_BOUNDS, { isExplicitFocus });
  }, [fitMapBoundsInViewport, getMapInstance]);

  const focusSectionOnMap = useCallback((
    sectionValue,
    bounds,
    { isExplicitFocus = false } = {}
  ) => {
    const map = getMapInstance();
    if (!map || !sectionValue) return;

    const sectionBounds = bounds || sectionBoundsById.get(String(sectionValue));
    if (!isRenderableBounds(sectionBounds)) {
      return;
    }

    fitMapBoundsInViewport(map, sectionBounds, {
      isExplicitFocus,
      maxZoom: sectionBrowseFocusMaxZoom,
    });
  }, [fitMapBoundsInViewport, getMapInstance, sectionBoundsById, sectionBrowseFocusMaxZoom]);

  const activateSectionBrowse = useCallback((
    sectionValue,
    bounds,
    {
      filterType: nextFilterType = "lot",
      focusMap = true,
      isExplicitFocus = true,
      lotTierFilter: nextLotTierFilter = "",
    } = {}
  ) => {
    const nextSection = sectionValue || "";
    const normalizedFilterType = nextFilterType === "tier" ? "tier" : "lot";
    requestBurialDataLoad();
    clearHoveredSection();
    clearActiveBurialFocus({ clearHover: true });
    setSectionFilter(nextSection);
    setLotTierFilter(nextSection ? cleanRecordValue(nextLotTierFilter) : "");
    setFilterType(nextSection ? normalizedFilterType : "lot");

    if (nextSection) {
      setSelectedTour(null);
      setShowAllBurials(true);
      if (focusMap) {
        focusSectionOnMap(nextSection, bounds, { isExplicitFocus });
      }
      return;
    }

    setShowAllBurials(false);
  }, [clearActiveBurialFocus, clearHoveredSection, focusSectionOnMap, requestBurialDataLoad]);
  activateSectionBrowseRef.current = activateSectionBrowse;

  const clearSectionFilters = useCallback(() => {
    clearActiveBurialFocus({ clearHover: true });
    setLotTierFilter("");
    setFilterType("lot");
    setSectionFilter("");
    setShowAllBurials(false);
    resetMapToDefaultBounds({ isExplicitFocus: true });
  }, [clearActiveBurialFocus, resetMapToDefaultBounds]);

  const handleTourSelect = useCallback((tourName, { isExplicitFocus = true } = {}) => {
    if (tourName && isExplicitFocus) {
      markExplicitViewportFocus();
    }
    clearActiveBurialFocus({ clearHover: true });
    setSelectedTour(tourName);
    setSectionFilter("");
    setLotTierFilter("");
    setFilterType("lot");
    setShowAllBurials(false);
  }, [clearActiveBurialFocus, markExplicitViewportFocus]);

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
      // Packed share links carry the most complete restored state. Apply them
      // before loose query params so the client does not merge two competing
      // selection sources.
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
        handleTourSelect(nextFieldPacket.selectedTour, { isExplicitFocus: false });
      } else if (nextFieldPacket.sectionFilter) {
        activateSectionBrowse(nextFieldPacket.sectionFilter, undefined, { isExplicitFocus: false });
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
      handleTourSelect(deepLink.selectedTourName, { isExplicitFocus: false });
    } else if (deepLink.section) {
      activateSectionBrowse(deepLink.section, undefined, { isExplicitFocus: false });
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
   * Register section polygon lifecycle and interaction handlers. Each Leaflet
   * section layer is stored by id so hover/tooltip cleanup can run even when
   * React re-renders the GeoJSON layer.
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

  // Tour layers are loaded once, sanitized, converted into browse records, then
  // cached as Leaflet layers. Section-detail browse reuses this same path for
  // projected headstone datasets that are authored as tour-like GeoJSON.
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
      const recordDefaults = definition.sectionBrowse?.recordDefaults || null;
      const sourceFeatures = (module.default.features || []).map((feature) => (
        recordDefaults
          ? {
            ...feature,
            properties: {
              ...recordDefaults,
              ...(feature.properties || {}),
            },
          }
          : feature
      ));
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
    clearHoveredBurialIfCurrent,
    handleOpenDirectionsMenu,
    handlePopupBurialClose,
    handlePopupBurialOpen,
    handleHoverBurialChange,
    removeFromResults,
    resolveTourBrowseResult,
    schedulePopupLayout,
    selectBurial,
    tourDefinitionsByName,
    tourStyles,
  ]);

  /**
   * Some precise section marker positions live in projected headstone datasets
   * that also back tour views. Load the matching detail layer when section
   * browse is active so default section markers use the richer source.
   */
  useEffect(() => {
    if (!sectionDetailTourName) return;
    void ensureTourLayerLoaded(sectionDetailTourName);
  }, [ensureTourLayerLoaded, sectionDetailTourName]);

  /**
   * Load the selected tour layer on demand.
   */
  useEffect(() => {
    if (!selectedTour) return;
    void ensureTourLayerLoaded(selectedTour);
  }, [selectedTour, ensureTourLayerLoaded]);

  useEffect(() => {
    if (!selectedTour || !selectedTourBounds) return;
    if (!selectedTourLayer) return;
    focusTourOnMap(selectedTour);
  }, [
    focusTourOnMap,
    selectedTour,
    selectedTourBounds,
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

  // Render order matters: sidebar/menu chrome overlays the map, static layers
  // mount inside MapContainer, then transient location/route/selection layers sit
  // above them so active context stays visible.
  return (
    <div className="map-container">
      {isSearchPanelVisible && (
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
          onBrowseResultSelect={handleBrowseResultSelect}
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
          onRequestHideChrome={handleToggleSearchPanel}
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
          sectionRecordsOverride={sectionRecordsOverride}
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
      )}

      <Menu
        anchorEl={appMenuAnchorEl}
        open={appMenuOpen}
        onClose={handleCloseAppMenu}
      >
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

      <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          className="map"
          attributionControl={false}
          bounceAtZoomLimits={false}
          zoomControl={false}
          fadeAnimation={!shouldReduceMapMotion}
          maxZoom={activeBasemapMaxZoom}
          markerZoomAnimation={!shouldReduceMapMotion}
          tapTolerance={isMobile ? 18 : 15}
          touchZoom
          zoomDelta={isMobile ? 0.5 : 1}
          zoomAnimation={!shouldReduceMapMotion}
          zoomSnap={isMobile ? 0.5 : 1}
        >
          <MapStaticLayers
            activeBasemap={activeBasemap}
            activeBasemapMaxZoom={activeBasemapMaxZoom}
            boundaryData={boundaryData}
            fitMapBoundsInViewport={fitMapBoundsInViewport}
            getSectionStyle={getSectionStyle}
            isLayerControlOpen={isLayerControlOpen}
            isMobile={isMobile}
            isSearchPanelVisible={isSearchPanelVisible}
            mapRef={mapRef}
            onBasemapChange={handleBasemapChange}
            onEachSectionFeature={onEachSectionFeature}
            onLayerControlOpenChange={setIsLayerControlOpen}
            onLocateMarker={onLocateMarker}
            onSelectSection={activateSectionBrowse}
            onToggleSearchPanel={handleToggleSearchPanel}
            onViewportMoveStart={handleViewportMoveStart}
            onToggleOverlay={handleToggleOverlay}
            overlayVisibility={overlayVisibility}
            overlayMaps={overlayMaps}
            roadsData={roadsData}
            onZoomChange={handleZoomEnd}
            sectionsData={sectionsData}
            sectionAffordanceMarkers={sectionAffordanceMarkers}
            sectionOverviewMarkers={sectionOverviewMarkers}
            selectedTour={selectedTour}
            showRoads={showRoads}
            showSectionAffordanceMarkers={overlayVisibility.sections && showSectionAffordanceMarkers}
            showSectionClusterMarkers={overlayVisibility.sections && showSectionClusterMarkers}
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
              key={routeGeoJsonRenderKey}
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

          {selectedBurials.map((burial, index) => {
            const displayCoordinates = selectedBurialDisplayCoordinatesById.get(cleanRecordValue(burial.id)) ||
              burial.coordinates;

            return (
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
                position={[displayCoordinates[1], displayCoordinates[0]]}
                icon={createNumberedIcon(index + 1)}
                keyboard={false}
                eventHandlers={{
                  mouseover: () => handleHoverBurialChange(burial.id),
                  mouseout: () => clearHoveredBurialIfCurrent(burial.id),
                  click: () => selectMapBurial(burial, {
                    animate: false,
                    openTourPopup: true,
                    preserveViewport: true,
                  }),
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
            );
          })}
        </MapContainer>
    </div>
  );
}
