//=============================================================================
// Marker Decluttering
//=============================================================================

/**
 * Implements Apple-Maps-style marker decluttering: given markers with lat/lng,
 * decides which ones fit on screen without overlapping at a given zoom, keeping
 * the highest-priority ones. Pure, dependency-free (no Leaflet, no React).
 */

/**
 * projectLatLngToWorldPoint — Web Mercator projection to world pixel space.
 * Returns { x, y } in pixels at the given zoom (tileSize * 2^zoom world width).
 */
export const projectLatLngToWorldPoint = ({ lat, lng, zoom, tileSize = 256 }) => {
  const scale = tileSize * Math.pow(2, Number(zoom) || 0);
  const normalizedLng = Number(lng) || 0;
  const normalizedLat = Number(lat) || 0;
  const x = ((normalizedLng + 180) / 360) * scale;
  const sinLat = Math.sin((normalizedLat * Math.PI) / 180);
  const clampedSin = Math.min(Math.max(sinLat, -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale;
  return { x, y };
};

/**
 * quantizeZoom — snap fractional zoom to a step so declutter results stay
 * stable during pinch gestures. quantizeZoom(14.3) === 14.5 with step 0.5.
 * Non-finite zoom returns 0. Non-finite/<=0 step falls back to 0.5.
 * Result: Math.round(zoom / step) * step.
 */
export const quantizeZoom = (zoom, step = 0.5) => {
  const normalizedZoom = Number(zoom);
  const normalizedStep = Number(step) || 0.5;
  const finalStep = normalizedStep > 0 ? normalizedStep : 0.5;

  if (!Number.isFinite(normalizedZoom)) {
    return 0;
  }

  return Math.round(normalizedZoom / finalStep) * finalStep;
};

/**
 * selectDecollidedMarkers — greedy collision pruning.
 * Behavior:
 * - If markers is not an array or empty, return [].
 * - If zoom is not finite, return a shallow copy of markers with non-finite
 *   lat/lng entries removed (fail open: show everything valid).
 * - Drop markers whose lat or lng is not a finite number.
 * - Project each remaining marker with projectLatLngToWorldPoint.
 * - Sort candidates by getPriority(marker) descending; ties broken by original
 *   input index ascending (stable).
 * - Greedily accept: a candidate is accepted if its axis-aligned box — centered
 *   on its projected point, half-extents from getHalfExtentsPx(marker) plus
 *   paddingPx on each side — does not intersect the box of any already-accepted
 *   marker. Standard AABB intersection. O(n²) is fine (n ≈ 120).
 * - Return accepted markers in ORIGINAL input order (not priority order), as
 *   the original marker object references.
 */
export const selectDecollidedMarkers = (markers = [], {
  zoom,
  getPriority = (marker) => Number(marker?.count) || 0,
  getHalfExtentsPx = () => ({ halfWidth: 18, halfHeight: 20 }),
  paddingPx = 3,
} = {}) => {
  // Input validation
  if (!Array.isArray(markers) || markers.length === 0) {
    return [];
  }

  // Fail-open: if zoom is not finite, return valid markers unfiltered
  const normalizedZoom = Number(zoom);
  if (!Number.isFinite(normalizedZoom)) {
    return markers.filter((marker) => {
      const lat = Number(marker?.lat);
      const lng = Number(marker?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
  }

  // Filter to valid markers with finite lat/lng
  const validMarkers = markers
    .map((marker, index) => {
      const lat = Number(marker?.lat);
      const lng = Number(marker?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      return { marker, index, lat, lng };
    })
    .filter(Boolean);

  if (validMarkers.length === 0) {
    return [];
  }

  // Project each marker to world pixel space
  const projectedMarkers = validMarkers.map(({ marker, index, lat, lng }) => {
    const projected = projectLatLngToWorldPoint({ lat, lng, zoom });
    return { marker, index, projected };
  });

  // Sort by priority (descending), then by original index (ascending)
  const sortedMarkers = projectedMarkers.sort((a, b) => {
    const priorityA = getPriority(a.marker);
    const priorityB = getPriority(b.marker);
    const priorityDiff = Number(priorityB) - Number(priorityA);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.index - b.index;
  });

  // Greedy collision detection
  const acceptedMarkers = [];
  const acceptedBoxes = [];

  sortedMarkers.forEach(({ marker, projected }) => {
    const extents = getHalfExtentsPx(marker);
    const halfWidth = Number(extents?.halfWidth) || 18;
    const halfHeight = Number(extents?.halfHeight) || 20;
    const padding = Number(paddingPx) || 3;

    const candidateBox = {
      minX: projected.x - halfWidth - padding,
      maxX: projected.x + halfWidth + padding,
      minY: projected.y - halfHeight - padding,
      maxY: projected.y + halfHeight + padding,
    };

    // Check for collision with any accepted box
    const collides = acceptedBoxes.some((acceptedBox) => {
      const overlapsX = !(candidateBox.maxX < acceptedBox.minX || candidateBox.minX > acceptedBox.maxX);
      const overlapsY = !(candidateBox.maxY < acceptedBox.minY || candidateBox.minY > acceptedBox.maxY);
      return overlapsX && overlapsY;
    });

    if (!collides) {
      acceptedMarkers.push(marker);
      acceptedBoxes.push(candidateBox);
    }
  });

  // Return accepted markers in original input order
  const acceptedSet = new Set(acceptedMarkers);
  return markers.filter((marker) => acceptedSet.has(marker));
};
