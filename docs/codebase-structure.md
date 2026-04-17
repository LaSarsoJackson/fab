# Codebase Structure

This repo was getting hard to navigate because most of the non-UI logic lived in
one flat helper directory. The current structure groups helpers by product area
so there is a clearer answer to "where should this change go?"

## Primary Entry Points

- [`src/Map.jsx`](../src/Map.jsx): runtime map shell and Leaflet orchestration
- [`src/BurialSidebar.jsx`](../src/BurialSidebar.jsx): search, browse, and selection UI
- [`src/AdminApp.jsx`](../src/AdminApp.jsx): static admin workspace for source data edits

## Feature Folders

- [`src/features/browse/`](../src/features/browse): search indexing, browse result shaping, and shared record labels
- [`src/features/tours/`](../src/features/tours): tour definitions, alias recovery, tour styles, and burial-tour reconciliation
- [`src/features/map/`](../src/features/map): popup view-models, selection helpers, viewport helpers, generated bounds, and the custom engine runtime contract under `engine/`
- [`src/features/deeplinks/`](../src/features/deeplinks): field packet encoding and URL/deep-link state
- [`src/features/navigation/`](../src/features/navigation): external directions/navigation URL building

## Shared Helpers

- [`src/shared/geo/`](../src/shared/geo): generic GeoJSON bounds and validation helpers
- [`src/shared/runtime/`](../src/shared/runtime): runtime environment and feature-flag helpers

## Admin And Profile Layers

- [`src/admin/`](../src/admin): file-backed data modules, workbook import/export, and update-bundle packaging
- [`src/config/appProfile.js`](../src/config/appProfile.js): active profile selection and shared registries
- [`src/features/fab/`](../src/features/fab): FAB-specific branding, tours, and presentation behavior

## Data And Build Outputs

- [`src/data/`](../src/data/): source GeoJSON, tours, images, and generated lookup JSON checked into the repo
- [`public/data/`](../public/data/): lightweight runtime payloads served by the app
- [`scripts/`](../scripts): build-time generators, geospatial source loaders, migration helpers, and deployment wrappers

Generated artifacts that should usually be regenerated instead of hand-edited:

- [`src/data/TourBiographyAliases.json`](../src/data/TourBiographyAliases.json)
- [`src/data/TourMatches.json`](../src/data/TourMatches.json)
- [`public/data/Search_Burials.json`](../public/data/Search_Burials.json)
- [`src/features/map/generatedBounds.js`](../src/features/map/generatedBounds.js)

## Placement Rule Of Thumb

- Put React state, refs, and map lifecycles in the top-level app components.
- Put pure record transforms in the feature folder that owns that data shape.
- Put cross-cutting, domain-neutral helpers in `src/shared/`.
- Put generated artifacts beside the feature that consumes them.
- Keep FAB-only behavior in `src/features/fab/` or behind profile callbacks instead of adding new hardcoded app branches.
- Do not add new helpers back under the old flat `src/lib` layout.
