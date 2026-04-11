const isValidCoordinate = (value, min, max) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const formatLatLng = (latitude, longitude) => `${latitude},${longitude}`;

export const buildDirectionsLink = ({
  latitude,
  longitude,
  label = '',
  userAgent = '',
} = {}) => {
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return null;
  }

  const formattedLatLng = formatLatLng(latitude, longitude);
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

    if (cleanedLabel) {
      params.set('q', cleanedLabel);
    }

    return {
      href: `https://maps.apple.com/?${params.toString()}`,
      platform: 'apple',
      target: 'self',
    };
  }

  if (/android/.test(normalizedUserAgent)) {
    const query = cleanedLabel
      ? `${formattedLatLng} (${cleanedLabel})`
      : formattedLatLng;

    return {
      href: `geo:0,0?q=${encodeURIComponent(query)}`,
      platform: 'android',
      target: 'self',
    };
  }

  return {
    href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formattedLatLng)}&travelmode=walking`,
    platform: 'web',
    target: '_blank',
  };
};
