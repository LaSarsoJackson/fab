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

  test("keeps click presses from masquerading as map drags", () => {
    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });
    const moveStartEvents = [];
    const moveEndEvents = [];

    runtime.surface = {
      style: {},
      setPointerCapture() {},
      releasePointerCapture() {},
    };
    runtime.containerPointToLatLng = () => ({ lat: 42.70418, lng: -73.73198 });
    runtime.pickTarget = () => null;
    runtime.on("movestart", (event) => moveStartEvents.push(event));
    runtime.on("moveend", (event) => moveEndEvents.push(event));

    runtime.handlePointerDown({
      button: 0,
      clientX: 120,
      clientY: 180,
      pointerId: 1,
      pointerType: "mouse",
    });
    runtime.handlePointerUp({
      button: 0,
      clientX: 120,
      clientY: 180,
      offsetX: 120,
      offsetY: 180,
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(moveStartEvents).toHaveLength(0);
    expect(moveEndEvents).toHaveLength(0);
    expect(runtime.surface.style.cursor).toBe("grab");
  });

  test("switches cursor affordances when hovering and dragging interactive targets", () => {
    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });
    const moveStartEvents = [];
    const moveEndEvents = [];
    const hoverTarget = {
      kind: "point",
      layerId: "selected-burials",
      featureId: "anna-tracy",
      pointEntry: { id: "anna-tracy" },
      onClick() {},
    };

    runtime.surface = {
      style: {},
      setPointerCapture() {},
      releasePointerCapture() {},
    };
    runtime.containerPointToLatLng = () => ({ lat: 42.70418, lng: -73.73198 });
    runtime.pickTarget = () => hoverTarget;
    runtime.applyCameraState = () => true;
    runtime.on("movestart", (event) => moveStartEvents.push(event));
    runtime.on("moveend", (event) => moveEndEvents.push(event));

    runtime.handlePointerMove({
      offsetX: 120,
      offsetY: 180,
      pointerId: 2,
      pointerType: "mouse",
    });
    expect(runtime.surface.style.cursor).toBe("pointer");

    runtime.handlePointerDown({
      button: 0,
      clientX: 120,
      clientY: 180,
      pointerId: 1,
      pointerType: "mouse",
    });
    runtime.handlePointerMove({
      clientX: 132,
      clientY: 188,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(moveStartEvents).toHaveLength(1);
    expect(runtime.surface.style.cursor).toBe("grabbing");

    runtime.handlePointerUp({
      button: 0,
      clientX: 132,
      clientY: 188,
      offsetX: 132,
      offsetY: 188,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(moveEndEvents).toHaveLength(1);
    expect(runtime.surface.style.cursor).toBe("grab");
  });
});
