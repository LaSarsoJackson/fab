const isValidCoordinate = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const formatLatLng = (latitude, longitude) => `${latitude},${longitude}`;

export const buildDirectionsLink = ({
  latitude,
  longitude,
  label = '',
  originLatitude,
  originLongitude,
  userAgent = '',
} = {}) => {
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return null;
  }

  const formattedLatLng = formatLatLng(latitude, longitude);
  const hasOrigin = isValidCoordinate(originLatitude, -90, 90) &&
    isValidCoordinate(originLongitude, -180, 180);
  const formattedOriginLatLng = hasOrigin
    ? formatLatLng(originLatitude, originLongitude)
    : '';
  const normalizedUserAgent = userAgent.toLowerCase();
  const cleanedLabel = String(label || '').trim();

  if (
    /iphone|ipad|ipod|macintosh/.test(normalizedUserAgent) ||
    /mac os x/.test(normalizedUserAgent)
  ) {
    const params = new URLSearchParams({
      daddr: formattedLatLng,
      dirflg: 'w',
    });

    if (hasOrigin) {
      params.set('saddr', formattedOriginLatLng);
    }

    if (cleanedLabel) {
      params.set('q', cleanedLabel);
    }

    return {
      href: `https://maps.apple.com/?${params.toString()}`,
      platform: 'apple',
      target: 'self',
    };
  }

  const googleMapsDirectionsParams = new URLSearchParams({
    api: '1',
    destination: formattedLatLng,
    travelmode: 'walking',
  });

  if (hasOrigin) {
    googleMapsDirectionsParams.set('origin', formattedOriginLatLng);
  }

  if (/android/.test(normalizedUserAgent)) {
    return {
      href: `https://www.google.com/maps/dir/?${googleMapsDirectionsParams.toString()}`,
      platform: 'android',
      target: 'self',
    };
  }

  return {
    href: `https://www.google.com/maps/dir/?${googleMapsDirectionsParams.toString()}`,
    platform: 'web',
    target: '_blank',
  };
};
