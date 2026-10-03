const RADIUS = 6371008.8;
const radians = (value) => value * Math.PI / 180;

export const distanceMeters = (from, to) => {
  const latitude = radians(to[1] - from[1]);
  const longitude = radians(to[0] - from[0]);
  const h = Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(longitude / 2) ** 2;
  return 2 * RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
};

