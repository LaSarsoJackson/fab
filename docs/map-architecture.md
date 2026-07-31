# Map architecture

This note exists to keep `src/Map.jsx` maintainable.

## Boundary

Treat [`src/Map.jsx`](../src/Map.jsx) as the orchestration layer. It must own:

- React state and memoized selectors
- Leaflet layer lifecycle and imperative refs
- cross-component event wiring
- viewport, routing, and selection side effects

Do not put pure formatting or data-reconciliation logic in this file.
Development-only map experiments live on short-lived work branches. Keep one
production map path on `main` unless you promote an experiment.

## Supporting modules

- [`docs/codebase-structure.md`](./codebase-structure.md): repo ownership map and directory responsibilities
- [`docs/routing-architecture.md`](./routing-architecture.md): client route, shared-link, in-app road routing, and directions-link ownership
- [`src/features/map/mapChrome.jsx`](../src/features/map/mapChrome.jsx): production Leaflet map controls, overlays, section-marker adapters, and route-status chrome
- [`src/features/map/mapMarkerIcons.js`](../src/features/map/mapMarkerIcons.js): cached Leaflet div icons for selected records, burial clusters, section clusters, and section affordance markers
- [`src/features/map/mapDomain.js`](../src/features/map/mapDomain.js): owner of
  pure map business rules. These rules include selection, section grouping,
  location filters, hover guards, viewport intent, and popup geometry.
- [`src/features/map/mapNavigationDestination.js`](../src/features/map/mapNavigationDestination.js): saved navigation-destination record shaping and localStorage persistence
- [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js): the single home for walking-route calculation and local road-graph routing
- [`src/features/tours/tourDerivedData.js`](../src/features/tours/tourDerivedData.js): canonical biography/portrait inference for uneven tour datasets and the helpers used to generate alias metadata
- [`src/features/map/mapRecordPresentation.js`](../src/features/map/mapRecordPresentation.js): shared record cleanup, popup view-model generation, ARCE biography/image link normalization, and defensive date formatting
- [`src/features/tours/tourRecordHarmonization.js`](../src/features/tours/tourRecordHarmonization.js): burial/tour matching heuristics, search-result enrichment from tour metadata, and tour-stop normalization into the shared browse-result shape
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): record shaping used by both the sidebar and map
- [`docs/tour-popup-data.md`](./tour-popup-data.md): focused guide to the tour popup data flow, build guards, and change process

## Editing guidelines

When adding new behavior:

1. Put pure record transforms in `src/features/*` or `src/shared/*`.
2. Keep `Map.jsx` focused on when those transforms run and how the map responds.
3. Prefer comments that explain a constraint or tradeoff, not comments that restate the next line.

Examples:

- Good fit for `Map.jsx`: `Open the popup after moveend because Leaflet can discard it during animation.`
- Good fit for `src/features/tours/tourDerivedData.js`: `Use deterministic aliases to recover the biography slug.`
- Good fit for `src/features/map/mapRecordPresentation.js`: `Normalize biography links because the source data has slugs and full URLs.`
- Bad fit for `Map.jsx`: another 100-line record formatting helper that never touches React or Leaflet

## High-risk areas

Test changes in these areas together. The code paths use the same record model:

- search result selection
- section polygon selection
- section marker clustering
- tour stop selection
- deep-link selection
- popup rendering

If one flow changes, verify that the other flows select the same record and
popup behavior.
Search results, section burial markers, tour stops, direct marker clicks, popup
close, hover, and deep-link restoration must update selected records
through the reducer/actions in `mapDomain.js`.
