# Map Engine API

This document defines the API surface that FAB owns.

Leaflet is not the source of truth for these interfaces. The internal contract
is the source of truth, and Leaflet is only a compatibility implementation of
that contract while the custom runtime and data backend keep expanding.

## API Layers

There are two related APIs:

1. Runtime API
   The browser-facing map runtime used by `Map.jsx`.
2. Data Backend API
   The build-time source/artifact contract used to turn source geospatial data
   into runtime payloads.

For the product-specific "what does FAB need this engine to do?" view, see
[`docs/map-engine-fab-spec.md`](./map-engine-fab-spec.md).

## Runtime API

Source: [`src/features/map/engine/contracts.js`](../src/features/map/engine/contracts.js)

Current version: `1`

Any runtime used by the app should expose at least these methods:

- `mount(container, options?)`
- `destroy()`
- `setCamera(cameraState)`
- `fitBounds(bounds, options?)`
- `setBasemap(basemapSpec)`
- `setLayers(layerSpecs)`
- `setSelection(selectionState)`
- `openPopup(popupSpec)`
- `closePopup()`
- `on(eventName, handler)`

The current runtimes also expose convenience methods that the orchestration
layer may use when available:

- `off(eventName, handler)`
- `once(eventName, handler)`
- `whenReady(callback)`
- `getContainer()`
- `getZoom()`
- `getCenter()`
- `distance(left, right)`
- `setView(center, zoom, options?)`
- `flyTo(center, zoom, options?)`
- `stop()`
- `getBounds()`
- `panInside(latLng, options?)`
- `addLayer(layer)`
- `removeLayer(layer)`
- `hasLayer(layer)`
- `removeControl(control)`
- `zoomIn()`
- `zoomOut()`

### Runtime Events

Supported runtime events today:

- `click`
- `hover`
- `movestart`
- `moveend`
- `zoomstart`
- `zoomend`
- `popupopen`
- `popupclose`
- `popupupdate`

### Runtime Descriptor

Runtimes identify themselves with:

- `__fabMapRuntime === true`
- `__runtimeKind`
- `__runtimeApiVersion`

Use [`getMapRuntimeDescriptor`](../src/features/map/engine/contracts.js) when
you need to inspect that shape without reaching into implementation details.

## Spec Objects

### BasemapSpec

Current fields:

- `id`
- `label`
- `type`
- `urlTemplate`
- `rasterFallbackUrlTemplate`
- `minZoom`
- `maxZoom`
- `tileSize`
- `attribution`

Supported basemap types today:

- `raster-xyz`
- `pmtiles-vector`

### LayerSpec

Current generic fields:

- `id`
- `kind`
- `interactive`

Current layer kinds:

- `geojson`
- `points`

Renderer-specific callbacks are allowed on top of that generic shape, but they
should stay inside the runtime/controller boundary instead of leaking into
unrelated product code.

### OverlaySourceSpec

Profile-level declaration for a map source:

- `id`
- `label`
- `type`
- `format`
- `sourceModuleId`
- `publicPath`
- `dataLayer`
- `geometryColumn`
- `featureNamespace`
- `buildCommand`
- `status`

This lives in [`APP_PROFILE.map.overlaySources`](../src/features/fab/profile.js).
It is the engine-facing registry for what data the renderer can load.

### OptimizationArtifactSpec

Profile-level declaration for a generated static artifact:

- `id`
- `label`
- `role`
- `format`
- `sourceModuleId`
- `publicPath`
- `filePath`
- `buildCommand`
- `status`
- `notes`

This lives in [`APP_PROFILE.map.optimizationArtifacts`](../src/features/fab/profile.js).
It is the build/backend registry for what static outputs exist or are planned.

### CameraState

- `center`
- `zoom`

### SelectionState

- `activeId`
- `ids`

### PopupSpec

- `id`
- `coordinates`
- `anchorOffset`
- `meta`

## Data Backend API

The data backend is intentionally build-time first. The user should not care
whether the source artifacts came from GeoJSON or GeoParquet as long as the app
receives the same generated runtime payloads.

Source: [`src/features/map/engine/backend.js`](../src/features/map/engine/backend.js)

Current version: `1`

### Canonical Backend Rules

1. The checked-in fallback source remains valid GeoJSON.
2. An optional GeoParquet file may replace GeoJSON as the preferred build-time source.
3. The user-facing runtime artifacts remain stable:
   `Search_Burials.json`, PMTiles overlays, tour matches, and generated bounds.
4. Migration must be invisible to the map UI and browse flows.

### Current Backend Entry Points

- [`src/features/map/engine/backend.js`](../src/features/map/engine/backend.js)
  Publishes backend descriptors, storage strategy, artifact lookup helpers, and preferred-source selection.
- [`scripts/precalculate-metadata.js`](../scripts/precalculate-metadata.js)
  Generates tour matches, search payloads, and static bounds.
- [`scripts/geospatial/load_burial_source.js`](../scripts/geospatial/load_burial_source.js)
  Prefers GeoParquet when present, falls back to GeoJSON otherwise.
- [`scripts/geospatial/validate_burial_source_parity.js`](../scripts/geospatial/validate_burial_source_parity.js)
  Verifies that GeoParquet remains a canonical 1:1 replacement for the GeoJSON burial source.
- [`scripts/migrations/geoparquet/generate_geoparquet.sh`](../scripts/migrations/geoparquet/generate_geoparquet.sh)
  Optional conversion from GeoJSON source to GeoParquet.
- [`scripts/migrations/pmtiles/generate_pmtiles.sh`](../scripts/migrations/pmtiles/generate_pmtiles.sh)
  Generates PMTiles and can materialize GeoJSON from GeoParquet first.

### Backend Storage Strategy

Current declared strategy in the FAB profile:

- source-of-truth fallback: `geojson`
- preferred build source: `geoparquet`
- preferred browser delivery: `pmtiles-vector`
- preferred search payload: `json`

## What "Replacing Leaflet" Means Here

Replacing Leaflet does not mean deleting the adapter immediately. It means:

- the app talks to the FAB runtime contract, not to Leaflet APIs
- the custom runtime owns the target rendering model
- the data backend owns the static artifact pipeline
- the Leaflet adapter can be removed when it is no longer the safest rollback path

That is the path that allows us to say the product runs on our own map engine
and our own data backend.
