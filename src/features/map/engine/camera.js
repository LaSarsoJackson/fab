import {
  TILE_SIZE,
  containerPointToLatLng,
  createCameraContext,
  latLngToContainerPoint,
  projectLngLat,
} from "./projection";

const toNumber = (value, fallback = 0) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

export const normalizeLatLng = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    return {
      lat: toNumber(value[0]),
      lng: toNumber(value[1]),
    };
  }

  return {
    lat: toNumber(value?.lat),
    lng: toNumber(value?.lng),
  };
};

export const normalizeBounds = (bounds) => {
  if (
    bounds &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.north) &&
    Number.isFinite(bounds.east)
  ) {
    return {
      south: Math.min(bounds.south, bounds.north),
      west: Math.min(bounds.west, bounds.east),
      north: Math.max(bounds.south, bounds.north),
      east: Math.max(bounds.west, bounds.east),
    };
  }

  if (!Array.isArray(bounds) || bounds.length < 2) {
    return null;
  }

  const southWest = normalizeLatLng(bounds[0]);
  const northEast = normalizeLatLng(bounds[1]);

  const south = Math.min(southWest.lat, northEast.lat);
  const north = Math.max(southWest.lat, northEast.lat);
  const west = Math.min(southWest.lng, northEast.lng);
  const east = Math.max(southWest.lng, northEast.lng);

  return {
    south,
    west,
    north,
    east,
  };
};

export const createBoundsHandle = (bounds) => ({
  isValid: () => Boolean(bounds),
  getSouth: () => bounds?.south ?? 0,
  getWest: () => bounds?.west ?? 0,
  getNorth: () => bounds?.north ?? 0,
  getEast: () => bounds?.east ?? 0,
});

export const getBoundsCenter = (bounds) => {
  const normalizedBounds = normalizeBounds(bounds);
  if (!normalizedBounds) {
    return {
      lat: 0,
      lng: 0,
    };
  }

  return {
    lat: (normalizedBounds.south + normalizedBounds.north) / 2,
    lng: (normalizedBounds.west + normalizedBounds.east) / 2,
  };
};

export const getBoundsZoom = (
  bounds,
  {
    width = 0,
    height = 0,
    tileSize = TILE_SIZE,
    minZoom = 0,
    maxZoom = 22,
    paddingTopLeft = [0, 0],
    paddingBottomRight = [0, 0],
  } = {}
) => {
  const normalizedBounds = normalizeBounds(bounds);
  if (!normalizedBounds || width <= 0 || height <= 0) {
    return minZoom;
  }

  const availableWidth = Math.max(1, width - toNumber(paddingTopLeft[0]) - toNumber(paddingBottomRight[0]));
  const availableHeight = Math.max(1, height - toNumber(paddingTopLeft[1]) - toNumber(paddingBottomRight[1]));
  const southWest = projectLngLat([normalizedBounds.west, normalizedBounds.south], 0, tileSize);
  const northEast = projectLngLat([normalizedBounds.east, normalizedBounds.north], 0, tileSize);
  const dx = Math.abs(northEast.x - southWest.x);
  const dy = Math.abs(northEast.y - southWest.y);
  const widthScale = dx > 0 ? availableWidth / dx : Number.POSITIVE_INFINITY;
  const heightScale = dy > 0 ? availableHeight / dy : Number.POSITIVE_INFINITY;
  const zoomScale = Math.min(widthScale, heightScale);

  if (!Number.isFinite(zoomScale) || zoomScale <= 0) {
    return minZoom;
  }

  const rawZoom = Math.floor(Math.log2(zoomScale));
  return Math.max(minZoom, Math.min(maxZoom, rawZoom));
};

export const getFitBoundsCamera = (
  bounds,
  {
    width = 0,
    height = 0,
    tileSize = TILE_SIZE,
    minZoom = 0,
    maxZoom = 22,
    paddingTopLeft = [0, 0],
    paddingBottomRight = [0, 0],
  } = {}
) => {
  const normalizedBounds = normalizeBounds(bounds);
  if (!normalizedBounds) {
    return null;
  }

  const zoom = getBoundsZoom(normalizedBounds, {
    width,
    height,
    tileSize,
    minZoom,
    maxZoom,
    paddingTopLeft,
    paddingBottomRight,
  });
  const center = getBoundsCenter(normalizedBounds);
  const xShift = (toNumber(paddingTopLeft[0]) - toNumber(paddingBottomRight[0])) / 2;
  const yShift = (toNumber(paddingTopLeft[1]) - toNumber(paddingBottomRight[1])) / 2;

  if (!xShift && !yShift) {
    return { center, zoom };
  }

  const cameraContext = createCameraContext({
    width,
    height,
    center,
    zoom,
    tileSize,
  });
  const shiftedCenter = containerPointToLatLng(
    {
      x: (width / 2) + xShift,
      y: (height / 2) + yShift,
    },
    cameraContext
  );

  return {
    center: shiftedCenter,
    zoom,
  };
};

export const getCameraBounds = (
  cameraState,
  {
    width = 0,
    height = 0,
    tileSize = TILE_SIZE,
  } = {}
) => {
  const cameraContext = createCameraContext({
    width,
    height,
    center: normalizeLatLng(cameraState?.center),
    zoom: toNumber(cameraState?.zoom),
    tileSize,
  });
  const topLeft = containerPointToLatLng({ x: 0, y: 0 }, cameraContext);
  const bottomRight = containerPointToLatLng({ x: width, y: height }, cameraContext);

  return {
    south: Math.min(topLeft.lat, bottomRight.lat),
    west: Math.min(topLeft.lng, bottomRight.lng),
    north: Math.max(topLeft.lat, bottomRight.lat),
    east: Math.max(topLeft.lng, bottomRight.lng),
  };
};

export const panLatLngIntoView = (
  cameraState,
  latLng,
  {
    width = 0,
    height = 0,
    tileSize = TILE_SIZE,
    paddingTopLeft = [0, 0],
    paddingBottomRight = [0, 0],
  } = {}
) => {
  const target = normalizeLatLng(latLng);
  const cameraContext = createCameraContext({
    width,
    height,
    center: normalizeLatLng(cameraState?.center),
    zoom: toNumber(cameraState?.zoom),
    tileSize,
  });
  const point = latLngToContainerPoint(target, cameraContext);
  const minX = toNumber(paddingTopLeft[0]);
  const minY = toNumber(paddingTopLeft[1]);
  const maxX = width - toNumber(paddingBottomRight[0]);
  const maxY = height - toNumber(paddingBottomRight[1]);
  const clampedPoint = {
    x: Math.max(minX, Math.min(maxX, point.x)),
    y: Math.max(minY, Math.min(maxY, point.y)),
  };

  if (clampedPoint.x === point.x && clampedPoint.y === point.y) {
    return {
      center: normalizeLatLng(cameraState?.center),
      zoom: toNumber(cameraState?.zoom),
    };
  }

  const centerPoint = latLngToContainerPoint(normalizeLatLng(cameraState?.center), cameraContext);
  const nextCenterContainerPoint = {
    x: centerPoint.x + (point.x - clampedPoint.x),
    y: centerPoint.y + (point.y - clampedPoint.y),
  };

  return {
    center: containerPointToLatLng(nextCenterContainerPoint, cameraContext),
    zoom: toNumber(cameraState?.zoom),
  };
};
