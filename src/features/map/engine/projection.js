export const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;

export const clampLatitude = (latitude) => (
  Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, Number(latitude) || 0))
);

export const normalizeLongitude = (longitude) => {
  let nextLongitude = Number(longitude) || 0;

  while (nextLongitude < -180) nextLongitude += 360;
  while (nextLongitude > 180) nextLongitude -= 360;

  return nextLongitude;
};

export const getWorldSize = (zoom, tileSize = TILE_SIZE) => (
  tileSize * Math.pow(2, Math.max(0, zoom))
);

export const projectLngLat = ([lng, lat], zoom, tileSize = TILE_SIZE) => {
  const normalizedLongitude = normalizeLongitude(lng);
  const clampedLatitude = clampLatitude(lat);
  const worldSize = getWorldSize(zoom, tileSize);
  const sinLatitude = Math.sin((clampedLatitude * Math.PI) / 180);
  const x = ((normalizedLongitude + 180) / 360) * worldSize;
  const y = (
    0.5 -
    Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)
  ) * worldSize;

  return { x, y };
};

export const unprojectPoint = ({ x, y }, zoom, tileSize = TILE_SIZE) => {
  const worldSize = getWorldSize(zoom, tileSize);
  const longitude = (x / worldSize) * 360 - 180;
  const mercatorN = Math.PI - ((2 * Math.PI * y) / worldSize);
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(mercatorN));

  return {
    lng: normalizeLongitude(longitude),
    lat: clampLatitude(latitude),
  };
};

export const createCameraContext = ({
  width = 0,
  height = 0,
  center = { lat: 0, lng: 0 },
  zoom = 0,
  tileSize = TILE_SIZE,
} = {}) => ({
  width,
  height,
  center,
  zoom,
  tileSize,
});

export const latLngToContainerPoint = (latLng, cameraContext) => {
  const width = Number(cameraContext?.width) || 0;
  const height = Number(cameraContext?.height) || 0;
  const center = cameraContext?.center || { lat: 0, lng: 0 };
  const zoom = Number(cameraContext?.zoom) || 0;
  const tileSize = Number(cameraContext?.tileSize) || TILE_SIZE;

  const centerPoint = projectLngLat([center.lng, center.lat], zoom, tileSize);
  const featurePoint = projectLngLat([latLng.lng, latLng.lat], zoom, tileSize);

  return {
    x: featurePoint.x - centerPoint.x + (width / 2),
    y: featurePoint.y - centerPoint.y + (height / 2),
  };
};

export const containerPointToLatLng = (point, cameraContext) => {
  const width = Number(cameraContext?.width) || 0;
  const height = Number(cameraContext?.height) || 0;
  const center = cameraContext?.center || { lat: 0, lng: 0 };
  const zoom = Number(cameraContext?.zoom) || 0;
  const tileSize = Number(cameraContext?.tileSize) || TILE_SIZE;

  const centerPoint = projectLngLat([center.lng, center.lat], zoom, tileSize);
  const worldPoint = {
    x: centerPoint.x + (point.x - (width / 2)),
    y: centerPoint.y + (point.y - (height / 2)),
  };

  return unprojectPoint(worldPoint, zoom, tileSize);
};
