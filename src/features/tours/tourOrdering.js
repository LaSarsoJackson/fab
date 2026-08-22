const EARTH_RADIUS_METERS = 6371008.8;

const isCoordinatePair = (coordinates) => (
  Array.isArray(coordinates) &&
  Number.isFinite(coordinates[0]) &&
  Number.isFinite(coordinates[1])
);

const toRadians = (value) => value * (Math.PI / 180);

const distanceBetweenRecords = (left, right) => {
  if (!isCoordinatePair(left?.coordinates) || !isCoordinatePair(right?.coordinates)) {
    return Number.POSITIVE_INFINITY;
  }

  const [leftLongitude, leftLatitude] = left.coordinates;
  const [rightLongitude, rightLatitude] = right.coordinates;
  const latitudeDelta = toRadians(rightLatitude - leftLatitude);
  const longitudeDelta = toRadians(rightLongitude - leftLongitude);
  const leftLatitudeRadians = toRadians(leftLatitude);
  const rightLatitudeRadians = toRadians(rightLatitude);
  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitudeRadians) *
      Math.cos(rightLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2
  );

  return EARTH_RADIUS_METERS * 2 * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine),
  );
};

/**
 * Keep the authored first stop, then choose the nearest unvisited stop.
 * Collections remain source-ordered because they are inventories, not routes.
 */
export const orderTourRecords = (records = [], { kind } = {}) => {
  if (kind !== "tour" || records.length < 3) return records;

  const ordered = [records[0]];
  const remaining = records.slice(1);

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nextIndex = 0;
    let nextDistance = distanceBetweenRecords(current, remaining[0]);

    for (let index = 1; index < remaining.length; index += 1) {
      const distance = distanceBetweenRecords(current, remaining[index]);
      if (distance < nextDistance) {
        nextIndex = index;
        nextDistance = distance;
      }
    }

    ordered.push(remaining[nextIndex]);
    remaining.splice(nextIndex, 1);
  }

  return ordered;
};
