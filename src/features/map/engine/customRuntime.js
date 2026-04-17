import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";

import {
  getCameraBounds,
  getFitBoundsCamera,
  normalizeBounds,
  normalizeLatLng,
  panLatLngIntoView,
  createBoundsHandle,
} from "./camera";
import {
  createBasemapSpec,
  createCameraState,
  createLayerSpec,
  MAP_RUNTIME_API_VERSION,
  createPopupSpec,
  createSelectionState,
  MAP_RUNTIME_EVENTS,
} from "./contracts";
import { clusterScreenPoints } from "./clustering";
import {
  TILE_SIZE,
  createCameraContext,
  latLngToContainerPoint,
  projectLngLat,
  unprojectPoint,
} from "./projection";

const DRAG_THRESHOLD = 4;
const DEFAULT_CLUSTER_RADIUS = 44;

const toDomStyle = (value) => `${Math.round(value * 1000) / 1000}px`;

const haversineDistance = (left, right) => {
  const earthRadiusMeters = 6371000;
  const leftLat = (left.lat * Math.PI) / 180;
  const rightLat = (right.lat * Math.PI) / 180;
  const deltaLat = ((right.lat - left.lat) * Math.PI) / 180;
  const deltaLng = ((right.lng - left.lng) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a = (
    sinLat * sinLat +
    Math.cos(leftLat) * Math.cos(rightLat) * sinLng * sinLng
  );
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const normalizeColor = (color, fallback) => {
  const nextColor = String(color || "").trim();
  return nextColor || fallback;
};

const withAlpha = (hexColor, alpha, fallback) => {
  const nextColor = normalizeColor(hexColor, fallback);
  if (nextColor.startsWith("rgba(") || nextColor.startsWith("rgb(")) {
    return nextColor;
  }

  const sanitized = nextColor.replace("#", "");
  if (sanitized.length !== 6) {
    return fallback;
  }

  const red = parseInt(sanitized.slice(0, 2), 16);
  const green = parseInt(sanitized.slice(2, 4), 16);
  const blue = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const geometryToRings = (geometry = {}) => {
  switch (geometry.type) {
    case "Polygon":
      return geometry.coordinates || [];
    case "MultiPolygon":
      return (geometry.coordinates || []).flat();
    default:
      return [];
  }
};

const drawPath = (context, coordinates, cameraContext) => {
  coordinates.forEach((ring) => {
    ring.forEach((coordinate, index) => {
      const point = latLngToContainerPoint(
        { lng: coordinate[0], lat: coordinate[1] },
        cameraContext
      );
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
  });
};

const drawGeoJsonLine = (context, geometry, style, cameraContext) => {
  const lineGroups = geometry.type === "MultiLineString"
    ? geometry.coordinates || []
    : [geometry.coordinates || []];

  context.save();
  context.strokeStyle = normalizeColor(style.color, "#334");
  context.lineWidth = Number.isFinite(style.weight) ? style.weight : 1;
  context.globalAlpha = Number.isFinite(style.opacity) ? style.opacity : 1;
  context.beginPath();

  lineGroups.forEach((line) => {
    line.forEach((coordinate, index) => {
      const point = latLngToContainerPoint(
        { lng: coordinate[0], lat: coordinate[1] },
        cameraContext
      );
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
  });

  context.stroke();
  context.restore();
};

const drawGeoJsonPolygon = (context, geometry, style, cameraContext) => {
  const rings = geometryToRings(geometry);
  if (!rings.length) return;

  context.save();
  context.beginPath();
  drawPath(context, rings, cameraContext);
  context.closePath();
  context.fillStyle = withAlpha(
    style.fillColor,
    Number.isFinite(style.fillOpacity) ? style.fillOpacity : 0.2,
    "rgba(255,255,255,0.1)"
  );
  context.strokeStyle = normalizeColor(style.color, "#999");
  context.lineWidth = Number.isFinite(style.weight) ? style.weight : 1;
  context.fill();
  context.stroke();
  context.restore();
};

const drawCirclePoint = (context, point, style = {}) => {
  const radius = Number.isFinite(style.radius) ? style.radius : 6;
  context.save();
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = normalizeColor(style.fillColor, "#4a90e2");
  context.globalAlpha = Number.isFinite(style.fillOpacity) ? style.fillOpacity : 0.85;
  context.fill();
  context.lineWidth = Number.isFinite(style.weight) ? style.weight : 2;
  context.strokeStyle = normalizeColor(style.color, "#fff");
  context.globalAlpha = Number.isFinite(style.opacity) ? style.opacity : 1;
  context.stroke();
  context.restore();
};

const drawClusterPoint = (context, point, count) => {
  context.save();
  context.beginPath();
  context.arc(point.x, point.y, 17, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 248, 239, 0.96)";
  context.strokeStyle = "rgba(123, 78, 36, 0.28)";
  context.lineWidth = 1.5;
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(point.x, point.y, 12, 0, Math.PI * 2);
  context.fillStyle = "rgba(217, 123, 43, 0.86)";
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 12px Manrope, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(count > 99 ? "99+" : String(count), point.x, point.y + 0.5);
  context.restore();
};

const drawNumberedPoint = (context, point, style = {}) => {
  const radius = Number.isFinite(style.radius) ? style.radius : 12;
  const outline = Number.isFinite(style.outlineWidth) ? style.outlineWidth : 2;

  context.save();
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = normalizeColor(style.fillColor, "#e41a1c");
  context.fill();
  context.lineWidth = outline;
  context.strokeStyle = normalizeColor(style.color, "#ffffff");
  context.stroke();

  context.fillStyle = "#ffffff";
  context.font = `700 ${radius}px Manrope, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(style.label || ""), point.x, point.y + 0.5);
  context.restore();
};

const roundLayoutValue = (value) => Math.round(value * 1000) / 1000;

const setTileImageLayout = (tileImage, left, top, tileSize) => {
  tileImage.style.left = toDomStyle(left);
  tileImage.style.top = toDomStyle(top);
  tileImage.style.width = toDomStyle(tileSize);
  tileImage.style.height = toDomStyle(tileSize);
};

const areInteractiveTargetsEqual = (left, right) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.kind === right.kind &&
    left.layerId === right.layerId &&
    left.featureId === right.featureId
  );
};

const areSelectionStatesEqual = (left, right) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  if (left.activeId !== right.activeId || left.hoveredId !== right.hoveredId) {
    return false;
  }

  if (left.ids.length !== right.ids.length) {
    return false;
  }

  return left.ids.every((value, index) => value === right.ids[index]);
};

const getFeatureStyle = (layer, feature, runtime) => {
  if (typeof layer.style === "function") {
    return layer.style(feature, runtime) || {};
  }

  return layer.style || {};
};

const buildInteractivePolygonTarget = (layer, feature, featureId, runtime) => ({
  kind: "polygon",
  layerId: layer.id,
  featureId,
  feature,
  contains: (latLng) => {
    try {
      return booleanPointInPolygon(
        turfPoint([latLng.lng, latLng.lat]),
        feature
      );
    } catch (_error) {
      return false;
    }
  },
  onClick: layer.onFeatureClick,
  onHover: layer.onFeatureHover,
  priority: 0,
  runtime,
});

const buildInteractivePointTarget = (layer, pointEntry, screenPoint, options = {}) => ({
  kind: options.kind || "point",
  layerId: layer.id,
  featureId: pointEntry.id,
  point: screenPoint,
  radius: Number.isFinite(options.radius) ? options.radius : 14,
  pointEntry,
  onClick: options.onClick || layer.onPointClick,
  priority: options.priority ?? 2,
});

const createPopupHandle = (runtime) => ({
  __customRuntimePopup: true,
  options: {},
  update: () => {
    runtime.emit("popupupdate", { popup: runtime.popupHandle });
  },
  close: () => {
    runtime.closePopup();
  },
});

export class CustomMapRuntime {
  constructor(options = {}) {
    this.__fabMapRuntime = true;
    this.__runtimeKind = "custom";
    this.__runtimeApiVersion = MAP_RUNTIME_API_VERSION;
    this.cameraState = createCameraState({
      center: options.center || [0, 0],
      zoom: Number.isFinite(options.zoom) ? options.zoom : 14,
    });
    this.minZoom = Number.isFinite(options.minZoom) ? options.minZoom : 0;
    this.maxZoom = Number.isFinite(options.maxZoom) ? options.maxZoom : 22;
    this.maxBounds = normalizeBounds(options.maxBounds);
    this.tileSize = Number.isFinite(options.tileSize) ? options.tileSize : TILE_SIZE;
    this.basemapSpec = createBasemapSpec(options.basemapSpec || {});
    this.layerSpecs = [];
    this.selectionState = createSelectionState();
    this.listeners = new Map(MAP_RUNTIME_EVENTS.map((eventName) => [eventName, new Set()]));
    this.width = 0;
    this.height = 0;
    this.hitTargets = [];
    this.sortedHitTargets = [];
    this.pointerState = null;
    this.dragDistance = 0;
    this.hoverTarget = null;
    this.popupState = null;
    this.popupHandle = createPopupHandle(this);
    this.container = null;
    this.surface = null;
    this.tilePane = null;
    this.canvas = null;
    this.tileImages = new Map();
    this.tileLayoutSignature = null;
    this.resizeObserver = null;
  }

  mount(container) {
    if (!container) return this;

    this.container = container;
    this.container.innerHTML = "";
    this.surface = document.createElement("div");
    this.surface.className = "custom-map-runtime";
    this.tilePane = document.createElement("div");
    this.tilePane.className = "custom-map-runtime__tiles";
    this.canvas = document.createElement("canvas");
    this.canvas.className = "custom-map-runtime__canvas";
    this.surface.append(this.tilePane, this.canvas);
    this.container.append(this.surface);
    this.attachEvents();
    this.observeSize();
    this.measure();
    this.render();
    queueMicrotask(() => {
      this.emit("moveend", { target: this });
      this.emit("zoomend", { target: this });
    });

    return this;
  }

  destroy() {
    this.detachEvents();
    this.resizeObserver?.disconnect?.();
    this.resizeObserver = null;
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.container = null;
    this.surface = null;
    this.tilePane = null;
    this.canvas = null;
    this.hitTargets = [];
    this.sortedHitTargets = [];
    this.popupState = null;
    this.hoverTarget = null;
    this.tileImages.clear();
    this.tileLayoutSignature = null;
  }

  observeSize() {
    if (typeof ResizeObserver !== "function" || !this.container) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
      this.render();
      this.emit("popupupdate", { popup: this.popupHandle });
    });
    this.resizeObserver.observe(this.container);
  }

  measure() {
    if (!this.container || !this.canvas) return;
    this.width = Math.max(1, Math.round(this.container.clientWidth || 1));
    this.height = Math.max(1, Math.round(this.container.clientHeight || 1));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  attachEvents() {
    if (!this.surface) return;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);

    this.surface.addEventListener("pointerdown", this.handlePointerDown);
    this.surface.addEventListener("pointermove", this.handlePointerMove);
    this.surface.addEventListener("pointerup", this.handlePointerUp);
    this.surface.addEventListener("pointercancel", this.handlePointerUp);
    this.surface.addEventListener("pointerleave", this.handlePointerLeave);
    this.surface.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  detachEvents() {
    if (!this.surface) return;

    this.surface.removeEventListener("pointerdown", this.handlePointerDown);
    this.surface.removeEventListener("pointermove", this.handlePointerMove);
    this.surface.removeEventListener("pointerup", this.handlePointerUp);
    this.surface.removeEventListener("pointercancel", this.handlePointerUp);
    this.surface.removeEventListener("pointerleave", this.handlePointerLeave);
    this.surface.removeEventListener("wheel", this.handleWheel);
  }

  on(eventName, handler) {
    const listeners = this.listeners.get(eventName);
    if (!listeners || typeof handler !== "function") return this;
    listeners.add(handler);
    return this;
  }

  off(eventName, handler) {
    const listeners = this.listeners.get(eventName);
    listeners?.delete?.(handler);
    return this;
  }

  once(eventName, handler) {
    if (typeof handler !== "function") return this;

    const wrappedHandler = (event) => {
      this.off(eventName, wrappedHandler);
      handler(event);
    };

    return this.on(eventName, wrappedHandler);
  }

  emit(eventName, event = {}) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;
    listeners.forEach((handler) => {
      handler({
        target: this,
        ...event,
      });
    });
  }

  whenReady(callback) {
    if (typeof callback === "function") {
      queueMicrotask(() => callback(this));
    }
    return this;
  }

  getContainer() {
    return this.container;
  }

  getZoom() {
    return this.cameraState.zoom;
  }

  getCenter() {
    return normalizeLatLng(this.cameraState.center);
  }

  getCameraContext() {
    return createCameraContext({
      width: this.width,
      height: this.height,
      center: this.getCenter(),
      zoom: this.getZoom(),
      tileSize: this.tileSize,
    });
  }

  setCamera(cameraState) {
    const nextCamera = createCameraState(cameraState);
    this.cameraState = {
      center: normalizeLatLng(nextCamera.center),
      zoom: Math.max(this.minZoom, Math.min(this.maxZoom, nextCamera.zoom)),
    };
    this.render();
    this.emit("moveend", { target: this });
    this.emit("zoomend", { target: this });
    this.emit("popupupdate", { popup: this.popupHandle });
    return this;
  }

  setView(center, zoom, options = {}) {
    if (options.animate) {
      this.emit("movestart", { target: this });
      this.emit("zoomstart", { target: this });
    }

    return this.setCamera({ center, zoom });
  }

  flyTo(center, zoom, options = {}) {
    return this.setView(center, zoom, options);
  }

  stop() {
    return this;
  }

  zoomIn() {
    return this.setView(this.getCenter(), Math.min(this.maxZoom, this.getZoom() + 1));
  }

  zoomOut() {
    return this.setView(this.getCenter(), Math.max(this.minZoom, this.getZoom() - 1));
  }

  getBounds() {
    return createBoundsHandle(
      getCameraBounds(this.cameraState, {
        width: this.width,
        height: this.height,
        tileSize: this.tileSize,
      })
    );
  }

  fitBounds(bounds, options = {}) {
    const nextCamera = getFitBoundsCamera(bounds, {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      minZoom: this.minZoom,
      maxZoom: Number.isFinite(options.maxZoom) ? options.maxZoom : this.maxZoom,
      paddingTopLeft: options.paddingTopLeft,
      paddingBottomRight: options.paddingBottomRight,
    });

    if (!nextCamera) return this;
    return this.setView(nextCamera.center, nextCamera.zoom, options);
  }

  panInside(latLng, options = {}) {
    const nextCamera = panLatLngIntoView(this.cameraState, latLng, {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      paddingTopLeft: options.paddingTopLeft,
      paddingBottomRight: options.paddingBottomRight,
    });

    return this.setView(nextCamera.center, nextCamera.zoom, options);
  }

  distance(left, right) {
    return haversineDistance(normalizeLatLng(left), normalizeLatLng(right));
  }

  setBasemap(basemapSpec) {
    this.basemapSpec = createBasemapSpec(basemapSpec);
    this.render();
    return this.basemapSpec;
  }

  setLayers(layerSpecs) {
    this.layerSpecs = Array.isArray(layerSpecs) ? layerSpecs.map(createLayerSpec) : [];
    this.render();
    return this.layerSpecs;
  }

  setSelection(selectionState) {
    const nextSelectionState = createSelectionState(selectionState);
    if (areSelectionStatesEqual(this.selectionState, nextSelectionState)) {
      return this.selectionState;
    }

    this.selectionState = nextSelectionState;
    this.render();
    return this.selectionState;
  }

  openPopup(popupSpec) {
    this.popupState = createPopupSpec(popupSpec);
    this.emit("popupopen", {
      popup: this.popupHandle,
      popupState: this.popupState,
    });
    return this.popupHandle;
  }

  closePopup() {
    if (!this.popupState) return this;
    this.popupState = null;
    this.emit("popupclose", { popup: this.popupHandle });
    return this;
  }

  getPopupState() {
    return this.popupState;
  }

  getPopupScreenPoint() {
    if (!this.popupState?.coordinates) return null;

    return latLngToContainerPoint(
      {
        lng: this.popupState.coordinates[0],
        lat: this.popupState.coordinates[1],
      },
      this.getCameraContext()
    );
  }

  projectCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return null;
    }

    return latLngToContainerPoint(
      {
        lng: coordinates[0],
        lat: coordinates[1],
      },
      this.getCameraContext()
    );
  }

  handlePointerDown(event) {
    if (!this.surface) return;

    this.pointerState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      center: this.getCenter(),
      moved: false,
    };
    this.dragDistance = 0;
    this.surface.setPointerCapture?.(event.pointerId);
    this.emit("movestart", { target: this, originalEvent: event });
  }

  handlePointerMove(event) {
    if (!this.surface) return;

    if (this.pointerState?.pointerId === event.pointerId) {
      const deltaX = event.clientX - this.pointerState.startX;
      const deltaY = event.clientY - this.pointerState.startY;
      this.dragDistance = Math.max(this.dragDistance, Math.hypot(deltaX, deltaY));

      if (this.dragDistance <= DRAG_THRESHOLD) {
        return;
      }

      this.pointerState.moved = true;
      const centerPoint = projectLngLat(
        [this.pointerState.center.lng, this.pointerState.center.lat],
        this.getZoom(),
        this.tileSize
      );
      const nextCenter = {
        x: centerPoint.x - deltaX,
        y: centerPoint.y - deltaY,
      };

      this.cameraState = {
        center: normalizeLatLng({
          ...this.cameraState.center,
          ...this.unprojectPoint(nextCenter),
        }),
        zoom: this.getZoom(),
      };
      this.render();
      this.emit("popupupdate", { popup: this.popupHandle });
      return;
    }

    const target = this.pickTarget(event.offsetX, event.offsetY);
    if (areInteractiveTargetsEqual(this.hoverTarget, target)) {
      return;
    }

    this.hoverTarget = target;
    this.emit("hover", {
      target,
      latlng: this.containerPointToLatLng(event.offsetX, event.offsetY),
      originalEvent: event,
    });
  }

  handlePointerUp(event) {
    if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) {
      return;
    }

    const wasDrag = this.pointerState.moved;
    this.pointerState = null;
    this.emit("moveend", { target: this, originalEvent: event });

    if (wasDrag) {
      return;
    }

    const latlng = this.containerPointToLatLng(event.offsetX, event.offsetY);
    const target = this.pickTarget(event.offsetX, event.offsetY, latlng);

    if (target?.onClick) {
      target.onClick({
        target,
        latlng,
        runtime: this,
        originalEvent: event,
      });
    } else if (!target) {
      this.closePopup();
    }

    this.emit("click", {
      target,
      latlng,
      originalEvent: event,
    });
  }

  handlePointerLeave() {
    if (!this.hoverTarget) {
      return;
    }

    this.hoverTarget = null;
    this.emit("hover", { target: null, originalEvent: null });
  }

  handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.getZoom() + delta));
    if (nextZoom === this.getZoom()) {
      return;
    }

    this.emit("zoomstart", { target: this, originalEvent: event });
    this.setView(this.getCenter(), nextZoom, { animate: false });
  }

  containerPointToLatLng(x, y) {
    const center = this.getCenter();
    const zoom = this.getZoom();
    const centerWorldPoint = projectLngLat([center.lng, center.lat], zoom, this.tileSize);
    const worldPoint = {
      x: centerWorldPoint.x + (x - (this.width / 2)),
      y: centerWorldPoint.y + (y - (this.height / 2)),
    };

    return this.unprojectPoint(worldPoint);
  }

  unprojectPoint(worldPoint) {
    return unprojectPoint(worldPoint, this.getZoom(), this.tileSize);
  }

  render() {
    if (!this.canvas || !this.tilePane) return;

    this.measure();
    this.renderTiles();
    const context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.width, this.height);
    this.hitTargets = [];
    this.sortedHitTargets = [];

    this.layerSpecs.forEach((layer) => {
      if (layer.kind === "geojson") {
        this.drawGeoJsonLayer(context, layer);
        return;
      }

      if (layer.kind === "points") {
        this.drawPointLayer(context, layer);
      }
    });

    this.sortedHitTargets = [...this.hitTargets].sort((left, right) => right.priority - left.priority);
  }

  renderTiles() {
    if (!this.tilePane) return;

    const basemapTemplate = this.basemapSpec.type === "pmtiles-vector"
      ? this.basemapSpec.rasterFallbackUrlTemplate
      : this.basemapSpec.urlTemplate;

    if (!basemapTemplate) {
      this.tilePane.innerHTML = "";
      this.tileImages.clear();
      this.tileLayoutSignature = null;
      return;
    }

    const zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(this.getZoom())));
    const tileSize = this.basemapSpec.tileSize || this.tileSize;
    const centerPoint = projectLngLat([this.getCenter().lng, this.getCenter().lat], zoom, tileSize);
    const minX = centerPoint.x - (this.width / 2);
    const minY = centerPoint.y - (this.height / 2);
    const maxX = centerPoint.x + (this.width / 2);
    const maxY = centerPoint.y + (this.height / 2);
    const maxTileIndex = Math.pow(2, zoom) - 1;
    const startX = Math.floor(minX / tileSize);
    const endX = Math.floor(maxX / tileSize);
    const startY = Math.max(0, Math.floor(minY / tileSize));
    const endY = Math.min(maxTileIndex, Math.floor(maxY / tileSize));
    const nextTileLayoutSignature = [
      basemapTemplate,
      tileSize,
      zoom,
      this.width,
      this.height,
      roundLayoutValue(minX),
      roundLayoutValue(minY),
      startX,
      endX,
      startY,
      endY,
    ].join("|");

    if (this.tileLayoutSignature === nextTileLayoutSignature) {
      return;
    }

    this.tileLayoutSignature = nextTileLayoutSignature;
    const nextTileKeys = new Set();

    for (let tileY = startY; tileY <= endY; tileY += 1) {
      for (let tileX = startX; tileX <= endX; tileX += 1) {
        const wrappedTileX = ((tileX % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
        const tileKey = `${basemapTemplate}|${tileSize}|${zoom}|${wrappedTileX}|${tileY}`;
        let tileImage = this.tileImages.get(tileKey);

        if (!tileImage) {
          tileImage = document.createElement("img");
          tileImage.className = "custom-map-runtime__tile";
          tileImage.alt = "";
          tileImage.loading = "lazy";
          tileImage.draggable = false;
          tileImage.width = tileSize;
          tileImage.height = tileSize;
          tileImage.src = basemapTemplate
            .replace("{z}", String(zoom))
            .replace("{x}", String(wrappedTileX))
            .replace("{y}", String(tileY));
          this.tileImages.set(tileKey, tileImage);
          this.tilePane.append(tileImage);
        }

        setTileImageLayout(
          tileImage,
          (tileX * tileSize) - minX,
          (tileY * tileSize) - minY,
          tileSize
        );
        nextTileKeys.add(tileKey);
      }
    }

    [...this.tileImages.entries()].forEach(([tileKey, tileImage]) => {
      if (nextTileKeys.has(tileKey)) {
        return;
      }

      tileImage.remove();
      this.tileImages.delete(tileKey);
    });
  }

  drawGeoJsonLayer(context, layer) {
    const geojson = layer.geojson;
    if (!geojson?.features?.length) return;

    const cameraContext = this.getCameraContext();

    geojson.features.forEach((feature, featureIndex) => {
      const geometry = feature?.geometry;
      if (!geometry) return;

      const style = getFeatureStyle(layer, feature, this);
      const featureId = typeof layer.featureId === "function"
        ? layer.featureId(feature, featureIndex)
        : feature.id ?? feature?.properties?.OBJECTID ?? `${layer.id}:${featureIndex}`;

      if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
        drawGeoJsonPolygon(context, geometry, style, cameraContext);
        if (layer.interactive) {
          this.hitTargets.push(
            buildInteractivePolygonTarget(layer, feature, featureId, this)
          );
        }
        return;
      }

      if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
        drawGeoJsonLine(context, geometry, style, cameraContext);
      }
    });
  }

  drawPointLayer(context, layer) {
    const points = Array.isArray(layer.points) ? layer.points : [];
    if (!points.length) return;

    const cameraContext = this.getCameraContext();
    const clusters = layer.clustered
      ? clusterScreenPoints(points, {
          radius: layer.clusterRadius || DEFAULT_CLUSTER_RADIUS,
          cameraContext,
        })
      : points.map((entry) => ({
          type: "point",
          id: entry.id,
          member: entry,
          members: [entry],
          point: latLngToContainerPoint(
            { lng: entry.coordinates[0], lat: entry.coordinates[1] },
            cameraContext
          ),
        }));

    clusters.forEach((entry) => {
      if (entry.type === "cluster") {
        drawClusterPoint(context, entry.point, entry.count);
        if (layer.interactive) {
          this.hitTargets.push(
            buildInteractivePointTarget(layer, {
              id: entry.id,
              cluster: entry,
              members: entry.members,
            }, entry.point, {
              kind: "cluster",
              radius: 18,
              onClick: layer.onClusterClick,
              priority: 3,
            })
          );
        }
        return;
      }

      const style = typeof layer.pointStyle === "function"
        ? layer.pointStyle(entry.member, this)
        : (layer.pointStyle || entry.member.style || {});
      const point = entry.point;

      switch (style.variant) {
        case "numbered":
          drawNumberedPoint(context, point, style);
          break;
        default:
          drawCirclePoint(context, point, style);
          break;
      }

      if (layer.interactive) {
        this.hitTargets.push(
          buildInteractivePointTarget(layer, entry.member, point, {
            radius: style.hitRadius || style.radius || 14,
            priority: 4,
          })
        );
      }
    });
  }

  pickTarget(screenX, screenY, latlng = this.containerPointToLatLng(screenX, screenY)) {
    const sortedTargets = this.sortedHitTargets;

    for (const target of sortedTargets) {
      if (target.kind === "polygon" && target.contains(latlng)) {
        return target;
      }

      if (target.kind === "point" || target.kind === "cluster") {
        const deltaX = screenX - target.point.x;
        const deltaY = screenY - target.point.y;
        if (Math.hypot(deltaX, deltaY) <= target.radius) {
          return target;
        }
      }
    }

    return null;
  }
}

export const createCustomMapRuntime = (options) => new CustomMapRuntime(options);
