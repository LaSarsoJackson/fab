import { describe, expect, test } from "bun:test";

import { clusterScreenPoints } from "../src/features/map/engine/clustering";

const cameraContext = {
  width: 1200,
  height: 800,
  center: { lat: 42.70418, lng: -73.73198 },
  zoom: 18,
  tileSize: 256,
};

describe("map engine clustering", () => {
  test("clusters nearby points deterministically", () => {
    const inputPoints = [
      { id: "b", coordinates: [-73.73195, 42.70418] },
      { id: "a", coordinates: [-73.73196, 42.70419] },
      { id: "c", coordinates: [-73.72000, 42.71000] },
    ];

    const firstPass = clusterScreenPoints(inputPoints, {
      radius: 60,
      cameraContext,
    });
    const secondPass = clusterScreenPoints([...inputPoints].reverse(), {
      radius: 60,
      cameraContext,
    });

    expect(firstPass).toEqual(secondPass);
    const clusteredEntry = firstPass.find((entry) => entry.type === "cluster");
    expect(clusteredEntry).toBeDefined();
    expect(clusteredEntry.members.map((member) => member.id)).toEqual(["a", "b"]);
  });
});
