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
import { recordsToFeatureCollection } from "../locator/burialRecords";
import { CEMETERY_VIEW, createMapStyle, MAP_LAYER_IDS } from "./mapStyle";

const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

setWorkerUrl(mapLibreWorkerUrl);

const setLayerVisibility = (map, layerId, visible) => {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
};

export default function MapView({
  records = [],
  selectedRecord = null,
  selectedSection = "",
  focusKey = "",
  tourStopsPresent = false,
  onRecordSelect,
  onSectionSelect,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const recordsRef = useRef(records);
  const onRecordSelectRef = useRef(onRecordSelect);
  const onSectionSelectRef = useRef(onSectionSelect);
  const selectedRecordRef = useRef(selectedRecord);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState("map");
  const [hillshade, setHillshade] = useState(true);
  const [showSections, setShowSections] = useState(Boolean(selectedSection));
  const [visibleMarkerCount, setVisibleMarkerCount] = useState(null);

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

    map.on("load", () => setReady(true));

    const selectRecord = (event) => {
      const recordId = String(event.features?.[0]?.properties?.id || "");
      const record = recordsRef.current.find(({ id }) => String(id) === recordId);
      if (record) onRecordSelectRef.current?.(record);
    };
    map.on("click", MAP_LAYER_IDS.records, selectRecord);
    map.on("click", MAP_LAYER_IDS.tourRecords, selectRecord);
    map.on("click", MAP_LAYER_IDS.selectedRecord, () => {
      const selected = selectedRecordRef.current;
      const record = recordsRef.current.find(({ id }) => String(id) === String(selected?.id));
      onRecordSelectRef.current?.(record || selected);
    });
    map.on("click", MAP_LAYER_IDS.clusters, async (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const source = map.getSource("records");
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({ center: feature.geometry.coordinates, zoom });
    });
    map.on("click", MAP_LAYER_IDS.sections, (event) => {
      const section = String(event.features?.[0]?.properties?.Section || "").trim();
      if (section) onSectionSelectRef.current?.(section);
    });

    const interactiveLayers = [
      MAP_LAYER_IDS.records,
      MAP_LAYER_IDS.tourRecords,
      MAP_LAYER_IDS.clusters,
      MAP_LAYER_IDS.sections,
    ];
    interactiveLayers.forEach((layerId) => {
      map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
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
    map.once("idle", updateVisibleMarkerCount);
    return () => map.off("idle", updateVisibleMarkerCount);
  }, [ready, records]);

  useEffect(() => {
    if (!ready) return;
    const data = selectedRecord ? recordsToFeatureCollection([selectedRecord]) : EMPTY_COLLECTION;
    mapRef.current.getSource("selected")?.setData(data);
  }, [ready, selectedRecord]);

  useEffect(() => {
    if (!ready) return;
    setLayerVisibility(mapRef.current, MAP_LAYER_IDS.map, basemap === "map");
    setLayerVisibility(mapRef.current, MAP_LAYER_IDS.imagery, basemap === "imagery");
  }, [basemap, ready]);

  useEffect(() => {
    if (!ready) return;
    setLayerVisibility(mapRef.current, MAP_LAYER_IDS.hillshade, hillshade);
  }, [hillshade, ready]);

  useEffect(() => {
    if (!ready) return;
    const visible = showSections || Boolean(selectedSection);
    setLayerVisibility(mapRef.current, MAP_LAYER_IDS.sections, visible);
    setLayerVisibility(mapRef.current, MAP_LAYER_IDS.selectedSection, visible && Boolean(selectedSection));
    mapRef.current.setFilter(MAP_LAYER_IDS.selectedSection, [
      "==",
      ["to-string", ["get", "Section"]],
      String(selectedSection || ""),
    ]);
  }, [ready, selectedSection, showSections]);

  useEffect(() => {
    if (!ready || !focusKey) return;
    const map = mapRef.current;
    if (selectedRecord?.coordinates) {
      map.flyTo({ center: selectedRecord.coordinates, zoom: Math.max(map.getZoom(), 18), essential: true });
      return;
    }
    const points = records.filter(({ coordinates }) => Array.isArray(coordinates));
    if (points.length === 0) return;
    const bounds = points.reduce(
      (nextBounds, record) => nextBounds.extend(record.coordinates),
      new LngLatBounds(points[0].coordinates, points[0].coordinates)
    );
    const desktop = map.getContainer().clientWidth >= 720;
    const padding = tourStopsPresent
      ? desktop
        ? { top: 72, right: 360, bottom: 72, left: 72 }
        : { top: 72, right: 32, bottom: 176, left: 32 }
      : 72;
    map.fitBounds(bounds, { padding, maxZoom: 17, duration: 700 });
  }, [focusKey, ready, records, selectedRecord, tourStopsPresent]);

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
          <button type="button" aria-pressed={basemap === "map"} onClick={() => setBasemap("map")}>Map</button>
          <button type="button" aria-pressed={basemap === "imagery"} onClick={() => setBasemap("imagery")}>Imagery</button>
        </div>
        <label className="toggle-control">
          <input type="checkbox" checked={hillshade} onChange={(event) => setHillshade(event.target.checked)} />
          Hillshade
        </label>
        <label className="toggle-control">
          <input type="checkbox" checked={showSections} onChange={(event) => setShowSections(event.target.checked)} />
          Sections
        </label>
      </div>
      <div ref={containerRef} className="map-canvas" role="region" aria-label="Albany Rural Cemetery map" />
    </div>
  );
}
