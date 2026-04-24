import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";

import {
  clampCameraToBounds,
  getCameraBounds,
  getFitBoundsCamera,
  normalizeBounds,
  normalizeLatLng,
  panLatLngIntoView,
  createBoundsHandle,
} from "./camera";
import {
  CUSTOM_MAP_RUNTIME_KIND,
  createBasemapSpec,
  createCameraState,
  createLayerSpec,
  MAP_RUNTIME_SENTINEL,
  MAP_RUNTIME_API_VERSION,
  createPopupSpec,
  createSelectionState,
  MAP_RUNTIME_LEGACY_SENTINEL,
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
const PINCH_DISTANCE_THRESHOLD = 6;
const DEFAULT_CLUSTER_RADIUS = 44;
const WHEEL_ZOOM_DELTA_THRESHOLD = 72;
const WHEEL_ZOOM_RESET_DELAY = 180;
const CAMERA_ANIMATION_DURATION = 170;
const TOUCH_POINTER_TYPES = new Set(["touch", "pen"]);

const toDomStyle = (value) => `${Math.round(value * 1000) / 1000}px`;
const DEFAULT_SURFACE_CURSOR = "grab";

const normalizeWheelDelta = (event, viewportHeight = 0) => {
  const deltaY = Number(event?.deltaY) || 0;
  const deltaMode = Number(event?.deltaMode) || 0;

  if (deltaMode === 1) {
    return deltaY * 16;
  }

  if (deltaMode === 2) {
    return deltaY * Math.max(1, viewportHeight || 1);
  }

  return deltaY;
};

const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

const getScreenPointDistance = (left, right) => Math.hypot(
  (right.x || 0) - (left.x || 0),
  (right.y || 0) - (left.y || 0)
);

const getScreenPointMidpoint = (left, right) => ({
  x: ((left.x || 0) + (right.x || 0)) / 2,
  y: ((left.y || 0) + (right.y || 0)) / 2,
});

const getPointerType = (event = {}) => String(event.pointerType || "").toLowerCase();

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

  if (style.labelText) {
    context.save();
    context.fillStyle = normalizeColor(style.labelColor, "#324454");
    context.globalAlpha = Number.isFinite(style.labelOpacity) ? style.labelOpacity : 1;
    context.font = `${style.labelWeight || 700} ${style.labelSize || 12}px Manrope, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.shadowColor = "rgba(255, 255, 255, 0.94)";
    context.shadowBlur = 10;
    context.fillText(
      String(style.labelText),
      point.x,
      point.y - radius - (Number.isFinite(style.labelOffsetY) ? style.labelOffsetY : 8)
    );
    context.restore();
  }
};

const drawPointGuide = (context, anchorPoint, point, style = {}) => {
  const deltaX = point.x - anchorPoint.x;
  const deltaY = point.y - anchorPoint.y;
  if (!style.guideColor || Math.hypot(deltaX, deltaY) < 0.6) {
    return;
  }

  context.save();
  context.strokeStyle = style.guideColor;
  context.lineWidth = Number.isFinite(style.guideWidth) ? style.guideWidth : 1;
  context.beginPath();
  context.moveTo(anchorPoint.x, anchorPoint.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  context.restore();
};

const drawClusterPoint = (context, point, count, options = {}) => {
  const isHovered = Boolean(options.hovered);

  context.save();
  context.shadowColor = isHovered
    ? "rgba(20, 33, 43, 0.16)"
    : "rgba(20, 33, 43, 0.1)";
  context.shadowBlur = isHovered ? 12 : 8;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(point.x, point.y, isHovered ? 16.5 : 15, 0, Math.PI * 2);
  context.fillStyle = "rgba(248, 251, 250, 0.94)";
  context.strokeStyle = isHovered
    ? "rgba(47, 75, 67, 0.38)"
    : "rgba(47, 75, 67, 0.22)";
  context.lineWidth = isHovered ? 1.75 : 1.25;
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(point.x, point.y, isHovered ? 11.5 : 10.5, 0, Math.PI * 2);
  context.fillStyle = isHovered
    ? "rgba(82, 112, 102, 0.94)"
    : "rgba(101, 123, 114, 0.84)";
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 11px Manrope, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(count > 99 ? "99+" : String(count), point.x, point.y + 0.5);
  context.restore();
};

const drawGraveAffordancePoint = (context, point, style = {}) => {
  const radius = Number.isFinite(style.radius) ? style.radius : 13;
  const haloRadius = radius + 1.5;
  const tombWidth = radius * 0.92;
  const tombHeight = radius * 1.08;
  const left = point.x - (tombWidth / 2);
  const right = point.x + (tombWidth / 2);
  const top = point.y - (tombHeight * 0.58);
  const bottom = point.y + (tombHeight * 0.44);
  const archHeight = tombWidth * 0.5;

  context.save();
  context.beginPath();
  context.arc(point.x, point.y, haloRadius, 0, Math.PI * 2);
  context.fillStyle = normalizeColor(style.haloColor, "rgba(255, 255, 255, 0.12)");
  context.fill();

  context.beginPath();
  context.moveTo(left, bottom);
  context.lineTo(left, top + archHeight);
  context.quadraticCurveTo(left, top, point.x, top);
  context.quadraticCurveTo(right, top, right, top + archHeight);
  context.lineTo(right, bottom);
  context.closePath();
  context.fillStyle = normalizeColor(style.fillColor, "rgba(108, 121, 131, 0.3)");
  context.fill();

  context.lineWidth = Number.isFinite(style.weight) ? style.weight : 1.35;
  context.strokeStyle = normalizeColor(style.color, "rgba(242, 247, 249, 0.84)");
  context.stroke();

  context.beginPath();
  context.strokeStyle = normalizeColor(style.glyphColor, "rgba(255, 255, 255, 0.84)");
  context.lineCap = "round";
  context.moveTo(point.x - (tombWidth * 0.18), top + (tombHeight * 0.4));
  context.lineTo(point.x + (tombWidth * 0.18), top + (tombHeight * 0.4));
  context.moveTo(point.x, top + (tombHeight * 0.22));
  context.lineTo(point.x, top + (tombHeight * 0.58));
  context.stroke();
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

const getMetersPerPixelAtLatitude = (latitude, zoom) => (
  156543.03392 * Math.cos((latitude * Math.PI) / 180) / Math.pow(2, zoom)
);

const getPixelsPerMeterAtLatitude = (latitude, zoom) => {
  const metersPerPixel = getMetersPerPixelAtLatitude(latitude, zoom);
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    return 0;
  }

  return 1 / metersPerPixel;
};

function drawMonumentPoint(context, point, style = {}, latitude = 0, zoom = 0) {
  const pixelsPerMeter = getPixelsPerMeterAtLatitude(latitude, zoom);
  const heightMeters = Number.isFinite(style.heightMeters) ? style.heightMeters : 0.7;
  const baseWidthMeters = Number.isFinite(style.baseWidthMeters) ? style.baseWidthMeters : 1.1;
  const baseDepthMeters = Number.isFinite(style.baseDepthMeters) ? style.baseDepthMeters : 0.55;
  const baseWidth = Math.max(4, baseWidthMeters * pixelsPerMeter);
  const baseDepth = Math.max(2.5, baseDepthMeters * pixelsPerMeter);
  const extrusionHeight = Math.max(
    3,
    Math.min(48, heightMeters * pixelsPerMeter * (style.heightScale || 1))
  );
  const shiftX = (Number.isFinite(style.obliqueX) ? style.obliqueX : -0.6) * extrusionHeight;
  const shiftY = (Number.isFinite(style.obliqueY) ? style.obliqueY : -0.95) * extrusionHeight;
  const left = point.x - (baseWidth / 2);
  const top = point.y - (baseDepth / 2);
  const right = point.x + (baseWidth / 2);
  const bottom = point.y + (baseDepth / 2);
  const baseCorners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  const topCorners = baseCorners.map((corner) => ({
    x: corner.x + shiftX,
    y: corner.y + shiftY,
  }));

  context.save();

  context.globalAlpha = Number.isFinite(style.shadowOpacity) ? style.shadowOpacity : 0.18;
  context.fillStyle = normalizeColor(style.shadowColor, "rgba(37, 22, 9, 0.42)");
  context.beginPath();
  context.moveTo(baseCorners[0].x + 2, baseCorners[0].y + 2);
  context.lineTo(baseCorners[1].x + 4, baseCorners[1].y + 2);
  context.lineTo(baseCorners[2].x + 8, baseCorners[2].y + 5);
  context.lineTo(baseCorners[3].x + 6, baseCorners[3].y + 5);
  context.closePath();
  context.fill();

  context.globalAlpha = Number.isFinite(style.opacity) ? style.opacity : 1;
  context.fillStyle = normalizeColor(style.sideColor, "rgba(161, 126, 88, 0.95)");
  context.beginPath();
  context.moveTo(baseCorners[1].x, baseCorners[1].y);
  context.lineTo(topCorners[1].x, topCorners[1].y);
  context.lineTo(topCorners[2].x, topCorners[2].y);
  context.lineTo(baseCorners[2].x, baseCorners[2].y);
  context.closePath();
  context.fill();

  context.fillStyle = normalizeColor(style.frontColor, "rgba(196, 162, 121, 0.96)");
  context.beginPath();
  context.moveTo(baseCorners[3].x, baseCorners[3].y);
  context.lineTo(baseCorners[2].x, baseCorners[2].y);
  context.lineTo(topCorners[2].x, topCorners[2].y);
  context.lineTo(topCorners[3].x, topCorners[3].y);
  context.closePath();
  context.fill();

  context.fillStyle = normalizeColor(style.topColor, "rgba(244, 232, 212, 0.98)");
  context.beginPath();
  context.moveTo(topCorners[0].x, topCorners[0].y);
  context.lineTo(topCorners[1].x, topCorners[1].y);
  context.lineTo(topCorners[2].x, topCorners[2].y);
  context.lineTo(topCorners[3].x, topCorners[3].y);
  context.closePath();
  context.fill();

  context.lineWidth = Number.isFinite(style.weight) ? style.weight : 1;
  context.strokeStyle = normalizeColor(style.color, "rgba(95, 63, 28, 0.88)");
  context.beginPath();
  context.moveTo(baseCorners[1].x, baseCorners[1].y);
  context.lineTo(topCorners[1].x, topCorners[1].y);
  context.lineTo(topCorners[2].x, topCorners[2].y);
  context.lineTo(topCorners[3].x, topCorners[3].y);
  context.lineTo(baseCorners[3].x, baseCorners[3].y);
  context.closePath();
  context.stroke();
  context.restore();
}

const roundLayoutValue = (value) => Math.round(value * 1000) / 1000;
const CAMERA_STATE_EPSILON = 1e-9;

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

const areLatLngsEqual = (left, right) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    Math.abs(left.lat - right.lat) <= CAMERA_STATE_EPSILON &&
    Math.abs(left.lng - right.lng) <= CAMERA_STATE_EPSILON
  );
};

const areCameraStatesEqual = (left, right) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    Math.abs(left.zoom - right.zoom) <= CAMERA_STATE_EPSILON &&
    areLatLngsEqual(left.center, right.center)
  );
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

const isPrimaryPointerButton = (event = {}) => {
  if (event.pointerType === "touch" || event.pointerType === "pen") {
    return true;
  }

  if (!Number.isFinite(event.button)) {
    return true;
  }

  return event.button === 0;
};

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

/**
 * Canvas-backed runtime implementation for the standalone engine contract.
 *
 * The public method names intentionally mirror stable Leaflet map concepts
 * where that improves adapter parity, but the internals here are repo-owned.
 */
export class CustomMapRuntime {
  constructor(options = {}) {
    this[MAP_RUNTIME_SENTINEL] = true;
    this[MAP_RUNTIME_LEGACY_SENTINEL] = true;
    this.__runtimeKind = CUSTOM_MAP_RUNTIME_KIND;
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
    this.activePointers = new Map();
    this.pointerState = null;
    this.pinchState = null;
    this.dragDistance = 0;
    this.hoverTarget = null;
    this.popupState = null;
    this.popupHandle = createPopupHandle(this);
    this.container = null;
    this.surface = null;
    this.tilePane = null;
    this.canvas = null;
    this.tileImages = new Map();
    this.layerImages = new Map();
    this.tileLayoutSignature = null;
    this.resizeObserver = null;
    this.wheelDeltaAccumulator = 0;
    this.wheelResetHandle = null;
    this.cameraAnimationFrame = null;
  }

  /**
   * Mount the runtime into a host element and create the renderer surface.
   */
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
    this.cameraState = this.constrainCameraState(this.cameraState);
    this.render();
    this.syncSurfaceCursor();
    queueMicrotask(() => {
      this.emit("moveend", { target: this });
      this.emit("zoomend", { target: this });
    });

    return this;
  }

  /**
   * Tear down DOM state, listeners, timers, and render caches.
   */
  destroy() {
    this.detachEvents();
    this.cancelCameraAnimation();
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
    this.activePointers.clear();
    this.pointerState = null;
    this.pinchState = null;
    this.dragDistance = 0;
    this.popupState = null;
    this.hoverTarget = null;
    this.tileImages.clear();
    this.layerImages.forEach((entry) => {
      if (!entry?.image) {
        return;
      }

      entry.image.onload = null;
      entry.image.onerror = null;
    });
    this.layerImages.clear();
    this.tileLayoutSignature = null;
    if (typeof window !== "undefined" && this.wheelResetHandle) {
      window.clearTimeout(this.wheelResetHandle);
    }
    this.wheelResetHandle = null;
    this.wheelDeltaAccumulator = 0;
  }

  updateSurfaceCursor(cursor = DEFAULT_SURFACE_CURSOR) {
    if (!this.surface?.style) {
      return;
    }

    this.surface.style.cursor = cursor;
  }

  syncSurfaceCursor(target = this.hoverTarget) {
    if (this.pointerState?.moved || this.pinchState?.moved) {
      this.updateSurfaceCursor("grabbing");
      return;
    }

    if (
      target?.onClick ||
      target?.kind === "point" ||
      target?.kind === "cluster" ||
      target?.kind === "polygon"
    ) {
      this.updateSurfaceCursor("pointer");
      return;
    }

    this.updateSurfaceCursor(DEFAULT_SURFACE_CURSOR);
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

  normalizeCameraState(cameraState) {
    const nextCamera = createCameraState(cameraState);
    return {
      center: normalizeLatLng(nextCamera.center),
      zoom: Math.max(this.minZoom, Math.min(this.maxZoom, nextCamera.zoom)),
    };
  }

  constrainCameraState(cameraState, options = {}) {
    const normalizedCamera = this.normalizeCameraState(cameraState);

    if (options.clampToBounds === false || !this.maxBounds) {
      return normalizedCamera;
    }

    return clampCameraToBounds(normalizedCamera, this.maxBounds, {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
    });
  }

  cancelCameraAnimation() {
    const hadActiveAnimation = Boolean(this.cameraAnimationFrame);
    if (typeof window !== "undefined" && this.cameraAnimationFrame) {
      window.cancelAnimationFrame(this.cameraAnimationFrame);
    }

    this.cameraAnimationFrame = null;
    return hadActiveAnimation;
  }

  applyCameraState(cameraState, options = {}) {
    const nextCamera = this.constrainCameraState(cameraState, options);
    if (areCameraStatesEqual(this.cameraState, nextCamera)) {
      return false;
    }

    this.cameraState = nextCamera;
    this.render();
    this.emit("popupupdate", { popup: this.popupHandle });
    return true;
  }

  /**
   * Apply an immediate camera update without animation.
   */
  setCamera(cameraState, options = {}) {
    this.cancelCameraAnimation();
    const didChange = this.applyCameraState(cameraState, options);
    if (!didChange) {
      return this;
    }

    this.emit("moveend", { target: this });
    this.emit("zoomend", { target: this });
    return this;
  }

  /**
   * Leaflet-compatible camera entry point supporting optional animation.
   */
  setView(center, zoom, options = {}) {
    const nextCamera = this.constrainCameraState({ center, zoom }, options);
    if (areCameraStatesEqual(this.cameraState, nextCamera)) {
      return this;
    }

    if (options.animate) {
      this.stop();
      this.emit("movestart", { target: this });
      this.emit("zoomstart", { target: this });
      return this.animateCamera(nextCamera, options);
    }

    return this.setCamera(nextCamera, options);
  }

  /**
   * Animate toward a target camera while keeping bounds and zoom constraints.
   */
  animateCamera(cameraState, options = {}) {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return this.setCamera(cameraState);
    }

    this.cancelCameraAnimation();
    const startCamera = {
      center: this.getCenter(),
      zoom: this.getZoom(),
    };
    const targetCamera = this.constrainCameraState(cameraState, options);
    if (areCameraStatesEqual(startCamera, targetCamera)) {
      return this;
    }

    const duration = Number.isFinite(options.duration)
      ? Math.max(80, options.duration)
      : CAMERA_ANIMATION_DURATION;
    const startTime = window.performance?.now?.() ?? Date.now();

    const step = (frameTime) => {
      const now = Number.isFinite(frameTime) ? frameTime : (window.performance?.now?.() ?? Date.now());
      const progress = Math.min(1, (now - startTime) / duration);
      const easedProgress = easeOutCubic(progress);

      this.applyCameraState({
        center: {
          lat: startCamera.center.lat + ((targetCamera.center.lat - startCamera.center.lat) * easedProgress),
          lng: startCamera.center.lng + ((targetCamera.center.lng - startCamera.center.lng) * easedProgress),
        },
        zoom: startCamera.zoom + ((targetCamera.zoom - startCamera.zoom) * easedProgress),
      }, options);

      if (progress < 1) {
        this.cameraAnimationFrame = window.requestAnimationFrame(step);
        return;
      }

      this.cameraAnimationFrame = null;
      if (options.settleToBounds) {
        this.applyCameraState(this.cameraState);
      }
      this.emit("moveend", { target: this });
      this.emit("zoomend", { target: this });
    };

    this.cameraAnimationFrame = window.requestAnimationFrame(step);
    return this;
  }

  flyTo(center, zoom, options = {}) {
    return this.setView(center, zoom, options);
  }

  /**
   * Stop the current animation and emit terminal camera events once.
   */
  stop() {
    const didInterruptAnimation = this.cancelCameraAnimation();
    if (!didInterruptAnimation) {
      return this;
    }

    this.emit("popupupdate", { popup: this.popupHandle });
    this.emit("moveend", { target: this });
    this.emit("zoomend", { target: this });
    return this;
  }

  zoomIn() {
    return this.setView(this.getCenter(), Math.min(this.maxZoom, this.getZoom() + 1));
  }

  zoomOut() {
    return this.setView(this.getCenter(), Math.max(this.minZoom, this.getZoom() - 1));
  }

  setMinZoom(zoom) {
    if (!Number.isFinite(zoom)) {
      return this;
    }

    this.minZoom = zoom;
    if (this.maxZoom < this.minZoom) {
      this.maxZoom = this.minZoom;
    }
    return this.setCamera(this.cameraState);
  }

  setMaxZoom(zoom) {
    if (!Number.isFinite(zoom)) {
      return this;
    }

    this.maxZoom = zoom;
    if (this.minZoom > this.maxZoom) {
      this.minZoom = this.maxZoom;
    }
    return this.setCamera(this.cameraState);
  }

  setMaxBounds(bounds) {
    this.maxBounds = normalizeBounds(bounds);
    return this.setCamera(this.cameraState);
  }

  invalidateSize() {
    const previousWidth = this.width;
    const previousHeight = this.height;
    this.measure();
    if (previousWidth === this.width && previousHeight === this.height) {
      return this;
    }

    const didChange = this.applyCameraState(this.cameraState);
    if (!didChange) {
      this.render();
      this.emit("popupupdate", { popup: this.popupHandle });
    }
    this.emit("moveend", { target: this });
    return this;
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

  /**
   * Recenter only as much as needed to keep a target point inside padding.
   */
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

  /**
   * Store popup state inside the runtime so callers are not coupled to DOM overlays.
   */
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

  getSurfacePoint(event = {}) {
    if (Number.isFinite(event.offsetX) && Number.isFinite(event.offsetY)) {
      return {
        x: event.offsetX,
        y: event.offsetY,
      };
    }

    const surfaceRect = this.surface?.getBoundingClientRect?.();
    if (
      surfaceRect &&
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY)
    ) {
      return {
        x: event.clientX - surfaceRect.left,
        y: event.clientY - surfaceRect.top,
      };
    }

    return {
      x: this.width / 2,
      y: this.height / 2,
    };
  }

  updateActivePointer(event = {}) {
    if (!Number.isFinite(event.pointerId)) {
      return null;
    }

    const point = this.getSurfacePoint(event);
    const pointerEntry = {
      pointerId: event.pointerId,
      pointerType: getPointerType(event),
      clientX: Number.isFinite(event.clientX) ? event.clientX : point.x,
      clientY: Number.isFinite(event.clientY) ? event.clientY : point.y,
      point,
    };

    this.activePointers.set(event.pointerId, pointerEntry);
    return pointerEntry;
  }

  getActiveTouchPointers() {
    return [...this.activePointers.values()].filter((pointerEntry) => (
      TOUCH_POINTER_TYPES.has(pointerEntry.pointerType)
    ));
  }

  startDragGesture(pointerEntry) {
    if (!pointerEntry) {
      return;
    }

    this.pinchState = null;
    this.pointerState = {
      pointerId: pointerEntry.pointerId,
      startX: pointerEntry.clientX,
      startY: pointerEntry.clientY,
      center: this.getCenter(),
      moved: false,
    };
    this.dragDistance = 0;
  }

  startPinchGesture(pointerEntries = this.getActiveTouchPointers()) {
    const pinchPointers = pointerEntries.slice(0, 2);
    if (pinchPointers.length < 2) {
      return false;
    }

    const dragWasMoving = Boolean(this.pointerState?.moved);
    const midpoint = getScreenPointMidpoint(
      pinchPointers[0].point,
      pinchPointers[1].point
    );
    const startDistance = Math.max(
      1,
      getScreenPointDistance(pinchPointers[0].point, pinchPointers[1].point)
    );

    this.pointerState = null;
    this.dragDistance = 0;
    this.pinchState = {
      pointerIds: pinchPointers.map((pointerEntry) => pointerEntry.pointerId),
      startMidpoint: midpoint,
      startDistance,
      startZoom: this.getZoom(),
      anchorLatLng: this.containerPointToLatLng(midpoint.x, midpoint.y),
      moved: dragWasMoving,
      emittedMoveStart: dragWasMoving,
      zooming: false,
    };
    this.syncSurfaceCursor();
    return true;
  }

  clearHoverTarget(originalEvent = null) {
    if (!this.hoverTarget) {
      this.syncSurfaceCursor(null);
      return;
    }

    this.hoverTarget = null;
    this.syncSurfaceCursor(null);
    this.emit("hover", { target: null, originalEvent });
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
    if (!isPrimaryPointerButton(event)) return;

    this.stop();
    const pointerEntry = this.updateActivePointer(event);
    if (this.getActiveTouchPointers().length >= 2) {
      this.startPinchGesture();
      this.surface.setPointerCapture?.(event.pointerId);
      return;
    }

    this.startDragGesture(pointerEntry);
    this.surface.setPointerCapture?.(event.pointerId);
    this.syncSurfaceCursor();
  }

  handlePointerMove(event) {
    if (!this.surface) return;

    const pointerEntry = this.updateActivePointer(event);

    if (this.pinchState?.pointerIds.includes(event.pointerId)) {
      const pinchPointers = this.pinchState.pointerIds
        .map((pointerId) => this.activePointers.get(pointerId))
        .filter(Boolean);
      if (pinchPointers.length < 2) {
        return;
      }

      const midpoint = getScreenPointMidpoint(
        pinchPointers[0].point,
        pinchPointers[1].point
      );
      const distance = Math.max(
        1,
        getScreenPointDistance(pinchPointers[0].point, pinchPointers[1].point)
      );
      const midpointTravel = getScreenPointDistance(
        this.pinchState.startMidpoint,
        midpoint
      );
      const distanceTravel = Math.abs(distance - this.pinchState.startDistance);
      const nextZoom = Math.max(
        this.minZoom,
        Math.min(
          this.maxZoom,
          this.pinchState.startZoom + Math.log2(distance / this.pinchState.startDistance)
        )
      );
      const isZoomChanged = Math.abs(nextZoom - this.pinchState.startZoom) > CAMERA_STATE_EPSILON;

      if (
        !this.pinchState.moved &&
        midpointTravel <= DRAG_THRESHOLD &&
        distanceTravel <= PINCH_DISTANCE_THRESHOLD &&
        !isZoomChanged
      ) {
        return;
      }

      if (!this.pinchState.moved) {
        this.pinchState.moved = true;
        this.clearHoverTarget(event);
      }

      if (!this.pinchState.emittedMoveStart) {
        this.pinchState.emittedMoveStart = true;
        this.emit("movestart", { target: this, originalEvent: event });
      }

      if (isZoomChanged && !this.pinchState.zooming) {
        this.pinchState.zooming = true;
        this.emit("zoomstart", { target: this, originalEvent: event });
      }

      const anchorWorldPoint = projectLngLat(
        [this.pinchState.anchorLatLng.lng, this.pinchState.anchorLatLng.lat],
        nextZoom,
        this.tileSize
      );
      const nextCenterWorldPoint = {
        x: anchorWorldPoint.x - (midpoint.x - (this.width / 2)),
        y: anchorWorldPoint.y - (midpoint.y - (this.height / 2)),
      };

      this.applyCameraState({
        center: unprojectPoint(nextCenterWorldPoint, nextZoom, this.tileSize),
        zoom: nextZoom,
      }, {
        clampToBounds: false,
      });
      this.syncSurfaceCursor();
      return;
    }

    if (this.pointerState?.pointerId === event.pointerId) {
      const deltaX = pointerEntry.clientX - this.pointerState.startX;
      const deltaY = pointerEntry.clientY - this.pointerState.startY;
      this.dragDistance = Math.max(this.dragDistance, Math.hypot(deltaX, deltaY));

      if (this.dragDistance <= DRAG_THRESHOLD) {
        return;
      }

      if (!this.pointerState.moved) {
        this.pointerState.moved = true;
        this.clearHoverTarget(event);
        this.emit("movestart", { target: this, originalEvent: event });
      }

      const centerPoint = projectLngLat(
        [this.pointerState.center.lng, this.pointerState.center.lat],
        this.getZoom(),
        this.tileSize
      );
      const nextCenter = {
        x: centerPoint.x - deltaX,
        y: centerPoint.y - deltaY,
      };

      this.applyCameraState({
        center: this.unprojectPoint(nextCenter),
        zoom: this.getZoom(),
      }, {
        clampToBounds: false,
      });
      return;
    }

    const target = this.pickTarget(pointerEntry.point.x, pointerEntry.point.y);
    if (areInteractiveTargetsEqual(this.hoverTarget, target)) {
      return;
    }

    this.hoverTarget = target;
    this.syncSurfaceCursor(target);
    this.emit("hover", {
      target,
      latlng: this.containerPointToLatLng(pointerEntry.point.x, pointerEntry.point.y),
      originalEvent: event,
    });
  }

  handlePointerUp(event) {
    const surfacePoint = this.getSurfacePoint(event);
    const pinchState = this.pinchState;
    const wasPinchPointer = Boolean(
      pinchState?.pointerIds?.includes?.(event.pointerId)
    );

    this.activePointers.delete(event.pointerId);
    this.surface?.releasePointerCapture?.(event.pointerId);

    if (wasPinchPointer) {
      const remainingTouchPointers = this.getActiveTouchPointers();
      if (remainingTouchPointers.length >= 2) {
        this.startPinchGesture(remainingTouchPointers);
        return;
      }

      this.pinchState = null;
      this.pointerState = null;
      this.dragDistance = 0;
      this.syncSurfaceCursor();

      if (pinchState?.moved) {
        this.applyCameraState(this.cameraState);
        this.emit("moveend", { target: this, originalEvent: event });
        if (pinchState.zooming) {
          this.emit("zoomend", { target: this, originalEvent: event });
        }
      }
      return;
    }

    if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) {
      return;
    }
    if (!isPrimaryPointerButton(event)) {
      this.pointerState = null;
      this.dragDistance = 0;
      this.syncSurfaceCursor();
      return;
    }

    const wasDrag = this.pointerState.moved;
    this.pointerState = null;
    this.dragDistance = 0;

    if (wasDrag) {
      this.applyCameraState(this.cameraState);
      this.syncSurfaceCursor();
      this.emit("moveend", { target: this, originalEvent: event });
      return;
    }

    const latlng = this.containerPointToLatLng(surfacePoint.x, surfacePoint.y);
    const target = this.pickTarget(surfacePoint.x, surfacePoint.y, latlng);
    this.syncSurfaceCursor(target);

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
    this.clearHoverTarget();
    this.syncSurfaceCursor();
  }

  handleWheel(event) {
    event.preventDefault();
    this.clearHoverTarget(event);
    const normalizedDelta = normalizeWheelDelta(event, this.height);
    if (!normalizedDelta) {
      return;
    }

    const surfacePoint = this.getSurfacePoint(event);

    this.wheelDeltaAccumulator += normalizedDelta;
    this.resetWheelAccumulator();

    if (Math.abs(this.wheelDeltaAccumulator) < WHEEL_ZOOM_DELTA_THRESHOLD) {
      return;
    }

    const delta = this.wheelDeltaAccumulator > 0 ? -1 : 1;
    this.wheelDeltaAccumulator = 0;
    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.getZoom() + delta));
    if (nextZoom === this.getZoom()) {
      return;
    }

    this.setViewAroundScreenPoint(
      {
        x: surfacePoint.x,
        y: surfacePoint.y,
      },
      nextZoom,
      {
        animate: true,
        duration: 150,
        clampToBounds: false,
        settleToBounds: true,
      }
    );
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

  resetWheelAccumulator() {
    if (typeof window === "undefined") {
      return;
    }

    if (this.wheelResetHandle) {
      window.clearTimeout(this.wheelResetHandle);
    }

    this.wheelResetHandle = window.setTimeout(() => {
      this.wheelDeltaAccumulator = 0;
      this.wheelResetHandle = null;
    }, WHEEL_ZOOM_RESET_DELAY);
  }

  setViewAroundScreenPoint(screenPoint, zoom, options = {}) {
    const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    const anchorLatLng = this.containerPointToLatLng(screenPoint.x, screenPoint.y);
    const anchorWorldPoint = projectLngLat(
      [anchorLatLng.lng, anchorLatLng.lat],
      nextZoom,
      this.tileSize
    );
    const nextCenterWorldPoint = {
      x: anchorWorldPoint.x - (screenPoint.x - (this.width / 2)),
      y: anchorWorldPoint.y - (screenPoint.y - (this.height / 2)),
    };
    const nextCenter = unprojectPoint(nextCenterWorldPoint, nextZoom, this.tileSize);

    return this.setView(nextCenter, nextZoom, options);
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

      if (layer.kind === "image") {
        this.drawImageLayer(context, layer);
        return;
      }

      if (layer.kind === "points") {
        this.drawPointLayer(context, layer);
      }
    });

    this.sortedHitTargets = [...this.hitTargets].sort((left, right) => right.priority - left.priority);
    if (this.hoverTarget && !this.sortedHitTargets.some((target) => areInteractiveTargetsEqual(target, this.hoverTarget))) {
      this.hoverTarget = null;
    }
    this.syncSurfaceCursor();
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

    const cameraZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.getZoom()));
    const tileZoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.floor(cameraZoom)));
    const zoomScale = Math.pow(2, cameraZoom - tileZoom);
    const tileSize = this.basemapSpec.tileSize || this.tileSize;
    const centerPoint = projectLngLat([this.getCenter().lng, this.getCenter().lat], tileZoom, tileSize);
    const halfViewportWidth = this.width / (2 * zoomScale);
    const halfViewportHeight = this.height / (2 * zoomScale);
    const minX = centerPoint.x - halfViewportWidth;
    const minY = centerPoint.y - halfViewportHeight;
    const maxX = centerPoint.x + halfViewportWidth;
    const maxY = centerPoint.y + halfViewportHeight;
    const maxTileIndex = Math.pow(2, tileZoom) - 1;
    const startX = Math.floor(minX / tileSize);
    const endX = Math.floor(maxX / tileSize);
    const startY = Math.max(0, Math.floor(minY / tileSize));
    const endY = Math.min(maxTileIndex, Math.floor(maxY / tileSize));
    const nextTileLayoutSignature = [
      basemapTemplate,
      tileSize,
      tileZoom,
      roundLayoutValue(zoomScale),
      this.width,
      this.height,
      roundLayoutValue(centerPoint.x),
      roundLayoutValue(centerPoint.y),
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
        const tileKey = `${basemapTemplate}|${tileSize}|${tileZoom}|${wrappedTileX}|${tileY}`;
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
            .replace("{z}", String(tileZoom))
            .replace("{x}", String(wrappedTileX))
            .replace("{y}", String(tileY));
          this.tileImages.set(tileKey, tileImage);
          this.tilePane.append(tileImage);
        }

        setTileImageLayout(
          tileImage,
          (((tileX * tileSize) - centerPoint.x) * zoomScale) + (this.width / 2),
          (((tileY * tileSize) - centerPoint.y) * zoomScale) + (this.height / 2),
          tileSize * zoomScale
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

  getLayerImage(layer) {
    const imageUrl = layer?.url || "";
    if (!imageUrl) {
      return null;
    }

    const imageKey = `${layer.id}:${imageUrl}`;
    let entry = this.layerImages.get(imageKey);

    if (!entry) {
      const image = new Image();
      entry = {
        image,
        status: "loading",
        url: imageUrl,
      };
      image.onload = () => {
        entry.status = "loaded";
        this.render();
      };
      image.onerror = () => {
        entry.status = "error";
      };
      image.src = imageUrl;
      this.layerImages.set(imageKey, entry);
    }

    return entry;
  }

  drawImageLayer(context, layer) {
    const bounds = Array.isArray(layer?.bounds) ? layer.bounds : null;
    if (!bounds || bounds.length !== 2) {
      return;
    }

    const southWest = Array.isArray(bounds[0]) ? bounds[0] : [];
    const northEast = Array.isArray(bounds[1]) ? bounds[1] : [];
    if (southWest.length < 2 || northEast.length < 2) {
      return;
    }

    const entry = this.getLayerImage(layer);
    if (!entry?.image || entry.status !== "loaded") {
      return;
    }

    // Image layers are projected into explicit geographic bounds so callers can
    // treat them like a stable runtime primitive instead of a provider overlay.
    const cameraContext = this.getCameraContext();
    const northWestPoint = latLngToContainerPoint(
      { lat: northEast[0], lng: southWest[1] },
      cameraContext
    );
    const southEastPoint = latLngToContainerPoint(
      { lat: southWest[0], lng: northEast[1] },
      cameraContext
    );
    const width = southEastPoint.x - northWestPoint.x;
    const height = southEastPoint.y - northWestPoint.y;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
      return;
    }

    context.save();
    context.globalAlpha = Number.isFinite(layer.opacity) ? layer.opacity : 1;
    context.imageSmoothingEnabled = layer.smoothing !== false;
    context.drawImage(entry.image, northWestPoint.x, northWestPoint.y, width, height);
    context.restore();
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
    const shouldCluster = layer.clustered && !(
      Number.isFinite(layer.disableClusteringAtZoom) &&
      this.getZoom() >= layer.disableClusteringAtZoom
    );
    const clusters = shouldCluster
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
        const isHovered = Boolean(
          this.hoverTarget?.kind === "cluster" &&
          this.hoverTarget.layerId === layer.id &&
          this.hoverTarget.featureId === entry.id
        );
        drawClusterPoint(context, entry.point, entry.count, { hovered: isHovered });
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
      const anchorPoint = entry.point;
      const point = {
        x: anchorPoint.x + (Number.isFinite(style.offsetX) ? style.offsetX : 0),
        y: anchorPoint.y + (Number.isFinite(style.offsetY) ? style.offsetY : 0),
      };

      drawPointGuide(context, anchorPoint, point, style);

      switch (style.variant) {
        case "grave-affordance":
          drawGraveAffordancePoint(context, point, style);
          break;
        case "numbered":
          drawNumberedPoint(context, point, style);
          break;
        case "monument":
          drawMonumentPoint(
            context,
            point,
            style,
            entry.member?.coordinates?.[1],
            this.getZoom()
          );
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
