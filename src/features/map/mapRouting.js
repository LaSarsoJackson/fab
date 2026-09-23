import roads from "../../data/ARC_Roads.json";
import { isCoordinatePairValid } from "../../shared/geoJsonBounds";

const RADIUS = 6371008.8;
const radians = (value) => value * Math.PI / 180;
const keyFor = (coordinate) => coordinate.map((value) => value.toFixed(6)).join(",");

export const distanceMeters = (from, to) => {
  const latitude = radians(to[1] - from[1]);
  const longitude = radians(to[0] - from[0]);
  const h = Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(from[1])) * Math.cos(radians(to[1])) * Math.sin(longitude / 2) ** 2;
  return 2 * RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
};

const connect = (edges, from, to, distance) => {
  if (from === to) return;
  edges.get(from).set(to, Math.min(edges.get(from).get(to) ?? Infinity, distance));
  edges.get(to).set(from, Math.min(edges.get(to).get(from) ?? Infinity, distance));
};

export const buildRoadGraph = (data) => {
  const nodes = new Map();
  const edges = new Map();
  const segments = [];
  for (const feature of data.features) {
    const geometry = feature.geometry;
    const lines = geometry.type === "MultiLineString" ? geometry.coordinates
      : geometry.type === "LineString" ? [geometry.coordinates] : [];
    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        const a = line[index - 1];
        const b = line[index];
        if (!isCoordinatePairValid(a) || !isCoordinatePairValid(b)) continue;
        const keys = [keyFor(a), keyFor(b)];
        if (keys[0] === keys[1]) continue;
        for (const [index, point] of [a, b].entries()) {
          if (!nodes.has(keys[index])) {
            nodes.set(keys[index], point);
            edges.set(keys[index], new Map());
          }
        }
        connect(edges, keys[0], keys[1], distanceMeters(a, b));
        segments.push({ a, b, keys });
      }
    }
  }
  // The source has sub-metre export gaps at some shared junctions. Preserve
  // the former module's 1 m tolerance; never bridge distinct nearby roads.
  const entries = [...nodes];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const gap = distanceMeters(entries[i][1], entries[j][1]);
      if (gap <= 1) connect(edges, entries[i][0], entries[j][0], gap);
    }
  }
  return { nodes, edges, segments };
};

const nearestRoad = (point, graph) => {
  let nearest = null;
  for (const segment of graph.segments) {
    const { a, b } = segment;
    const scale = Math.cos(radians((a[1] + b[1] + point[1]) / 3));
    const dx = (b[0] - a[0]) * scale;
    const dy = b[1] - a[1];
    const ratio = Math.max(0, Math.min(1,
      (((point[0] - a[0]) * scale * dx) + ((point[1] - a[1]) * dy)) / (dx * dx + dy * dy)
    ));
    const coordinate = [a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])];
    const distance = distanceMeters(point, coordinate);
    if (!nearest || distance < nearest.distance) nearest = { coordinate, distance, segment };
  }
  return nearest;
};

const shortestPath = (edges, start, end) => {
  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const visited = new Set();
  while (visited.size < edges.size) {
    let current = null;
    let best = Infinity;
    for (const [key, distance] of distances) {
      if (!visited.has(key) && distance < best) { current = key; best = distance; }
    }
    if (current === null) return null;
    if (current === end) {
      const path = [end];
      while (path[0] !== start) path.unshift(previous.get(path[0]));
      return { path, distance: best };
    }
    visited.add(current);
    for (const [next, length] of edges.get(current)) {
      const distance = best + length;
      if (distance < (distances.get(next) ?? Infinity)) {
        distances.set(next, distance);
        previous.set(next, current);
      }
    }
  }
  return null;
};

const lineFeature = (kind, coordinates) => ({
  type: "Feature", properties: { kind }, geometry: { type: "LineString", coordinates },
});

export const calculateRoadRoute = (graph, from, to) => {
  if (!isCoordinatePairValid(from) || !isCoordinatePairValid(to)) {
    throw new Error("Choose a valid start and destination on the map.");
  }
  const start = nearestRoad(from, graph);
  const end = nearestRoad(to, graph);
  if (!start || !end) throw new Error("Cemetery road data is unavailable.");
  if (start.distance > 100) throw new Error("Choose a start within 100 m of a cemetery road, or use Maps for directions to the cemetery.");
  if (end.distance > 150) throw new Error("The destination is too far from the mapped roads. Choose a closer point.");

  // Virtual endpoints let a route start mid-segment without changing the graph.
  const nodes = new Map(graph.nodes);
  const edges = new Map([...graph.edges].map(([key, neighbors]) => [key, new Map(neighbors)]));
  for (const [key, snap] of [["start", start], ["end", end]]) {
    nodes.set(key, snap.coordinate);
    edges.set(key, new Map());
    for (const endpoint of snap.segment.keys) {
      connect(edges, key, endpoint, distanceMeters(snap.coordinate, nodes.get(endpoint)));
    }
  }
  if (start.segment === end.segment) connect(edges, "start", "end", distanceMeters(start.coordinate, end.coordinate));
  const route = shortestPath(edges, "start", "end");
  if (!route) throw new Error("These points are on disconnected roads. Choose another point; FAB will not draw a shortcut between them.");
  const features = [lineFeature("road", route.path.map((key) => nodes.get(key)))];
  if (start.distance > 1) features.push(lineFeature("gap", [from, start.coordinate]));
  if (end.distance > 1) features.push(lineFeature("gap", [end.coordinate, to]));
  return {
    geojson: { type: "FeatureCollection", features },
    roadDistance: route.distance,
    startGap: start.distance,
    endGap: end.distance,
  };
};

let cemeteryGraph;
export const routeOnCemeteryRoads = (from, to) => {
  cemeteryGraph ||= buildRoadGraph(roads);
  return calculateRoadRoute(cemeteryGraph, from, to);
};
