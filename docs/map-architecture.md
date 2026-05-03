# Map Architecture

This note exists to keep `src/Map.jsx` maintainable.

## Boundary

Treat [`src/Map.jsx`](../src/Map.jsx) as the orchestration layer. It should own:

- React state and memoized selectors
- Leaflet layer lifecycle and imperative refs
- cross-component event wiring
- viewport, routing, and selection side effects

It should not be the long-term home for pure formatting or dataset-reconciliation logic.
Development-only map experiments live on `dev-features`; `master` should keep a
single production map path unless an experiment is being promoted.

## Supporting Modules

- [`docs/codebase-structure.md`](./codebase-structure.md): repo ownership map and directory responsibilities
- [`docs/routing-architecture.md`](./routing-architecture.md): client route, shared-link, in-app road routing, and directions-link ownership
- [`src/features/map/mapChrome.jsx`](../src/features/map/mapChrome.jsx): production Leaflet map controls, overlays, and route-status chrome
- [`src/features/map/mapDomain.js`](../src/features/map/mapDomain.js): the single home for pure map business rules such as selection-state actions/reduction, section grouping, location filtering, hover guards, viewport-intent control, and popup viewport geometry
- [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js): the single home for walking-route calculation and local road-graph routing
- [`src/features/tours/tourDerivedData.js`](../src/features/tours/tourDerivedData.js): canonical biography/portrait inference for uneven tour datasets and the helpers used to generate alias metadata
- [`src/features/map/mapRecordPresentation.js`](../src/features/map/mapRecordPresentation.js): shared record cleanup, popup view-model generation, ARCE biography/image link normalization, and defensive date formatting
- [`src/features/tours/tourRecordHarmonization.js`](../src/features/tours/tourRecordHarmonization.js): burial/tour matching heuristics, search-result enrichment from tour metadata, and tour-stop normalization into the shared browse-result shape
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): record shaping used by both the sidebar and map
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
