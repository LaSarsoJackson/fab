# Map Engine API

This directory contains FAB's repo-local map engine, but the contract is
written so it can also be consumed as a standalone API inside this repo.

Use [`standalone.js`](./standalone.js) as the standalone-oriented entry point.
It exports the runtime contract, runtime factory, adapters, and low-level
camera/projection helpers without pulling in FAB's React bridge or app manifest.

## Clean-Room Position

The engine is documented against public behavior from:

- [Leaflet 1.9 reference](https://leafletjs.com/reference.html)
- [Leaflet 2.0 reference](https://leafletjs.com/reference-2.0.0.html)

That means:

- public method names may intentionally resemble Leaflet where parity helps
- implementation notes should describe behavior and invariants, not copied internals
- FAB-specific UI wiring stays outside the standalone surface

## Public Modules

- [`standalone.js`](./standalone.js): standalone entry point
- [`contracts.js`](./contracts.js): runtime kinds, method lists, events, and spec normalizers
- [`factory.js`](./factory.js): `createMapRuntime(kind, options)` and runtime registry helpers
- [`customRuntime.js`](./customRuntime.js): canvas-backed runtime implementation
- [`leafletRuntime.js`](./leafletRuntime.js): Leaflet compatibility adapter
- [`backend.js`](./backend.js): build-time artifact and storage-strategy helpers
- [`camera.js`](./camera.js), [`projection.js`](./projection.js), [`clustering.js`](./clustering.js): reusable low-level engine primitives

## FAB-Only Modules

- [`manifest.js`](./manifest.js): app-level capability manifest
- [`CustomMapSurface.jsx`](./CustomMapSurface.jsx): FAB React bridge

## Generic Spec Families

Use `getMapRuntimeContract()` when you want one versioned descriptor that
includes:

- runtime kinds
- required and optional methods
- runtime events
- basemap types
- layer kinds
- source formats
- optimization-artifact roles

Current layer kinds:

- `geojson`: feature collections rendered by the runtime
- `image`: bounded raster overlays rendered directly into map coordinates
- `points`: point-entry collections with runtime clustering and hit testing

## Minimal Usage

```js
import {
  assertMapRuntimeContract,
  createMapRuntime,
  CUSTOM_MAP_RUNTIME_KIND,
} from "./standalone";

const runtime = createMapRuntime(CUSTOM_MAP_RUNTIME_KIND, {
  center: [42.70418, -73.73198],
  zoom: 14,
  minZoom: 13,
  maxZoom: 25,
});

runtime.mount(containerElement);
assertMapRuntimeContract(runtime);
runtime.setBasemap({
  id: "osm",
  type: "raster-xyz",
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
});
```

```js
import {
  createMapRuntime,
  LEAFLET_ADAPTER_RUNTIME_KIND,
} from "./standalone";

const runtime = createMapRuntime(LEAFLET_ADAPTER_RUNTIME_KIND, {
  leafletMap,
});
```

## Commenting Guidance

When adding comments in this directory:

- explain contract decisions, constraints, or behavioral edge cases
- reference public API expectations when needed
- avoid comments that depend on Leaflet private method names or source layout
