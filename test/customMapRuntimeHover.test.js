import { describe, expect, test } from "bun:test";

import { CustomMapRuntime } from "../src/features/map/engine/customRuntime";

describe("custom map runtime hover", () => {
  test("emits hover only when the interactive target changes", () => {
    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });
    const hoverEvents = [];
    const sharedTarget = {
      kind: "point",
      layerId: "selected-burials",
      featureId: "anna-tracy",
      pointEntry: { id: "anna-tracy" },
    };

    runtime.surface = {};
    runtime.containerPointToLatLng = () => ({ lat: 42.70418, lng: -73.73198 });
    runtime.pickTarget = () => sharedTarget;
    runtime.on("hover", (event) => hoverEvents.push(event.target));

    runtime.handlePointerMove({
      offsetX: 120,
      offsetY: 180,
      pointerId: 1,
    });
    runtime.handlePointerMove({
      offsetX: 121,
      offsetY: 181,
      pointerId: 1,
    });
    runtime.handlePointerLeave();
    runtime.handlePointerLeave();

    expect(hoverEvents).toEqual([sharedTarget, null]);
  });
});
