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
import sections from "../../data/ARC_Sections.json";
import { getGeoJsonBounds } from "../../shared/geoJsonBounds";
import { recordsToFeatureCollection } from "../locator/burialRecords";
import { CEMETERY_VIEW, createMapStyle, MAP_LAYER_IDS } from "./mapStyle";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };
const MAP_PREFERENCES_KEY = "fab.map-preferences.v1";
const DEFAULT_MAP_PREFERENCES = Object.freeze({
  basemap: "map",
  hillshade: true,
  showSections: false,
});
const SECTION_FEATURES = new globalThis.Map(
  sections.features.map((feature) => [String(feature.properties?.Section || "").trim(), feature])
);
// One canvas point can intersect several MapLibre layers. The first match owns the click.
const INTERACTIVE_LAYER_IDS = [
  MAP_LAYER_IDS.selectedRecord,
  MAP_LAYER_IDS.tourRecords,
  MAP_LAYER_IDS.records,
  MAP_LAYER_IDS.clusters,
  MAP_LAYER_IDS.sections,
];

const readMapPreferences = () => {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(MAP_PREFERENCES_KEY) || "null");
    return {
      basemap: stored?.basemap === "imagery" ? "imagery" : "map",
      hillshade: typeof stored?.hillshade === "boolean" ? stored.hillshade : true,
      showSections: typeof stored?.showSections === "boolean" ? stored.showSections : false,
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

export default function MapView({
  active = true,
  records = [],
  selectedRecord = null,
  selectedSection = "",
  focusKey = "",
  tourStopsPresent = false,
  sectionRecordCount = 0,
  sectionRecordsStatus = "idle",
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
  const { basemap, hillshade, showSections } = preferences;

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
      const record = recordsRef.current.find(({ id }) => String(id) === recordId);
      if (record) onRecordSelectRef.current?.(record);
    };
    map.on("click", async (event) => {
      const feature = findInteractiveFeature(event.point);
      if (!feature) return;

      if (feature.layer.id === MAP_LAYER_IDS.clusters) {
        const source = map.getSource("records");
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        map.easeTo({ center: feature.geometry.coordinates, zoom });
        return;
      }
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
    const burialRecords = records.filter(({ source }) => source !== "tour");
    const tourRecords = records.filter(({ source }) => source === "tour");
    map.getSource("records")?.setData(recordsToFeatureCollection(burialRecords));
    map.getSource("tour-records")?.setData(recordsToFeatureCollection(tourRecords));

    const updateVisibleMarkerCount = () => {
      const visible = map.queryRenderedFeatures({
        layers: [MAP_LAYER_IDS.records, MAP_LAYER_IDS.tourRecords, MAP_LAYER_IDS.clusters],
      });
      setVisibleMarkerCount(visible.length);
    };
    map.on("render", updateVisibleMarkerCount);
    return () => map.off("render", updateVisibleMarkerCount);
  }, [readyMap, records]);

  useEffect(() => {
    const map = readyMap;
    if (!map || mapRef.current !== map) return;
    const data = selectedRecord ? recordsToFeatureCollection([selectedRecord]) : EMPTY_COLLECTION;
    map.getSource("selected")?.setData(data);
  }, [readyMap, selectedRecord]);

  useEffect(() => {
    const map = readyMap;
    if (!map || mapRef.current !== map) return;
    setLayerVisibility(map, MAP_LAYER_IDS.map, basemap === "map");
    setLayerVisibility(map, MAP_LAYER_IDS.imagery, basemap === "imagery");
    setLayerVisibility(map, MAP_LAYER_IDS.hillshade, hillshade);
    const visible = showSections || Boolean(selectedSection);
    setLayerVisibility(map, MAP_LAYER_IDS.sections, visible);
    setLayerVisibility(map, MAP_LAYER_IDS.sectionOutlines, visible);
    setLayerVisibility(map, MAP_LAYER_IDS.selectedSection, visible && Boolean(selectedSection));
    map.setFilter(MAP_LAYER_IDS.selectedSection, [
      "==",
      ["to-string", ["get", "Section"]],
      String(selectedSection || ""),
    ]);
  }, [basemap, hillshade, readyMap, selectedSection, showSections]);

  useEffect(() => {
    const map = readyMap;
    if (!active || !map || mapRef.current !== map || !focusKey) return undefined;

    // Route changes and responsive panels can resize the map in the same render.
    // Fit only after layout settles so MapLibre never uses stale canvas dimensions.
    const frame = requestAnimationFrame(() => {
      if (mapRef.current !== map) return;
      map.stop();
      map.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
      map.resize();
      const width = map.getContainer().clientWidth;
      const height = map.getContainer().clientHeight;
      if (width === 0 || height === 0) return;

      const shortViewport = height < 500;
      const sidePanel = width >= 720 && height >= 500;
      const splitDetail = width >= 1080 && height >= 500;
      if (selectedRecord?.coordinates) {
        const tourRecord = selectedRecord.source === "tour";
        map.flyTo({
          center: selectedRecord.coordinates,
          zoom: Math.max(map.getZoom(), tourRecord ? 17.2 : 18),
          padding: splitDetail && tourRecord
            ? { top: 72, right: 360, bottom: 72, left: 460 }
            : {
              top: shortViewport ? 72 : 104,
              right: 32,
              bottom: shortViewport ? Math.min(132, height * 0.45) : Math.min(420, height * 0.48),
              left: 32,
            },
          retainPadding: false,
          essential: true,
        });
        return;
      }
      if (selectedSection) {
        const sectionFeature = SECTION_FEATURES.get(String(selectedSection));
        const sectionBounds = getGeoJsonBounds(sectionFeature);
        if (sectionBounds) {
          const [[south, west], [north, east]] = sectionBounds;
          map.fitBounds([[west, south], [east, north]], {
            padding: {
              top: shortViewport ? 116 : 126,
              right: sidePanel && tourStopsPresent ? 360 : 48,
              bottom: shortViewport ? 48 : tourStopsPresent ? 180 : 64,
              left: 48,
            },
            maxZoom: 17.4,
            duration: 650,
            retainPadding: false,
          });
          return;
        }
      }
      const points = records.filter(({ coordinates }) => Array.isArray(coordinates));
      if (points.length === 0) return;
      const bounds = points.reduce(
        (nextBounds, record) => nextBounds.extend(record.coordinates),
        new LngLatBounds(points[0].coordinates, points[0].coordinates)
      );
      const padding = tourStopsPresent
        ? sidePanel
          ? { top: 72, right: 360, bottom: 72, left: 72 }
          : {
            top: shortViewport ? 60 : 72,
            right: 32,
            bottom: shortViewport ? Math.min(132, height * 0.45) : 176,
            left: 32,
          }
        : 72;
      map.fitBounds(bounds, { padding, maxZoom: 17, duration: 700, retainPadding: false });
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
        {records.length.toLocaleString()} mapped {records.length === 1 ? "record" : "records"}
      </p>
      <div className="map-toolbar" aria-label="Map appearance">
        <div className="segmented-control" aria-label="Basemap">
          <button type="button" aria-pressed={basemap === "map"} onClick={() => updatePreference("basemap", "map")}>Map</button>
          <button type="button" aria-pressed={basemap === "imagery"} onClick={() => updatePreference("basemap", "imagery")}>Imagery</button>
        </div>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={hillshade}
            onChange={(event) => updatePreference("hillshade", event.target.checked)}
          />
          Hillshade
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
          {sectionRecordsStatus === "loading" ? <span role="status">Loading…</span> : null}
          {sectionRecordsStatus === "ready" ? (
            <span>{sectionRecordCount.toLocaleString()} burials</span>
          ) : null}
          {sectionRecordsStatus === "error" ? <span role="status">Unavailable</span> : null}
          <button type="button" onClick={() => onBrowseSection?.(selectedSection)}>List</button>
        </div>
      ) : null}
      <div ref={containerRef} className="map-canvas" role="region" aria-label="Albany Rural Cemetery map" />
    </div>
  );
}
