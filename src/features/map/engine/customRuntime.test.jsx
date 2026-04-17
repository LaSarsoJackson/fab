/** @jest-environment jsdom */

import { CustomMapRuntime } from "./customRuntime";

const createCanvasContext = () => ({
  arc: jest.fn(),
  beginPath: jest.fn(),
  clearRect: jest.fn(),
  closePath: jest.fn(),
  fill: jest.fn(),
  fillText: jest.fn(),
  lineTo: jest.fn(),
  moveTo: jest.fn(),
  restore: jest.fn(),
  save: jest.fn(),
  stroke: jest.fn(),
});

describe("CustomMapRuntime", () => {
  let originalResizeObserver;
  let originalGetContext;

  beforeEach(() => {
    originalResizeObserver = global.ResizeObserver;
    originalGetContext = HTMLCanvasElement.prototype.getContext;

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
});
