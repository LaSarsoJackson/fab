import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  GeolocateControl,
  LngLatBounds,
  Map,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";
import { recordsToFeatureCollection } from "../locator/burialRecords";
import { MAP_LANDMARKS } from "../fab/mapLandmarks";
import { CEMETERY_VIEW, createMapStyle, MAP_LAYER_IDS } from "./mapStyle";
import { getSectionBounds } from "./mapSections";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };
const MAP_PREFERENCES_KEY = "fab.map-preferences.v1";
const DEFAULT_MAP_PREFERENCES = Object.freeze({
  hillshade: true,
  showSections: false,
});
// One canvas point can intersect several MapLibre layers. The first match owns the click.
const INTERACTIVE_LAYER_IDS = [
  MAP_LAYER_IDS.selectedRecord,
  MAP_LAYER_IDS.tourRecords,
  MAP_LAYER_IDS.records,
  MAP_LAYER_IDS.landmarkLabels,
  MAP_LAYER_IDS.sections,
];

const parseStoredBoolean = (value, fallback) => (
  value === true || value === false ? value : fallback
);

const readMapPreferences = () => {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(MAP_PREFERENCES_KEY) || "null");
    return {
      hillshade: parseStoredBoolean(stored?.hillshade, true),
      showSections: parseStoredBoolean(stored?.showSections, false),
    };
  } catch {
    return DEFAULT_MAP_PREFERENCES;
  }
};

setWorkerUrl(mapLibreWorkerUrl);

const setLayerVisibility = (map, layerId, visible) => {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
};

const getViewportLayout = (map) => {
  const width = map.getContainer().clientWidth;
  const height = map.getContainer().clientHeight;
  return {
    width,
    height,
    short: height < 500,
    sidePanel: width >= 720 && height >= 500,
    splitDetail: width >= 1080 && height >= 500,
  };
};

const focusSelectedRecord = (map, selectedRecord, viewport) => {
  if (!isCoordinatePairValid(selectedRecord?.coordinates)) return false;
  const tourRecord = selectedRecord.source === "tour";
  const detailPadding = {
    top: viewport.short ? 72 : 104,
    right: 32,
    bottom: viewport.short
      ? Math.min(132, viewport.height * 0.45)
      : Math.min(420, viewport.height * 0.48),
    left: 32,
  };
  map.flyTo({
    center: selectedRecord.coordinates,
    zoom: Math.max(map.getZoom(), tourRecord ? 17.2 : 18),
    padding: viewport.splitDetail && tourRecord
      ? { top: 72, right: 360, bottom: 72, left: 460 }
      : detailPadding,
    retainPadding: false,
    essential: true,
  });
  return true;
};

const focusSelectedSection = (map, selectedSection, tourStopsPresent, viewport) => {
  if (!selectedSection) return false;
  const sectionBounds = getSectionBounds(selectedSection);
  if (!sectionBounds) return false;
  const [[south, west], [north, east]] = sectionBounds;
  map.fitBounds([[west, south], [east, north]], {
    padding: {
      top: viewport.short ? 116 : 126,
      right: viewport.sidePanel && tourStopsPresent ? 360 : 48,
      bottom: viewport.short ? 48 : tourStopsPresent ? 180 : 64,
      left: 48,
    },
    maxZoom: 17.4,
    duration: 650,
    retainPadding: false,
  });
  return true;
};

const focusRecords = (map, records, tourStopsPresent, viewport) => {
  const points = records.filter(({ coordinates }) => isCoordinatePairValid(coordinates));
  if (points.length === 0) return;
  const bounds = points.reduce(
    (nextBounds, record) => nextBounds.extend(record.coordinates),
    new LngLatBounds(points[0].coordinates, points[0].coordinates)
  );
  let padding = 72;
  if (tourStopsPresent && viewport.sidePanel) {
    padding = { top: 72, right: 360, bottom: 72, left: 72 };
  } else if (tourStopsPresent) {
    padding = {
      top: viewport.short ? 60 : 72,
      right: 32,
      bottom: viewport.short ? Math.min(132, viewport.height * 0.45) : 176,
      left: 32,
    };
  }
  map.fitBounds(bounds, { padding, maxZoom: 17, duration: 700, retainPadding: false });
};

const focusMap = ({ map, records, selectedRecord, selectedSection, tourStopsPresent }) => {
  map.stop();
  map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
  map.resize();
  const viewport = getViewportLayout(map);
  if (viewport.width === 0 || viewport.height === 0) return;
  if (focusSelectedRecord(map, selectedRecord, viewport)) return;
  if (focusSelectedSection(map, selectedSection, tourStopsPresent, viewport)) return;
  focusRecords(map, records, tourStopsPresent, viewport);
};

