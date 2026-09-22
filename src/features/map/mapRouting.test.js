import { describe, expect, test } from "bun:test";
import roads from "../../data/ARC_Roads.json";
import { buildRoadGraph, calculateRoadRoute, distanceMeters } from "./mapRouting";

const feature = (coordinates) => ({ type: "Feature", geometry: { type: "LineString", coordinates } });
const graphOf = (...lines) => buildRoadGraph({ type: "FeatureCollection", features: lines.map(feature) });
const a = [-73.73, 42.70];
const b = [-73.729, 42.70];
const c = [-73.729, 42.701];

describe("local road routing", () => {
  test("starts and ends mid-segment without travelling to its ends", () => {
    const graph = graphOf([a, b]);
    const from = [-73.7298, 42.70];
    const to = [-73.7292, 42.70];
    const route = calculateRoadRoute(graph, from, to);
    expect(route.roadDistance).toBeCloseTo(distanceMeters(from, to), 2);
    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.has("start")).toBe(false);
  });
  test("follows the road bend and separates the last gap to a grave", () => {
    const destination = [-73.7289, 42.701];
    const route = calculateRoadRoute(graphOf([a, b, c]), a, destination);
    expect(route.geojson.features[0].geometry.coordinates).toContainEqual(b);
    expect(route.geojson.features[0].geometry.coordinates.at(-1)).toEqual(c);
    expect(route.geojson.features[1].properties.kind).toBe("gap");
    expect(route.endGap).toBeGreaterThan(7);
    expect(route.roadDistance).toBeCloseTo(distanceMeters(a, b) + distanceMeters(b, c), 2);
  });
  test("handles coincident points and exact road vertices", () => {
    const graph = graphOf([a, b, c]);
    expect(calculateRoadRoute(graph, b, b).roadDistance).toBe(0);
    expect(calculateRoadRoute(graph, a, c).roadDistance).toBeGreaterThan(180);
  });
  test("does not invent connections between disconnected or crossing roads", () => {
    const graph = graphOf([a, b], [[-73.7295, 42.6995], [-73.7295, 42.7005]]);
    expect(() => calculateRoadRoute(graph, a, [-73.7295, 42.7005])).toThrow("disconnected");
  });
  test("rejects distant and malformed endpoints", () => {
    const graph = graphOf([a, b]);
    for (const invalid of [[NaN, 42], [181, 42], [-73, 91], null]) {
      expect(() => calculateRoadRoute(graph, invalid, b)).toThrow("valid start");
    }
    expect(() => calculateRoadRoute(graph, [-74, 43], b)).toThrow("100 m");
    expect(() => calculateRoadRoute(graph, a, [-74, 43])).toThrow("too far");
  });
  test("connects only sub-metre gaps at road junctions", () => {
    const close = [b[0] + 0.000004, b[1]];
    expect(calculateRoadRoute(graphOf([a, b], [close, c]), a, c).roadDistance).toBeGreaterThan(180);
    const far = [b[0] + 0.00003, b[1]];
    expect(() => calculateRoadRoute(graphOf([a, b], [far, c]), a, c)).toThrow("disconnected");
  });
  test("bundled cemetery roads form one connected network", () => {
    const graph = buildRoadGraph(roads);
    const todo = [graph.nodes.keys().next().value];
    const visited = new Set(todo);
    while (todo.length) {
      for (const next of graph.edges.get(todo.pop()).keys()) {
        if (!visited.has(next)) { visited.add(next); todo.push(next); }
      }
    }
    expect(visited.size).toBe(graph.nodes.size);
    const route = calculateRoadRoute(graph, [-73.72586398734407, 42.709358811485714], [-73.73362297435509, 42.707493868452055]);
    expect(route.roadDistance).toBeGreaterThan(500);
    expect(route.geojson.features[0].geometry.coordinates.length).toBeGreaterThan(10);
  });
});
