import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getGeoJsonBounds, isLatLngBoundsExpressionValid } from "../../../shared/geo";
import { PopupCardContent } from "../popupCardContent";
import { createCustomMapRuntime } from "./customRuntime";

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
  lat,
  lng,
  mapRef,
  markerColors,
  maxBounds,
  maxZoom = 25,
  minZoom = 13,
  onActivateSectionBrowse,
  onHoverBurialChange,
  onOpenDirectionsMenu,
  onRemoveSelectedBurial,
  onSelectBurial,
  onZoomChange,
  roadsData,
  schedulePopupLayout,
  sectionBurials,
  sectionFilter,
  sectionsData,
  selectedBurials,
  selectedMarkerLayersRef,
  selectedTourResults,
  showBoundary = true,
  shouldUseMapPopups,
  showAllBurials,
  showRoads = true,
  showSections = true,
  tourFeatureLayersRef,
  tourStyles,
}) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const [popupState, setPopupState] = useState(null);
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

    if (showRoads) {
      nextLayers.push({
        id: "roads",
        kind: "geojson",
        geojson: roadsData,
        style: {
          color: "#000000",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.1,
        },
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
        style: (feature) => {
          const isActive = `${feature?.properties?.Section || ""}` === `${sectionFilter}`;
          return {
            fillColor: isActive ? "#4a90e2" : "#f8f9fa",
            fillOpacity: isActive ? 0.4 : 0.05,
            color: isActive ? "#2c5282" : "#999",
            weight: isActive ? 2 : 1,
          };
        },
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

    if (showAllBurials && sectionFilter) {
      nextLayers.push({
        id: "section-burials",
        kind: "points",
        interactive: true,
        clustered: true,
        clusterRadius: 40,
        points: sectionBurials
          .filter((record) => Array.isArray(record?.coordinates))
          .map((record) => ({
            id: record.id,
            coordinates: record.coordinates,
            record,
          })),
        pointStyle: (entry) => ({
          radius: entry?.record?.id === activeBurialId ? 7 : 5,
          fillColor: entry?.record?.id === activeBurialId ? "#2c5282" : "#4a90e2",
          fillOpacity: 0.82,
          color: "#ffffff",
          weight: 2,
        }),
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
            runtime.fitBounds(clusterBounds, { maxZoom: 21 });
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
        pointStyle: (entry) => {
          const color = tourStyles?.[entry?.record?.tourKey]?.color ||
            tourStyles?.[entry?.record?.title]?.color ||
            "#c96e1f";

          return {
            radius: entry?.record?.id === activeBurialId ? 7 : 6,
            fillColor: color,
            fillOpacity: 0.88,
            color: "#ffffff",
            weight: 2,
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
        pointStyle: (entry) => {
          const color = selectedMarkerColorById.get(entry.id) || "#e41a1c";
          const isHighlighted =
            runtimeRef.current?.selectionState?.hoveredId === entry.id ||
            activeBurialId === entry.id;
          return {
            variant: "numbered",
            label: entry.index + 1,
            fillColor: color,
            color: "#ffffff",
            radius: isHighlighted ? 16 : 12,
            outlineWidth: isHighlighted ? 3 : 2,
            hitRadius: isHighlighted ? 18 : 14,
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

    if (lat && lng) {
      nextLayers.push({
        id: "user-location",
        kind: "points",
        points: [
          {
            id: "user-location",
            coordinates: [lng, lat],
          },
        ],
        pointStyle: {
          radius: 7,
          fillColor: "#185e4a",
          fillOpacity: 0.92,
          color: "#ffffff",
          weight: 2,
        },
      });
    }

    return nextLayers;
  }, [
    activeBurialId,
    boundaryData,
    lat,
    lng,
    onActivateSectionBrowse,
    onSelectBurial,
    roadsData,
    sectionBurials,
    sectionFilter,
    sectionsData,
    selectedBurials,
    selectedMarkerColorById,
    selectedTourResults,
    showBoundary,
    showAllBurials,
    showRoads,
    showSections,
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
    if (!shouldUseMapPopups && popupState) {
      runtimeRef.current?.closePopup?.();
    }
  }, [popupState, shouldUseMapPopups]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return undefined;
    }

    const handleHover = ({ target }) => {
      if (target?.layerId === "selected-burials") {
        onHoverBurialChange?.(target.pointEntry?.id ?? null);
        return;
      }

      onHoverBurialChange?.(null);
    };

    runtimeRef.current.on("hover", handleHover);
    return () => {
      runtimeRef.current?.off?.("hover", handleHover);
    };
  }, [onHoverBurialChange]);

  return (
    <div className="map custom-map-surface" ref={containerRef}>
      {shouldUseMapPopups && popupRecord && popupPosition && (
        <div
          className="custom-map-runtime__popup-shell custom-popup"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
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
