# Map Architecture

This note exists to keep `src/Map.jsx` maintainable.

## Boundary

Treat [`src/Map.jsx`](../src/Map.jsx) as the orchestration layer. It should own:

- React state and memoized selectors
- Leaflet layer lifecycle and imperative refs
- cross-component event wiring
- viewport, routing, and selection side effects

It should not be the long-term home for pure formatting or dataset-reconciliation logic.
It is also not the source of truth for the engine contract. That lives under
[`src/features/map/engine/`](../src/features/map/engine), with `Map.jsx` acting
as the controller that drives a selected runtime.

## Supporting Modules

- [`docs/custom-map-engine.md`](./custom-map-engine.md): product-level definition of the custom engine boundary and ownership model
- [`docs/map-engine-api.md`](./map-engine-api.md): runtime and data-backend API contract for the engine
- [`docs/map-engine-geoparquet.md`](./map-engine-geoparquet.md): static data-format strategy, GeoParquet migration plan, and PMTiles relationship
- [`docs/codebase-structure.md`](./codebase-structure.md): repo ownership map and directory responsibilities
- [`docs/routing-architecture.md`](./routing-architecture.md): client route, shared-link, directions-link, and routing-provider URL ownership
- [`src/features/map/mapChrome.jsx`](../src/features/map/mapChrome.jsx): shared map controls, overlays, and debug chrome used by both runtimes
- [`src/features/map/mapDomain.js`](../src/features/map/mapDomain.js): the single home for pure map business rules such as selection-state actions/reduction, section grouping, location filtering, hover guards, and PMTiles glyph logic
- [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js): the single home for walking-route calculation, local road-graph routing, Valhalla response handling, and provider fallback behavior
- [`src/features/tours/tourDerivedData.js`](../src/features/tours/tourDerivedData.js): canonical biography/portrait inference for uneven tour datasets and the helpers used to generate alias metadata
- [`src/features/map/mapRecordPresentation.js`](../src/features/map/mapRecordPresentation.js): shared record cleanup, popup view-model generation, ARCE biography/image link normalization, and defensive date formatting
- [`src/features/tours/tourRecordHarmonization.js`](../src/features/tours/tourRecordHarmonization.js): burial/tour matching heuristics, search-result enrichment from tour metadata, and tour-stop normalization into the shared browse-result shape
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): record shaping used by both the sidebar and map
- [`src/features/map/popupViewport.js`](../src/features/map/popupViewport.js): geometry helpers that keep popups visible beside the sidebar
- [`docs/tour-popup-data.md`](./tour-popup-data.md): focused guide to the tour popup data flow, build guards, and change process

## Editing Guidelines

When adding new behavior:

1. Put pure record transforms in `src/features/*` or `src/shared/*`.
2. Keep `Map.jsx` focused on when those transforms run and how the map responds.
3. Prefer comments that explain a constraint or tradeoff, not comments that restate the next line.

Examples:

- Good fit for `Map.jsx`: "open the popup after `moveend` because Leaflet may discard it during animation"
- Good fit for `src/features/tours/tourDerivedData.js`: "recover a biography slug for a fixed-format mayor record using deterministic aliases"
- Good fit for `src/features/map/mapRecordPresentation.js`: "normalize biography links because the source data mixes bare slugs and full URLs"
- Bad fit for `Map.jsx`: another 100-line record formatting helper that never touches React or Leaflet

## High-Risk Areas

Changes in these areas should be tested together because the code paths converge on the same record model:

- search result selection
- section polygon selection
- section marker clustering
- tour stop selection
- deep-link selection
- popup rendering

If one of those flows changes, verify the others still land on the same selected record and popup behavior.
Search results, section burial markers, tour stops, direct marker clicks, popup
close, hover, and deep-link restoration should all update selected records
through the reducer/actions in `mapDomain.js`.
