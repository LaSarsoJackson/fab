/** @jest-environment jsdom */

import { CustomMapRuntime } from "./customRuntime";

const createCanvasContext = () => ({
  arc: jest.fn(),
  beginPath: jest.fn(),
  clearRect: jest.fn(),
  closePath: jest.fn(),
  drawImage: jest.fn(),
  fill: jest.fn(),
  fillText: jest.fn(),
  lineTo: jest.fn(),
  moveTo: jest.fn(),
  restore: jest.fn(),
  save: jest.fn(),
  stroke: jest.fn(),
});

const setRuntimeSurfaceRect = (runtime, { left = 0, top = 0, width, height }) => {
  runtime.surface.getBoundingClientRect = jest.fn(() => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }));
};

describe("CustomMapRuntime", () => {
  let originalResizeObserver;
  let originalGetContext;
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalResizeObserver = global.ResizeObserver;
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalRequestAnimationFrame = global.window?.requestAnimationFrame;
    originalCancelAnimationFrame = global.window?.cancelAnimationFrame;

    global.ResizeObserver = class ResizeObserver {
      observe() {}
      disconnect() {}
    };

    HTMLCanvasElement.prototype.getContext = jest.fn(() => createCanvasContext());
  });

  afterEach(() => {
    if (originalResizeObserver) {
      global.ResizeObserver = originalResizeObserver;
    } else {
      delete global.ResizeObserver;
    }

    HTMLCanvasElement.prototype.getContext = originalGetContext;
    if (originalRequestAnimationFrame) {
      global.window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete global.window.requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      global.window.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete global.window.cancelAnimationFrame;
    }
    document.body.innerHTML = "";
    jest.clearAllMocks();
  });

  test("keeps existing raster tiles mounted across selection-only renders", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
      basemapSpec: {
        id: "osm",
        type: "raster-xyz",
        urlTemplate: "https://tiles.test/{z}/{x}/{y}.png",
      },
    });

    runtime.mount(container);

    const initialTiles = [...container.querySelectorAll(".custom-map-runtime__tile")];
    expect(initialTiles.length).toBeGreaterThan(0);

    const firstTile = initialTiles[0];

    runtime.setSelection({
      hoveredId: "anna-tracy",
      ids: ["anna-tracy"],
    });

    const nextTiles = [...container.querySelectorAll(".custom-map-runtime__tile")];
    expect(nextTiles).toHaveLength(initialTiles.length);
    expect(nextTiles[0]).toBe(firstTile);

    runtime.destroy();
  });

  test("stop interrupts an in-flight camera animation and emits coherent end events", async () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    let nextFrameId = 1;
    const animationFrames = new Map();
    global.window.requestAnimationFrame = jest.fn((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
    global.window.cancelAnimationFrame = jest.fn((frameId) => {
      animationFrames.delete(frameId);
    });

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
      basemapSpec: {
        id: "osm",
        type: "raster-xyz",
        urlTemplate: "https://tiles.test/{z}/{x}/{y}.png",
      },
    });

    runtime.mount(container);
    await Promise.resolve();

    const moveEnd = jest.fn();
    const zoomEnd = jest.fn();
    runtime.on("moveend", moveEnd);
    runtime.on("zoomend", zoomEnd);

    runtime.setView([42.70918, -73.72198], 16, {
      animate: true,
      duration: 180,
    });

    expect(global.window.requestAnimationFrame).toHaveBeenCalled();
    expect(animationFrames.size).toBeGreaterThan(0);

    runtime.stop();

    expect(global.window.cancelAnimationFrame).toHaveBeenCalled();
    expect(moveEnd).toHaveBeenCalledTimes(1);
    expect(zoomEnd).toHaveBeenCalledTimes(1);

    runtime.destroy();
  });

  test("stops clustering point layers once the disable-clustering zoom is reached", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 20,
    });

    runtime.mount(container);
    runtime.setLayers([{
      id: "section-burials",
      kind: "points",
      interactive: true,
      clustered: true,
      disableClusteringAtZoom: 21,
      clusterRadius: 40,
      points: [
        { id: "a", coordinates: [-73.73198, 42.70418] },
        { id: "b", coordinates: [-73.73198, 42.70418] },
      ],
    }]);

    expect(runtime.hitTargets.filter((target) => target.kind === "cluster")).toHaveLength(1);

    runtime.setView([42.70418, -73.73198], 21);

    expect(runtime.hitTargets.filter((target) => target.kind === "cluster")).toHaveLength(0);
    expect(
      runtime.hitTargets.filter(
        (target) => target.kind === "point" && target.layerId === "section-burials"
      )
    ).toHaveLength(2);

    runtime.destroy();
  });

  test("keeps the camera inside configured max bounds during drag and programmatic moves", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
      minZoom: 13,
      maxZoom: 25,
      maxBounds: [
        [42.7038, -73.7324],
        [42.7045, -73.7315],
      ],
    });

    runtime.mount(container);
    runtime.setView([42.71, -73.72], 14);

    const boundedCenter = runtime.getCenter();
    expect(boundedCenter.lat).toBeLessThanOrEqual(42.7045);
    expect(boundedCenter.lat).toBeGreaterThanOrEqual(42.7038);
    expect(boundedCenter.lng).toBeLessThanOrEqual(-73.7315);
    expect(boundedCenter.lng).toBeGreaterThanOrEqual(-73.7324);

    runtime.setMaxBounds([
      [42.704, -73.7322],
      [42.7043, -73.7318],
    ]);
    const tighterCenter = runtime.getCenter();
    expect(tighterCenter.lat).toBeLessThanOrEqual(42.7043);
    expect(tighterCenter.lat).toBeGreaterThanOrEqual(42.704);
    expect(tighterCenter.lng).toBeLessThanOrEqual(-73.7318);
    expect(tighterCenter.lng).toBeGreaterThanOrEqual(-73.7322);

    runtime.destroy();
  });

  test("allows drag movement to overshoot tight bounds before settling on release", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 800,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.7061, -73.7322],
      zoom: 14,
      minZoom: 13,
      maxZoom: 25,
      maxBounds: [
        [42.6978, -73.7427],
        [42.7145, -73.7218],
      ],
    });

    runtime.mount(container);

    const initialCenter = runtime.getCenter();

    runtime.handlePointerDown({
      pointerId: 1,
      clientX: 600,
      clientY: 400,
    });
    runtime.handlePointerMove({
      pointerId: 1,
      clientX: 760,
      clientY: 400,
    });

    const draggedCenter = runtime.getCenter();
    expect(draggedCenter.lng).not.toBeCloseTo(initialCenter.lng, 8);

    runtime.handlePointerUp({
      pointerId: 1,
      clientX: 760,
      clientY: 400,
      offsetX: 760,
      offsetY: 400,
    });

    const settledCenter = runtime.getCenter();
    expect(settledCenter.lng).toBeCloseTo(initialCenter.lng, 8);

    runtime.destroy();
  });

  test("lets wheel zoom follow the pointer before settling back inside tight bounds", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 800,
    });
    document.body.appendChild(container);

    let nextFrameId = 1;
    const animationFrames = new Map();
    global.window.requestAnimationFrame = jest.fn((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
    global.window.cancelAnimationFrame = jest.fn((frameId) => {
      animationFrames.delete(frameId);
    });
    const performanceNowSpy = jest.spyOn(global.window.performance, "now").mockImplementation(() => 0);

    const runtime = new CustomMapRuntime({
      center: [42.7061, -73.7322],
      zoom: 14,
      minZoom: 13,
      maxZoom: 25,
      maxBounds: [
        [42.6978, -73.7427],
        [42.7145, -73.7218],
      ],
    });

    runtime.mount(container);

    const initialCenter = runtime.getCenter();

    runtime.handleWheel({
      preventDefault: jest.fn(),
      deltaY: -120,
      deltaMode: 0,
      offsetX: 120,
      offsetY: 400,
    });

    expect(global.window.requestAnimationFrame).toHaveBeenCalled();

    const [initialFrameId, initialFrame] = animationFrames.entries().next().value;
    animationFrames.delete(initialFrameId);
    initialFrame(75);

    const zoomingCenter = runtime.getCenter();
    expect(zoomingCenter.lng).not.toBeCloseTo(initialCenter.lng, 8);

    const [settleFrameId, settleFrame] = animationFrames.entries().next().value;
    animationFrames.delete(settleFrameId);
    settleFrame(150);

    const settledCenter = runtime.getCenter();
    expect(settledCenter.lng).toBeCloseTo(initialCenter.lng, 8);

    performanceNowSpy.mockRestore();
    runtime.destroy();
  });

  test("supports two-finger pinch zoom and pan on touch surfaces", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 800,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.7061, -73.7322],
      zoom: 14,
      minZoom: 13,
      maxZoom: 25,
    });

    runtime.mount(container);
    setRuntimeSurfaceRect(runtime, { width: 1200, height: 800 });

    const initialCenter = runtime.getCenter();
    const initialZoom = runtime.getZoom();
    const moveStart = jest.fn();
    const zoomStart = jest.fn();
    const moveEnd = jest.fn();
    const zoomEnd = jest.fn();

    runtime.on("movestart", moveStart);
    runtime.on("zoomstart", zoomStart);
    runtime.on("moveend", moveEnd);
    runtime.on("zoomend", zoomEnd);

    runtime.handlePointerDown({
      pointerId: 1,
      pointerType: "touch",
      clientX: 500,
      clientY: 400,
    });
    runtime.handlePointerDown({
      pointerId: 2,
      pointerType: "touch",
      clientX: 700,
      clientY: 400,
    });
    runtime.handlePointerMove({
      pointerId: 1,
      pointerType: "touch",
      clientX: 460,
      clientY: 400,
    });
    runtime.handlePointerMove({
      pointerId: 2,
      pointerType: "touch",
      clientX: 780,
      clientY: 400,
    });

    expect(runtime.getZoom()).toBeGreaterThan(initialZoom);
    expect(runtime.getCenter().lng).not.toBeCloseTo(initialCenter.lng, 8);
    expect(moveStart).toHaveBeenCalledTimes(1);
    expect(zoomStart).toHaveBeenCalledTimes(1);

    runtime.handlePointerUp({
      pointerId: 1,
      pointerType: "touch",
      clientX: 460,
      clientY: 400,
    });

    expect(moveEnd).toHaveBeenCalledTimes(1);
    expect(zoomEnd).toHaveBeenCalledTimes(1);

    runtime.handlePointerUp({
      pointerId: 2,
      pointerType: "touch",
      clientX: 780,
      clientY: 400,
    });

    runtime.destroy();
  });

  test("uses client coordinates for touch taps when offset coordinates are unavailable", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });

    runtime.mount(container);
    setRuntimeSurfaceRect(runtime, { width: 640, height: 480 });

    const onPointClick = jest.fn();
    runtime.setLayers([{
      id: "selected-burials",
      kind: "points",
      interactive: true,
      points: [{
        id: "anna-tracy",
        coordinates: [-73.73198, 42.70418],
        record: { id: "anna-tracy" },
      }],
      pointStyle: {
        radius: 8,
        hitRadius: 18,
      },
      onPointClick,
    }]);

    const point = runtime.projectCoordinates([-73.73198, 42.70418]);
    runtime.handlePointerDown({
      pointerId: 1,
      pointerType: "touch",
      clientX: point.x,
      clientY: point.y,
    });
    runtime.handlePointerUp({
      pointerId: 1,
      pointerType: "touch",
      clientX: point.x,
      clientY: point.y,
    });

    expect(onPointClick).toHaveBeenCalledTimes(1);
    expect(onPointClick.mock.calls[0][0]).toEqual(expect.objectContaining({
      runtime,
      target: expect.objectContaining({
        layerId: "selected-burials",
        pointEntry: expect.objectContaining({
          id: "anna-tracy",
        }),
      }),
    }));

    runtime.destroy();
  });

  test("updates zoom constraints through Leaflet-compatible setters", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
      minZoom: 13,
      maxZoom: 18,
    });

    runtime.mount(container);
    runtime.setMinZoom(15);
    expect(runtime.getZoom()).toBe(15);

    runtime.setMaxZoom(16);
    runtime.zoomIn();
    runtime.zoomIn();
    expect(runtime.getZoom()).toBe(16);

    runtime.destroy();
  });

  test("invalidateSize remeasures and redraws the runtime surface", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 240,
    });
    document.body.appendChild(container);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });

    runtime.mount(container);
    expect(runtime.width).toBe(320);
    expect(runtime.height).toBe(240);

    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });

    runtime.invalidateSize();

    expect(runtime.width).toBe(640);
    expect(runtime.height).toBe(480);

    runtime.destroy();
  });

  test("renders image layers from preloaded overlay entries", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(container, "clientHeight", {
      configurable: true,
      value: 480,
    });
    document.body.appendChild(container);

    const context = createCanvasContext();
    HTMLCanvasElement.prototype.getContext = jest.fn(() => context);

    const runtime = new CustomMapRuntime({
      center: [42.70418, -73.73198],
      zoom: 14,
    });

    runtime.mount(container);
    runtime.layerImages.set("site-twin-surface:/data/site_twin/terrain_surface.png", {
      image: { complete: true },
      status: "loaded",
      url: "/data/site_twin/terrain_surface.png",
    });

    runtime.setLayers([{
      id: "site-twin-surface",
      kind: "image",
      url: "/data/site_twin/terrain_surface.png",
      bounds: [
        [42.69418, -73.74198],
        [42.71418, -73.72198],
      ],
      opacity: 0.92,
    }]);

    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );

    runtime.destroy();
  });
});