export default function MapView({
  active = true,
  records = [],
  selectedRecord = null,
  selectedSection = "",
  focusKey = "",
  showRecordMarkers = true,
  tourStopsPresent = false,
  onBrowseSection,
  onRecordSelect,
  onSectionSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const recordsRef = useRef(records);
  const onRecordSelectRef = useRef(onRecordSelect);
  const onSectionSelectRef = useRef(onSectionSelect);
  const selectedRecordRef = useRef(selectedRecord);
  const [readyMap, setReadyMap] = useState(null);
  const [preferences, setPreferences] = useState(readMapPreferences);
  const [visibleMarkerCount, setVisibleMarkerCount] = useState(null);
  const { hillshade, showSections } = preferences;

  const updatePreference = (key, value) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      try {
        globalThis.localStorage?.setItem(MAP_PREFERENCES_KEY, JSON.stringify(next));
      } catch {
        // Preference persistence is optional in restricted browser contexts.
      }
      return next;
    });
  };

  useEffect(() => {
    recordsRef.current = records;
    onRecordSelectRef.current = onRecordSelect;
    onSectionSelectRef.current = onSectionSelect;
    selectedRecordRef.current = selectedRecord;
  }, [onRecordSelect, onSectionSelect, records, selectedRecord]);

  useEffect(() => {
    const [west, south, east, north] = CEMETERY_VIEW.bounds;
    const map = new Map({
      container: containerRef.current,
      style: createMapStyle(),
      center: CEMETERY_VIEW.center,
      zoom: CEMETERY_VIEW.zoom,
      minZoom: 13,
      maxZoom: 20,
      maxBounds: [[west - 0.012, south - 0.012], [east + 0.012, north + 0.012]],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const addGeolocateControl = async () => {
      if (!globalThis.navigator?.geolocation) return;
      try {
        const permission = await globalThis.navigator.permissions?.query({ name: "geolocation" });
        if (permission?.state === "denied") return;
      } catch {
        // iOS can reject the Permissions API query while geolocation still works.
      }
      if (mapRef.current !== map) return;
      map.addControl(new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
        fitBoundsOptions: { maxZoom: 18 },
      }), "top-right");
    };
    void addGeolocateControl();
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    const attribution = containerRef.current?.querySelector(".maplibregl-ctrl-attrib");
    const attributionButton = attribution?.querySelector(".maplibregl-ctrl-attrib-button");
    attributionButton?.setAttribute("aria-label", "Map credits");
    attributionButton?.setAttribute("title", "Map credits");
    map.once("idle", () => {
      attribution?.removeAttribute("open");
      attribution?.classList.remove("maplibregl-compact-show");
    });

    map.on("style.load", () => {
      if (mapRef.current === map) setReadyMap(map);
    });

    const findInteractiveFeature = (point) => {
      const features = map.queryRenderedFeatures(point, { layers: INTERACTIVE_LAYER_IDS });
      for (const layerId of INTERACTIVE_LAYER_IDS) {
        const feature = features.find(({ layer }) => layer?.id === layerId);
        if (feature) return feature;
      }
      return null;
    };
    const selectRecord = (feature) => {
      const recordId = String(feature.properties?.id || "");
      const candidates = feature.layer.id === MAP_LAYER_IDS.landmarkLabels ? MAP_LANDMARKS : recordsRef.current;
      const record = candidates.find(({ id }) => String(id) === recordId);
      if (record) onRecordSelectRef.current?.(record);
    };
    map.on("click", (event) => {
      const feature = findInteractiveFeature(event.point);
      if (!feature) return;

      if (feature.layer.id === MAP_LAYER_IDS.sections) {
        const section = String(feature.properties?.Section || "").trim();
        if (section) onSectionSelectRef.current?.(section);
        return;
      }
      if (feature.layer.id === MAP_LAYER_IDS.selectedRecord) {
        const selected = selectedRecordRef.current;
        const record = recordsRef.current.find(({ id }) => String(id) === String(selected?.id));
        onRecordSelectRef.current?.(record || selected);
        return;
      }
      selectRecord(feature);
    });

    INTERACTIVE_LAYER_IDS.forEach((layerId) => {
      map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
    });

    return () => {
      if (mapRef.current === map) mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = readyMap;
    if (!active || !map || mapRef.current !== map) return undefined;
    const frame = requestAnimationFrame(() => map.resize());
    return () => cancelAnimationFrame(frame);
  }, [active, readyMap]);

  useEffect(() => {
    const map = readyMap;
    if (!map || mapRef.current !== map) return;
    const visibleRecords = showRecordMarkers
      ? records.filter(({ id }) => String(id) !== String(selectedRecord?.id))
      : [];
    const burialRecords = visibleRecords.filter(({ source }) => source !== "tour");
    const tourRecords = visibleRecords.filter(({ source }) => source === "tour");
    map.getSource("records")?.setData(recordsToFeatureCollection(burialRecords));
    map.getSource("tour-records")?.setData(recordsToFeatureCollection(tourRecords));

    const updateVisibleMarkerCount = () => {
      const visible = map.queryRenderedFeatures({
        layers: [MAP_LAYER_IDS.records, MAP_LAYER_IDS.tourRecords, MAP_LAYER_IDS.selectedRecord],
      });
      setVisibleMarkerCount(visible.length);
    };
    map.on("render", updateVisibleMarkerCount);
    return () => map.off("render", updateVisibleMarkerCount);
  }, [readyMap, records, selectedRecord, showRecordMarkers]);

  useEffect(() => {
    const map = readyMap;
    if (!map || mapRef.current !== map) return;
    const data = selectedRecord ? recordsToFeatureCollection([selectedRecord]) : EMPTY_COLLECTION;
    map.getSource("selected")?.setData(data);
    map.setFilter(MAP_LAYER_IDS.landmarkLabels, ["!=", ["get", "id"], String(selectedRecord?.id || "")]);
  }, [readyMap, selectedRecord]);

  useEffect(() => {
    const map = readyMap;
    if (!map || mapRef.current !== map) return;
    setLayerVisibility(map, MAP_LAYER_IDS.hillshade, hillshade);
    const matchesSection = [
      "==",
      ["to-string", ["get", "Section"]],
      String(selectedSection || ""),
    ];
    map.setPaintProperty(MAP_LAYER_IDS.sections, "fill-opacity", [
      "case", matchesSection, 0.28, showSections ? 0.18 : 0,
    ]);
    setLayerVisibility(map, MAP_LAYER_IDS.sectionOutlines, showSections);
    setLayerVisibility(map, MAP_LAYER_IDS.selectedSection, Boolean(selectedSection));
    map.setFilter(MAP_LAYER_IDS.selectedSection, matchesSection);
    setLayerVisibility(map, MAP_LAYER_IDS.sectionLabels, showSections || Boolean(selectedSection));
    map.setFilter(MAP_LAYER_IDS.sectionLabels, showSections ? null : matchesSection);
  }, [hillshade, readyMap, selectedSection, showSections]);

  useEffect(() => {
    const map = readyMap;
    if (!active || !map || mapRef.current !== map || !focusKey) return undefined;

    // Route changes and responsive panels can resize the map in the same render.
    // Fit only after layout settles so MapLibre never uses stale canvas dimensions.
    const frame = requestAnimationFrame(() => {
      if (mapRef.current !== map) return;
      focusMap({ map, records, selectedRecord, selectedSection, tourStopsPresent });
    });

    return () => cancelAnimationFrame(frame);
  }, [active, focusKey, readyMap, records, selectedRecord, selectedSection, tourStopsPresent]);

  return (
    <div className="map-view">
      <p
        className="visually-hidden"
        aria-live="polite"
        data-visible-marker-count={visibleMarkerCount ?? ""}
      >
        {(visibleMarkerCount ?? 0).toLocaleString()} {tourStopsPresent && showRecordMarkers ? "tour stops" : "graves"} shown on the map
      </p>
      <div className="map-toolbar" aria-label="Map options">
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={hillshade}
            onChange={(event) => updatePreference("hillshade", event.target.checked)}
          />
          Terrain
        </label>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={showSections}
            onChange={(event) => updatePreference("showSections", event.target.checked)}
          />
          Sections
        </label>
      </div>
      {selectedSection ? (
        <div className="map-section-context" role="group" aria-label={`Section ${selectedSection}`}>
          <strong>Section {selectedSection}</strong>
          <button type="button" onClick={() => onBrowseSection?.(selectedSection)}>
            View burials
          </button>
        </div>
      ) : null}
      <div ref={containerRef} className="map-canvas" role="region" aria-label="Albany Rural Cemetery map" />
    </div>
  );
}
