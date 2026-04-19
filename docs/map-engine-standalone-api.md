# Map Engine Standalone API

Use this note when you want the engine surface itself, not FAB-specific
orchestration in `src/Map.jsx`.

## Goal

The engine should be usable in two ways:

1. as FAB's internal runtime contract
2. as a repo-local standalone API that another app surface could import

The standalone-oriented entry point is:

- [`src/features/map/engine/standalone.js`](../src/features/map/engine/standalone.js)

That entry point excludes FAB-only modules such as:

- [`src/features/map/engine/CustomMapSurface.jsx`](../src/features/map/engine/CustomMapSurface.jsx)
- [`src/features/map/engine/manifest.js`](../src/features/map/engine/manifest.js)

## Clean-Room Documentation Policy

This engine should be specified from public behavior, not copied upstream
internals.

Public references used for behavioral alignment:

- [Leaflet 1.9 reference](https://leafletjs.com/reference.html)
- [Leaflet 2.0 reference](https://leafletjs.com/reference-2.0.0.html)

Practical rules:

- prefer stable public method names when they improve compatibility
- document semantics in engine-owned terms
- do not treat Leaflet private methods or source filenames as normative API
- keep FAB-specific layout, profile, and content rules in FAB docs instead

## Public Surface

Source of truth:

- [`src/features/map/engine/contracts.js`](../src/features/map/engine/contracts.js)
- [`src/features/map/engine/factory.js`](../src/features/map/engine/factory.js)

Runtime kinds:

- `custom`
- `leaflet-adapter`

Required runtime methods:

- `mount`
- `destroy`
- `setCamera`
- `fitBounds`
- `setBasemap`
- `setLayers`
- `setSelection`
- `openPopup`
- `closePopup`
- `on`

Optional compatibility methods:

- `off`
- `once`
- `whenReady`
- `getContainer`
- `getZoom`
- `getCenter`
- `distance`
- `setView`
- `flyTo`
- `stop`
- `getBounds`
- `panInside`
- `setMaxBounds`
- `setMinZoom`
- `setMaxZoom`
- `invalidateSize`
- `addLayer`
- `removeLayer`
- `hasLayer`
- `removeControl`
- `zoomIn`
- `zoomOut`

Supported runtime events:

- `click`
- `hover`
- `movestart`
- `moveend`
- `zoomstart`
- `zoomend`
- `popupopen`
- `popupclose`
- `popupupdate`

Generic spec families exported by the contract descriptor:

- basemap types: `raster-xyz`, `pmtiles-vector`
- layer kinds: `geojson`, `image`, `points`
- source formats: `geojson`, `json`, `pmtiles-vector`, `geoparquet`
- optimization artifact roles:
  `source-of-truth`, `search-index`, `delivery-overlay`, `columnar-canonical`

`getMapRuntimeContract()` returns those families alongside the method and event
lists, so external callers can inspect one versioned descriptor instead of
assembling individual constants by hand.

## Leaflet Crosswalk

This is a clean-room behavior crosswalk, not a copy of Leaflet implementation.

| Leaflet public concept | Engine contract | Notes |
| --- | --- | --- |
| `setView(center, zoom, options)` | `setView(center, zoom, options)` | shared naming for immediate or animated camera updates |
| `flyTo(center, zoom, options)` | `flyTo(center, zoom, options)` | animation-friendly camera move |
| `fitBounds(bounds, options)` | `fitBounds(bounds, options)` | padded bounds solving belongs in the runtime |
| `panInside(latlng, options)` | `panInside(latLng, options)` | keep selected content inside a constrained viewport |
| `setMaxBounds(bounds)` | `setMaxBounds(bounds)` | runtime-level camera constraint, not app glue |
| `setMinZoom(zoom)` / `setMaxZoom(zoom)` | `setMinZoom(zoom)` / `setMaxZoom(zoom)` | zoom constraints remain part of the runtime surface |
| `invalidateSize(options)` | `invalidateSize()` | remeasure and redraw runtime surface after host-size changes |
| popup open/close behavior | `openPopup(popupSpec)` / `closePopup()` | popup state is runtime-owned even when rendered differently |
| map event subscription | `on`, `off`, `once` | event names are engine-owned but intentionally familiar |

## Layer Semantics

`LayerSpec` stays intentionally small at the generic level:

- `id`
- `kind`
- `interactive`

Current layer-kind expectations:

- `geojson`: render GeoJSON features, usually with runtime-owned style and pick callbacks
- `image`: render one raster image into explicit southwest/northeast bounds
- `points`: render point collections with runtime-owned hit testing and clustering

The standalone contract does not freeze every renderer-specific option. It
defines the stable layer categories that app code can reason about without
depending on a specific provider implementation.

## Package-Like Usage

Custom runtime:

```js
import {
  createMapRuntime,
  CUSTOM_MAP_RUNTIME_KIND,
} from "../src/features/map/engine/standalone";

const runtime = createMapRuntime(CUSTOM_MAP_RUNTIME_KIND, {
  center: [42.70418, -73.73198],
  zoom: 14,
});
```

Leaflet adapter:

```js
import {
  createMapRuntime,
  LEAFLET_ADAPTER_RUNTIME_KIND,
} from "../src/features/map/engine/standalone";

const runtime = createMapRuntime(LEAFLET_ADAPTER_RUNTIME_KIND, {
  leafletMap,
});
```

Contract inspection:

```js
import {
  assertMapRuntimeContract,
  getMapRuntimeContract,
  listMissingMapRuntimeMethods,
} from "../src/features/map/engine/standalone";

const contract = getMapRuntimeContract();
assertMapRuntimeContract(runtime, { label: "runtime" });
const missing = listMissingMapRuntimeMethods(runtime);
```

## What Stays Out Of The Standalone API

These remain app integration concerns:

- FAB profile basemap/overlay declarations
- FAB popup card content and sidebar coordination
- Valhalla service wiring
- browser geolocation permission UX
- admin editing tools

Those can consume the engine, but they should not define the standalone engine
surface.
