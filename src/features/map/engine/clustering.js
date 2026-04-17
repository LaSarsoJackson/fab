import { latLngToContainerPoint } from "./projection";

const toClusterCoordinate = (point) => ({
  x: Math.round(point.x * 1000) / 1000,
  y: Math.round(point.y * 1000) / 1000,
});

const buildClusterKey = (point, radius) => {
  const cellX = Math.floor(point.x / radius);
  const cellY = Math.floor(point.y / radius);
  return `${cellX}:${cellY}`;
};

export const clusterScreenPoints = (
  points,
  {
    radius = 44,
    cameraContext,
    minClusterSize = 2,
  } = {}
) => {
  const buckets = new Map();
  const stablePoints = [...points].sort((left, right) => (
    String(left?.id || "").localeCompare(String(right?.id || ""))
  ));

  stablePoints.forEach((entry, index) => {
    const coordinates = Array.isArray(entry?.coordinates) ? entry.coordinates : null;
    if (!coordinates || coordinates.length < 2) {
      return;
    }

    const point = latLngToContainerPoint(
      { lng: coordinates[0], lat: coordinates[1] },
      cameraContext
    );
    const clusterKey = buildClusterKey(point, radius);
    const bucket = buckets.get(clusterKey) || {
      key: clusterKey,
      members: [],
      x: 0,
      y: 0,
    };

    bucket.members.push({
      ...entry,
      index,
      point: toClusterCoordinate(point),
    });
    bucket.x += point.x;
    bucket.y += point.y;
    buckets.set(clusterKey, bucket);
  });

  return Array.from(buckets.values())
    .map((bucket) => {
      if (bucket.members.length < minClusterSize) {
        return bucket.members.map((member) => ({
          type: "point",
          id: member.id,
          member,
          point: member.point,
          members: [member],
        }));
      }

      const sortedMembers = [...bucket.members].sort((left, right) => {
        const leftKey = String(left.id || left.index);
        const rightKey = String(right.id || right.index);
        return leftKey.localeCompare(rightKey);
      });

      return [{
        type: "cluster",
        id: `cluster:${bucket.key}`,
        point: {
          x: bucket.x / bucket.members.length,
          y: bucket.y / bucket.members.length,
        },
        members: sortedMembers,
        count: sortedMembers.length,
      }];
    })
    .flat()
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
};
