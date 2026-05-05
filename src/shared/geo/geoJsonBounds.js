const updateBounds = (currentBounds, lng, lat) => ({
  south: Math.min(currentBounds.south, lat),
  west: Math.min(currentBounds.west, lng),
  north: Math.max(currentBounds.north, lat),
  east: Math.max(currentBounds.east, lng),
});

const isCoordinatePairValid = ([lngValue, latValue]) => {
  const lng = Number(lngValue);
  const lat = Number(latValue);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const walkCoordinates = (coordinates, onCoordinatePair) => {
  if (!Array.isArray(coordinates)) return;

  // GeoJSON geometries nest coordinate pairs at different depths. Walk the
  // array recursively and treat the first scalar pair as a longitude/latitude.
  if (
    coordinates.length >= 2 &&
    !Array.isArray(coordinates[0]) &&
    !Array.isArray(coordinates[1])
  ) {
    onCoordinatePair(coordinates);
    return;
  }

  coordinates.forEach((child) => walkCoordinates(child, onCoordinatePair));
};

const walkGeoJson = (value, onCoordinatePair) => {
  if (!value || typeof value !== "object") return;

  if (value.type === "FeatureCollection") {
    (value.features || []).forEach((feature) => walkGeoJson(feature, onCoordinatePair));
    return;
  }

  if (value.type === "Feature") {
    walkGeoJson(value.geometry, onCoordinatePair);
    return;
  }

  if (value.type === "GeometryCollection") {
    (value.geometries || []).forEach((geometry) => walkGeoJson(geometry, onCoordinatePair));
    return;
  }

  walkCoordinates(value.coordinates, onCoordinatePair);
};

export const getGeoJsonBounds = (geoJson) => {
  // Return Leaflet-style [[south, west], [north, east]] bounds so map modules
  // do not need to translate generic GeoJSON extent objects.
  let bounds = {
    south: Number.POSITIVE_INFINITY,
    west: Number.POSITIVE_INFINITY,
    north: Number.NEGATIVE_INFINITY,
    east: Number.NEGATIVE_INFINITY,
  };

  walkGeoJson(geoJson, ([lngValue, latValue]) => {
    if (!isCoordinatePairValid([lngValue, latValue])) return;

    const lng = Number(lngValue);
    const lat = Number(latValue);

    bounds = updateBounds(bounds, lng, lat);
  });

  if (
    !Number.isFinite(bounds.south) ||
    !Number.isFinite(bounds.west) ||
    !Number.isFinite(bounds.north) ||
    !Number.isFinite(bounds.east)
  ) {
    return null;
  }

  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ];
};

export const hasValidGeoJsonCoordinates = (geoJson) => {
  let sawCoordinatePair = false;
  let allCoordinatePairsValid = true;

  walkGeoJson(geoJson, (coordinatePair) => {
    sawCoordinatePair = true;

    if (!isCoordinatePairValid(coordinatePair)) {
      allCoordinatePairsValid = false;
    }
  });

  return sawCoordinatePair && allCoordinatePairsValid;
};

export const isLatLngBoundsExpressionValid = (bounds) => (
  Array.isArray(bounds) &&
  bounds.length === 2 &&
  bounds.every((point) => (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  ))
);
