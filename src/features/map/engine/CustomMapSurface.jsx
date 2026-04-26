import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { getGeoJsonBounds, isLatLngBoundsExpressionValid } from "../../../shared/geo/geoJsonBounds";
import { buildPublicAssetUrl } from "../../../shared/runtime/runtimeEnv";
import { PopupCardContent } from "../popupCardContent";
import { getPopupViewportPadding } from "../popupViewport";
import {
  formatSectionOverviewMarkerLabel,
  MAP_PRESENTATION_POLICY,
  resolveClusterExpansionZoom,
  resolveSectionBurialDisableClusteringZoom,
  getSectionBurialMarkerStyle,
  getSectionPolygonStyle,
  ROAD_LAYER_STYLE,
} from "../mapDomain";
import { buildSiteTwinPointEntries, isSiteTwinReady } from "../siteTwin";
import { createCustomMapRuntime } from "./customRuntime";

const EMPTY_SECTION_OVERVIEW_MARKERS = [];
const POPUP_ANCHOR_GAP = 14;
const POPUP_MIN_ANCHOR_INSET = 28;
const POPUP_AUTOPAN_EPSILON = 0.5;
const SITE_TWIN_DISABLE_CLUSTERING_ZOOM = 18;
const BURIAL_HOVER_LAYER_IDS = new Set([
  "selected-burials",
  "section-burials",
  "tour-results",
]);
const formatSectionClusterCountLabel = (count = 0) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (normalizedCount >= 1000) {
    return `${(normalizedCount / 1000).toFixed(normalizedCount >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  }

  return String(normalizedCount);
};

const getSectionClusterMarkerRadius = (count = 0) => {
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (normalizedCount >= 3000) return 17;
  if (normalizedCount >= 1500) return 16;
  if (normalizedCount >= 700) return 15.5;
  return 15;
};

const buildPointFeatureCollection = (points) => ({
  type: "FeatureCollection",
  features: points
    .filter((entry) => Array.isArray(entry?.coordinates))
    .map((entry) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: entry.coordinates,
      },
    })),
});

const getLatLngBoundsCenter = (bounds) => {
  if (!isLatLngBoundsExpressionValid(bounds)) {
    return null;
  }

  const [[south, west], [north, east]] = bounds;
  return {
    lat: (south + north) / 2,
    lng: (west + east) / 2,
  };
};

const buildPopupAutoPanPadding = ({
  containerRect,
  overlayRect,
  popupRect,
  popupLayout,
}) => {
  const { topLeft, bottomRight } = getPopupViewportPadding({
    containerRect,
    overlayRect,
  });
  const anchorX = Number.isFinite(popupLayout?.anchorX)
    ? popupLayout.anchorX
    : popupRect.width / 2;
  const popupHeight = Math.ceil(popupRect.height + POPUP_ANCHOR_GAP);

  return {
    paddingTopLeft: [
      Math.ceil(topLeft[0] + anchorX),
      Math.ceil(topLeft[1] + (popupLayout?.placement === "top" ? popupHeight : 0)),
    ],
    paddingBottomRight: [
      Math.ceil(bottomRight[0] + Math.max(0, popupRect.width - anchorX)),
      Math.ceil(bottomRight[1] + (popupLayout?.placement === "bottom" ? popupHeight : 0)),
    ],
  };
};

const isPointInsideAutoPanViewport = ({
  containerRect,
  popupPosition,
  paddingTopLeft,
  paddingBottomRight,
}) => {
  if (!containerRect || !popupPosition) {
    return true;
  }

  const minX = paddingTopLeft[0];
  const minY = paddingTopLeft[1];
  const maxX = containerRect.width - paddingBottomRight[0];
  const maxY = containerRect.height - paddingBottomRight[1];

  return (
    popupPosition.x >= minX - POPUP_AUTOPAN_EPSILON &&
    popupPosition.x <= maxX + POPUP_AUTOPAN_EPSILON &&
    popupPosition.y >= minY - POPUP_AUTOPAN_EPSILON &&
    popupPosition.y <= maxY + POPUP_AUTOPAN_EPSILON
  );
};

const createRuntimeLayerHandle = (record, source, runtimeRef) => ({
  openPopup: () => {
    if (!Array.isArray(record?.coordinates) || !runtimeRef.current) {
      return false;
    }

    runtimeRef.current.openPopup({
      id: `${source}:${record.id}`,
      coordinates: record.coordinates,
      meta: { record, source },
    });
    return true;
  },
  getPopup: () => {
    const popupState = runtimeRef.current?.getPopupState?.();
    if (!popupState?.meta?.record || popupState.meta.record.id !== record.id) {
      return null;
    }

    return runtimeRef.current?.popupHandle || null;
  },
});

export function CustomMapSurface({
  activeBurialId,
  basemap,
  boundaryData,
  defaultCenter,
  defaultZoom,
  hoveredBurialId,
  locationAccuracyGeoJson,
  mapRef,
  markerColors,
  getOverlayElement,
  maxBounds,
  maxZoom = 25,
  minZoom = 13,
  onActivateSectionBrowse,
  onHoverBurialChange,
  onOpenDirectionsMenu,
  onPopupClose,
  onPopupOpen,
  onRemoveSelectedBurial,
  onSelectBurial,
  onZoomChange,
  roadsData,
  routeGeoJson,
  schedulePopupLayout,
  sectionAffordanceMarkers = EMPTY_SECTION_OVERVIEW_MARKERS,
  sectionBurials,
  sectionFilter,
  sectionOverviewMarkers = EMPTY_SECTION_OVERVIEW_MARKERS,
  sectionsData,
  selectedBurials,
  selectedMarkerLayersRef,
  selectedTourResults,
  showSiteTwin = false,
  showSiteTwinMonuments = true,
  showSiteTwinSurface = true,
  showBoundary = true,
  shouldUseMapPopups,
  showAllBurials,
  showRoads = false,
  showSectionAffordanceMarkers = false,
  showSectionClusterMarkers = false,
  showSections = true,
  showSectionOverviewMarkers = false,
  siteTwinCandidates,
  siteTwinMonumentHeightScale = 1,
  siteTwinManifest,
  siteTwinSurfaceOpacity,
  trackedLocation,
  tourFeatureLayersRef,
  tourStyles,
}) {
  const containerRef = useRef(null);
  const popupShellRef = useRef(null);
  const previousPopupRecordRef = useRef(null);
  const runtimeRef = useRef(null);
  const [popupState, setPopupState] = useState(null);
  const [popupLayout, setPopupLayout] = useState(null);
  const [hoveredSectionId, setHoveredSectionId] = useState(null);
  const [, setPopupVersion] = useState(0);

  const selectedMarkerColorById = useMemo(
    () => new Map(
      selectedBurials.map((record, index) => [
        record.id,
        markerColors[index % markerColors.length],
      ])
    ),
    [markerColors, selectedBurials]
  );
  const sectionBurialDisableClusteringZoom = useMemo(
    () => resolveSectionBurialDisableClusteringZoom({ maxZoom }),
    [maxZoom]
  );
  const sectionBurialClusterRadius = MAP_PRESENTATION_POLICY.sectionBurialClusterRadius;
  const getRuntimePopupHandle = useCallback(
    () => runtimeRef.current?.popupHandle || null,
    []
  );

  const syncPopupState = useCallback(() => {
    setPopupState(runtimeRef.current?.getPopupState?.() || null);
    setPopupVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const runtime = createCustomMapRuntime({
      center: defaultCenter,
      zoom: defaultZoom,
      minZoom,
      maxZoom,
      maxBounds,
      basemapSpec: basemap,
    });

    runtime.mount(containerRef.current);
    if (maxBounds) {
      runtime.fitBounds(maxBounds, { maxZoom: defaultZoom });
    }
    runtimeRef.current = runtime;
    mapRef.current = runtime;

    const handleZoomEnd = (event) => {
      onZoomChange?.(event);
      setPopupVersion((current) => current + 1);
    };
    const handleMoveEnd = () => {
      setPopupVersion((current) => current + 1);
    };

    runtime.on("popupopen", syncPopupState);
    runtime.on("popupclose", syncPopupState);
    runtime.on("popupupdate", syncPopupState);
    runtime.on("zoomend", handleZoomEnd);
    runtime.on("moveend", handleMoveEnd);

    return () => {
      runtime.off("popupopen", syncPopupState);
      runtime.off("popupclose", syncPopupState);
      runtime.off("popupupdate", syncPopupState);
      runtime.off("zoomend", handleZoomEnd);
      runtime.off("moveend", handleMoveEnd);
      runtime.destroy();
      runtimeRef.current = null;
      if (mapRef.current === runtime) {
        mapRef.current = null;
      }
    };
  }, [
    basemap,
    defaultCenter,
    defaultZoom,
    mapRef,
    maxBounds,
    maxZoom,
    minZoom,
    onZoomChange,
    syncPopupState,
  ]);

  useEffect(() => {
    runtimeRef.current?.setBasemap?.(basemap);
  }, [basemap]);

  const layerSpecs = useMemo(() => {
    const nextLayers = [];
    const siteTwinPoints = buildSiteTwinPointEntries(siteTwinCandidates);

    if (showSiteTwin && showSiteTwinSurface && isSiteTwinReady(siteTwinManifest)) {
      nextLayers.push({
        id: "site-twin-surface",
        kind: "image",
        url: buildPublicAssetUrl(siteTwinManifest.terrainImage.url),
        bounds: siteTwinManifest.terrainImage.bounds,
        opacity: Number.isFinite(siteTwinSurfaceOpacity)
          ? siteTwinSurfaceOpacity
          : siteTwinManifest.terrainImage.opacity,
        smoothing: true,
      });
    }

    if (showRoads) {
      nextLayers.push({
        id: "roads",
        kind: "geojson",
        geojson: roadsData,
        style: ROAD_LAYER_STYLE,
      });
    }

    if (showBoundary) {
      nextLayers.push({
        id: "boundary",
        kind: "geojson",
        geojson: boundaryData,
        style: {
          color: "#ffffff",
          weight: 1.5,
          fillOpacity: 0.08,
          fillColor: "#ffffff",
        },
      });
    }

    if (showSections) {
      nextLayers.push({
        id: "sections",
        kind: "geojson",
        geojson: sectionsData,
        interactive: true,
        featureId: (feature) => String(feature?.properties?.Section || ""),
        style: (feature) => getSectionPolygonStyle({
          sectionId: feature?.properties?.Section,
          activeSectionId: sectionFilter,
          hoveredSectionId,
          showAllBurials,
        }),
        onFeatureClick: ({ target }) => {
          const feature = target?.feature;
          const sectionValue = feature?.properties?.Section;
          if (!sectionValue) {
            return;
          }

          onActivateSectionBrowse?.(sectionValue, getGeoJsonBounds(feature));
        },
      });
    }

    if (showSections && showSectionAffordanceMarkers) {
      nextLayers.push({
        id: "section-affordances",
        kind: "points",
        interactive: true,
        points: sectionAffordanceMarkers
          .filter((entry) => Number.isFinite(entry?.lat) && Number.isFinite(entry?.lng))
          .map((entry) => ({
            id: entry.id,
            coordinates: [entry.lng, entry.lat],
            record: entry,
          })),
        pointStyle: (entry) => {
          const markerSize = Number(entry?.record?.size);
          const radius = Number.isFinite(markerSize) ? markerSize / 2 : 13;

          return {
            variant: "grave-affordance",
            radius,
            fillColor: "rgba(108, 121, 131, 0.3)",
            color: "rgba(242, 247, 249, 0.84)",
            glyphColor: "rgba(255, 255, 255, 0.84)",
            haloColor: "rgba(255, 255, 255, 0.12)",
            weight: 1.35,
            hitRadius: Math.max(18, radius + 5),
          };
        },
        onPointClick: ({ target }) => {
          const markerRecord = target?.pointEntry?.record;
          if (!markerRecord?.sectionValue) {
            return;
          }

          onActivateSectionBrowse?.(markerRecord.sectionValue, markerRecord.bounds);
        },
      });
    }

    if (showSections && showSectionClusterMarkers) {
      nextLayers.push({
        id: "section-clusters",
        kind: "points",
        interactive: true,
        points: sectionOverviewMarkers
          .filter((entry) => Number.isFinite(entry?.lat) && Number.isFinite(entry?.lng))
          .map((entry) => ({
            id: entry.id,
            coordinates: [entry.lng, entry.lat],
            record: entry,
          })),
        pointStyle: (entry) => {
          const count = Number(entry?.record?.count) || 0;
          return {
            variant: "section-cluster",
            count,
            labelText: formatSectionClusterCountLabel(count),
            radius: getSectionClusterMarkerRadius(count),
            hitRadius: 20,
          };
        },
        onPointClick: ({ target }) => {
          const markerRecord = target?.pointEntry?.record;
          if (!markerRecord?.sectionValue) {
            return;
          }

          onActivateSectionBrowse?.(markerRecord.sectionValue, markerRecord.bounds);
        },
      });
    }

    if (showSections && showSectionOverviewMarkers) {
      nextLayers.push({
        id: "section-overview",
        kind: "points",
        interactive: true,
        points: sectionOverviewMarkers
          .filter((entry) => Number.isFinite(entry?.lat) && Number.isFinite(entry?.lng))
          .map((entry) => ({
            id: entry.id,
            coordinates: [entry.lng, entry.lat],
            record: entry,
          })),
        pointStyle: (entry, runtime) => {
          const markerSectionId = String(entry?.record?.sectionValue || "");
          const isActive = markerSectionId === `${sectionFilter}`;
          const isHovered = markerSectionId && markerSectionId === hoveredSectionId;
          const baseRadius = entry?.record?.count >= 2000 ? 9 : entry?.record?.count >= 800 ? 8 : 7;
          const shouldShowLabel = isActive || isHovered || (runtime?.getZoom?.() || 0) >= 16;

          return {
            radius: baseRadius + (isActive ? 2 : isHovered ? 1 : 0),
            fillColor: isActive ? "#2c5282" : isHovered ? "#f4f8fb" : "#ffffff",
            fillOpacity: isActive ? 0.98 : isHovered ? 0.96 : 0.94,
            color: isActive ? "#173a5d" : isHovered ? "rgba(29, 63, 54, 0.72)" : "rgba(29, 63, 54, 0.45)",
            weight: isActive ? 2.5 : isHovered ? 2.25 : 2,
            hitRadius: baseRadius + 9,
            labelText: shouldShowLabel ? formatSectionOverviewMarkerLabel(entry?.record) : "",
            labelColor: isActive ? "#173a5d" : "#324454",
            labelSize: isActive || isHovered ? 12.5 : 11.5,
          };
        },
        onPointClick: ({ target }) => {
          const markerRecord = target?.pointEntry?.record;
          if (!markerRecord?.sectionValue) {
            return;
          }

          onActivateSectionBrowse?.(markerRecord.sectionValue, markerRecord.bounds);
        },
      });
    }

    if (routeGeoJson?.features?.length) {
      nextLayers.push({
        id: "active-route",
        kind: "geojson",
        geojson: routeGeoJson,
        style: {
          color: "#0f67c6",
          weight: 5,
          opacity: 0.86,
        },
      });
    }

    if (locationAccuracyGeoJson?.features?.length) {
      nextLayers.push({
        id: "user-location-accuracy",
        kind: "geojson",
        geojson: locationAccuracyGeoJson,
        style: {
          color: "#185e4a",
          weight: 2,
          opacity: 0.72,
          fillColor: "#2f8f73",
          fillOpacity: 0.16,
        },
      });
    }

    if (
      Number.isFinite(trackedLocation?.latitude) &&
      Number.isFinite(trackedLocation?.longitude)
    ) {
      nextLayers.push({
        id: "user-location",
        kind: "points",
        interactive: false,
        points: [{
          id: "user-location",
          coordinates: [trackedLocation.longitude, trackedLocation.latitude],
          record: trackedLocation,
        }],
        pointStyle: {
          radius: 9,
          fillColor: "#1f8a69",
          fillOpacity: 0.96,
          color: "#ffffff",
          weight: 3,
        },
      });
    }

    if (showSiteTwin && showSiteTwinMonuments && siteTwinPoints.length > 0) {
      nextLayers.push({
        id: "site-twin-monuments",
        kind: "points",
        clustered: true,
        clusterRadius: 28,
        disableClusteringAtZoom: SITE_TWIN_DISABLE_CLUSTERING_ZOOM,
        points: siteTwinPoints,
        pointStyle: (entry) => {
          const knownHeadstone = Boolean(entry?.record?.knownHeadstone);
          const heightMeters = Number.isFinite(entry?.record?.heightMeters)
            ? entry.record.heightMeters
            : 0.7;
          const confidence = Number.isFinite(entry?.record?.confidence)
            ? entry.record.confidence
            : 0.45;

          return {
            variant: "monument",
            heightMeters,
            heightScale: siteTwinMonumentHeightScale,
            baseWidthMeters: knownHeadstone ? 1.15 : 0.95,
            baseDepthMeters: knownHeadstone ? 0.58 : 0.48,
            fillColor: knownHeadstone ? "#d6b288" : "#c9a87a",
            frontColor: knownHeadstone ? "#c59b69" : "#bc9667",
            sideColor: knownHeadstone ? "#aa7e50" : "#9c7247",
            topColor: knownHeadstone ? "#f3e3cb" : "#ead6b8",
            color: "rgba(92, 59, 24, 0.9)",
            shadowOpacity: 0.14 + (confidence * 0.16),
            hitRadius: 8,
          };
        },
      });
    }

    if (showAllBurials && sectionFilter) {
      nextLayers.push({
        id: "section-burials",
        kind: "points",
        interactive: true,
        clustered: true,
        disableClusteringAtZoom: sectionBurialDisableClusteringZoom,
        clusterRadius: sectionBurialClusterRadius,
        points: sectionBurials
          .filter((record) => Array.isArray(record?.coordinates))
          .map((record) => ({
            id: record.id,
            coordinates: record.coordinates,
            record,
          })),
        pointStyle: (entry, runtime) => {
          const isActive = entry?.record?.id === runtime?.selectionState?.activeId;
          const isHovered = entry?.record?.id === runtime?.selectionState?.hoveredId;

          return getSectionBurialMarkerStyle(entry?.record, {
            currentZoom: runtime?.getZoom?.(),
            individualMarkerMinZoom: sectionBurialDisableClusteringZoom,
            isActive,
            isHovered,
          });
        },
        onPointClick: ({ target }) => {
          const record = target?.pointEntry?.record;
          if (record) {
            onSelectBurial?.(record, {
              animate: false,
              openTourPopup: true,
              preserveViewport: true,
            });
          }
        },
        onClusterClick: ({ target, runtime }) => {
          const clusterMembers = Array.isArray(target?.pointEntry?.members)
            ? target.pointEntry.members
            : [];
          const clusterBounds = getGeoJsonBounds(buildPointFeatureCollection(
            clusterMembers.map((member) => ({
              coordinates: member?.coordinates || member?.member?.coordinates || member?.record?.coordinates,
            }))
          ));

          if (isLatLngBoundsExpressionValid(clusterBounds)) {
            const currentZoom = runtime?.getZoom?.();
            const targetZoom = resolveClusterExpansionZoom({
              currentZoom,
              disableClusteringAtZoom: sectionBurialDisableClusteringZoom,
            });
            const targetCenter = getLatLngBoundsCenter(clusterBounds);

            if (
              targetCenter &&
              Number.isFinite(currentZoom) &&
              targetZoom > currentZoom &&
              typeof runtime?.setView === "function"
            ) {
              runtime.setView(targetCenter, targetZoom);
              return;
            }

            runtime.fitBounds(clusterBounds, { maxZoom: targetZoom });
          }
        },
      });
    }

    if (Array.isArray(selectedTourResults) && selectedTourResults.length > 0) {
      nextLayers.push({
        id: "tour-results",
        kind: "points",
        interactive: true,
        points: selectedTourResults
          .filter((record) => Array.isArray(record?.coordinates))
          .map((record) => ({
            id: record.id,
            coordinates: record.coordinates,
            record,
          })),
        pointStyle: (entry, runtime) => {
          const isActive = entry?.record?.id === runtime?.selectionState?.activeId;
          const isHovered = entry?.record?.id === runtime?.selectionState?.hoveredId;
          const color = tourStyles?.[entry?.record?.tourKey]?.color ||
            tourStyles?.[entry?.record?.title]?.color ||
            "#c96e1f";

          return {
            radius: isActive ? 7.5 : isHovered ? 6.75 : 6,
            fillColor: color,
            fillOpacity: isActive ? 0.96 : isHovered ? 0.92 : 0.88,
            color: "#ffffff",
            weight: isActive || isHovered ? 2.75 : 2,
            hitRadius: isActive ? 18 : isHovered ? 16 : 14,
          };
        },
        onPointClick: ({ target }) => {
          const record = target?.pointEntry?.record;
          if (record) {
            onSelectBurial?.(record, {
              animate: false,
              openTourPopup: true,
              preserveViewport: true,
            });
          }
        },
      });
    }

    if (Array.isArray(selectedBurials) && selectedBurials.length > 0) {
      nextLayers.push({
        id: "selected-burials",
        kind: "points",
        interactive: true,
        points: selectedBurials
          .filter((record) => Array.isArray(record?.coordinates))
          .map((record, index) => ({
            id: record.id,
            coordinates: record.coordinates,
            index,
            record,
          })),
        pointStyle: (entry, runtime) => {
          const color = selectedMarkerColorById.get(entry.id) || "#e41a1c";
          const isHighlighted = (
            runtime?.selectionState?.hoveredId === entry.id ||
            runtime?.selectionState?.activeId === entry.id
          );
          return {
            variant: "numbered",
            label: entry.index + 1,
            fillColor: color,
            color: "#ffffff",
            radius: isHighlighted ? 16 : 12,
            outlineWidth: isHighlighted ? 3 : 2,
            hitRadius: isHighlighted ? 20 : 16,
          };
        },
        onPointClick: ({ target }) => {
          const record = target?.pointEntry?.record;
          if (record) {
            onSelectBurial?.(record, {
              animate: false,
              openTourPopup: true,
              preserveViewport: true,
            });
          }
        },
      });
    }

    return nextLayers;
  }, [
    boundaryData,
    locationAccuracyGeoJson,
    onActivateSectionBrowse,
    onSelectBurial,
    roadsData,
    routeGeoJson,
    sectionAffordanceMarkers,
    sectionBurials,
    sectionBurialClusterRadius,
    sectionBurialDisableClusteringZoom,
    sectionFilter,
    sectionOverviewMarkers,
    sectionsData,
    selectedBurials,
    selectedMarkerColorById,
    selectedTourResults,
    showBoundary,
    showAllBurials,
    showRoads,
    showSectionAffordanceMarkers,
    showSectionClusterMarkers,
    showSections,
    showSectionOverviewMarkers,
    showSiteTwin,
    showSiteTwinMonuments,
    showSiteTwinSurface,
    hoveredSectionId,
    siteTwinCandidates,
    siteTwinMonumentHeightScale,
    siteTwinManifest,
    siteTwinSurfaceOpacity,
    trackedLocation,
    tourStyles,
  ]);

  useEffect(() => {
    runtimeRef.current?.setLayers?.(layerSpecs);
  }, [layerSpecs]);

  useEffect(() => {
    runtimeRef.current?.setSelection?.({
      activeId: activeBurialId,
      hoveredId: hoveredBurialId,
      ids: selectedBurials.map((record) => record.id),
    });
  }, [activeBurialId, hoveredBurialId, selectedBurials]);

  useEffect(() => {
    setHoveredSectionId(null);
  }, [sectionFilter, showSectionClusterMarkers, showSectionOverviewMarkers]);

  useEffect(() => {
    if (!selectedMarkerLayersRef) {
      return;
    }

    const handles = new Map(
      selectedBurials.map((record) => [
        record.id,
        createRuntimeLayerHandle(record, "selected", runtimeRef),
      ])
    );
    selectedMarkerLayersRef.current = handles;

    return () => {
      if (selectedMarkerLayersRef.current === handles) {
        selectedMarkerLayersRef.current = new Map();
      }
    };
  }, [selectedBurials, selectedMarkerLayersRef]);

  useEffect(() => {
    if (!tourFeatureLayersRef) {
      return;
    }

    const handles = new Map(
      (selectedTourResults || []).map((record) => [
        record.id,
        createRuntimeLayerHandle(record, "tour", runtimeRef),
      ])
    );
    tourFeatureLayersRef.current = handles;

    return () => {
      if (tourFeatureLayersRef.current === handles) {
        tourFeatureLayersRef.current = new Map();
      }
    };
  }, [selectedTourResults, tourFeatureLayersRef]);

  useEffect(() => {
    const popupRecord = popupState?.meta?.record;
    if (!popupRecord) {
      return;
    }

    const stillSelected = selectedBurials.some((record) => record.id === popupRecord.id);
    const stillInTour = (selectedTourResults || []).some((record) => record.id === popupRecord.id);

    if (!stillSelected && !stillInTour) {
      runtimeRef.current?.closePopup?.();
    }
  }, [popupState, selectedBurials, selectedTourResults]);

  const popupPosition = popupState
    ? runtimeRef.current?.getPopupScreenPoint?.() || null
    : null;

  const popupRecord = popupState?.meta?.record || null;

  useEffect(() => {
    const previousPopupRecord = previousPopupRecordRef.current;

    if (previousPopupRecord?.id && previousPopupRecord.id !== popupRecord?.id) {
      onPopupClose?.(previousPopupRecord);
    }

    if (popupRecord?.id && popupRecord.id !== previousPopupRecord?.id) {
      onPopupOpen?.(popupRecord);
    }

    previousPopupRecordRef.current = popupRecord || null;
  }, [onPopupClose, onPopupOpen, popupRecord]);

  const updatePopupLayout = useCallback(() => {
    const container = containerRef.current;
    const popupShell = popupShellRef.current;
    if (!container || !popupShell || !popupPosition || !popupRecord) {
      setPopupLayout(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const overlayRect = getOverlayElement?.()?.getBoundingClientRect?.() || null;
    const { topLeft, bottomRight } = getPopupViewportPadding({
      containerRect,
      overlayRect,
    });
    const popupRect = popupShell.getBoundingClientRect();
    const minLeft = topLeft[0];
    const minTop = topLeft[1];
    const maxLeft = Math.max(minLeft, containerRect.width - bottomRight[0] - popupRect.width);
    const maxTop = Math.max(minTop, containerRect.height - bottomRight[1] - popupRect.height);
    const preferredLeft = popupPosition.x - (popupRect.width / 2);
    const preferredTop = popupPosition.y - popupRect.height - POPUP_ANCHOR_GAP;
    const preferredBottom = popupPosition.y + POPUP_ANCHOR_GAP;
    const fitsAbove = preferredTop >= minTop;
    const fitsBelow = preferredBottom <= maxTop;

    let placement = "top";
    let nextTop = preferredTop;

    if (!fitsAbove && fitsBelow) {
      placement = "bottom";
      nextTop = preferredBottom;
    } else if (!fitsAbove) {
      const spaceAbove = popupPosition.y - minTop;
      const spaceBelow = maxTop - popupPosition.y;
      placement = spaceBelow > spaceAbove ? "bottom" : "top";
      nextTop = placement === "bottom" ? preferredBottom : preferredTop;
    }

    const nextLayout = {
      placement,
      left: Math.max(minLeft, Math.min(maxLeft, preferredLeft)),
      top: Math.max(minTop, Math.min(maxTop, nextTop)),
      anchorX: Math.max(
        POPUP_MIN_ANCHOR_INSET,
        Math.min(
          popupRect.width - POPUP_MIN_ANCHOR_INSET,
          popupPosition.x - Math.max(minLeft, Math.min(maxLeft, preferredLeft))
        )
      ),
    };

    setPopupLayout((current) => (
      current &&
      current.placement === nextLayout.placement &&
      current.left === nextLayout.left &&
      current.top === nextLayout.top &&
      current.anchorX === nextLayout.anchorX
        ? current
        : nextLayout
    ));
  }, [getOverlayElement, popupPosition, popupRecord]);

  useEffect(() => {
    if (!shouldUseMapPopups && popupState) {
      runtimeRef.current?.closePopup?.();
    }
  }, [popupState, shouldUseMapPopups]);

  useLayoutEffect(() => {
    if (!shouldUseMapPopups || !popupRecord || !popupPosition) {
      setPopupLayout(null);
      return;
    }

    updatePopupLayout();
  }, [popupPosition, popupRecord, shouldUseMapPopups, updatePopupLayout]);

  useLayoutEffect(() => {
    const runtime = runtimeRef.current;
    const container = containerRef.current;
    const popupShell = popupShellRef.current;

    if (!runtime || !popupState?.coordinates || !popupLayout || !popupPosition || !container || !popupShell) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const overlayRect = getOverlayElement?.()?.getBoundingClientRect?.() || null;
    const popupRect = popupShell.getBoundingClientRect();
    const { paddingTopLeft, paddingBottomRight } = buildPopupAutoPanPadding({
      containerRect,
      overlayRect,
      popupRect,
      popupLayout,
    });

    if (isPointInsideAutoPanViewport({
      containerRect,
      popupPosition,
      paddingTopLeft,
      paddingBottomRight,
    })) {
      return;
    }

    runtime.panInside?.(
      {
        lat: popupState.coordinates[1],
        lng: popupState.coordinates[0],
      },
      {
        animate: false,
        paddingTopLeft,
        paddingBottomRight,
      }
    );
  }, [
    getOverlayElement,
    popupLayout,
    popupPosition,
    popupState,
  ]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return undefined;
    }

    const handleHover = ({ target }) => {
      if (BURIAL_HOVER_LAYER_IDS.has(target?.layerId)) {
        setHoveredSectionId(null);
        if (target?.kind !== "point") {
          onHoverBurialChange?.(null);
          return;
        }
        onHoverBurialChange?.(
          target?.pointEntry?.record?.id ??
          target?.pointEntry?.id ??
          null
        );
        return;
      }

      if (target?.layerId === "section-overview" || target?.layerId === "section-clusters") {
        onHoverBurialChange?.(null);
        setHoveredSectionId(String(target.pointEntry?.record?.sectionValue || "") || null);
        return;
      }

      if (target?.layerId === "sections") {
        onHoverBurialChange?.(null);
        setHoveredSectionId(String(target.featureId || target.feature?.properties?.Section || "") || null);
        return;
      }

      setHoveredSectionId(null);
      onHoverBurialChange?.(null);
    };

    runtimeRef.current.on("hover", handleHover);
    return () => {
      runtimeRef.current?.off?.("hover", handleHover);
    };
  }, [onHoverBurialChange]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return undefined;
    }

    const clearHoveredSection = () => {
      setHoveredSectionId(null);
    };

    runtimeRef.current.on("movestart", clearHoveredSection);
    runtimeRef.current.on("zoomstart", clearHoveredSection);

    return () => {
      runtimeRef.current?.off?.("movestart", clearHoveredSection);
      runtimeRef.current?.off?.("zoomstart", clearHoveredSection);
    };
  }, []);

  return (
    <div className="map custom-map-surface" ref={containerRef}>
      {shouldUseMapPopups && popupRecord && popupPosition && (
        <div
          ref={popupShellRef}
          className="custom-map-runtime__popup-shell custom-popup"
          data-placement={popupLayout?.placement || "top"}
          style={{
            left: `${popupLayout?.left ?? popupPosition.x}px`,
            top: `${popupLayout?.top ?? popupPosition.y}px`,
            visibility: popupLayout ? "visible" : "hidden",
            "--popup-anchor-x": `${popupLayout?.anchorX ?? 0}px`,
          }}
        >
          <div className="custom-map-runtime__popup-anchor" />
          <div className="custom-map-runtime__popup-card">
            <PopupCardContent
              record={popupRecord}
              onOpenDirectionsMenu={(event) => onOpenDirectionsMenu?.(event, popupRecord)}
              onRemove={() => onRemoveSelectedBurial?.(popupRecord.id)}
              getPopup={getRuntimePopupHandle}
              schedulePopupLayout={schedulePopupLayout}
            />
          </div>
        </div>
      )}
    </div>
  );
}
