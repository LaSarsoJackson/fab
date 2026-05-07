# Codebase Structure

This repo was getting hard to navigate because most of the non-UI logic lived in
one flat helper directory. The current structure groups helpers by product area
so there is a clearer answer to "where should this change go?"

## Primary Entry Points

- [`src/Map.jsx`](../src/Map.jsx): runtime map shell and Leaflet orchestration
- [`src/BurialSidebar.jsx`](../src/BurialSidebar.jsx): search, browse, and selection UI

## Feature Folders

- [`src/features/browse/`](../src/features/browse): search indexing, browse result shaping, and shared record labels
- [`src/features/tours/`](../src/features/tours): tour definitions, alias recovery, tour styles, and burial-tour reconciliation
- [`src/features/map/`](../src/features/map): popup view-models, a single `mapDomain.js` module for pure map rules, viewport intent, popup geometry, and selection-state reduction, a single `mapRouting.js` module for bundled-road walking-route calculation, map chrome, and generated bounds
- [`src/features/fieldPackets.js`](../src/features/fieldPackets.js): field-packet/shared-link encoding, parsing, and presentation state

## Shared Helpers

- [`src/shared/geoJsonBounds.js`](../src/shared/geoJsonBounds.js): generic GeoJSON bounds and validation helpers
- [`src/shared/routing.js`](../src/shared/routing.js): routing query keys and external Apple Maps / Google Maps directions links
- [`src/shared/runtimeEnv.js`](../src/shared/runtimeEnv.js): runtime environment helpers, centralized runtime-flag definitions, asset URL helpers, document metadata sync, idle scheduling, and real environment-dependent toggles

## Profile Layer

- [`src/features/fab/profile.js`](../src/features/fab/profile.js): single source of truth for FAB app configuration, hosted URLs, shell copy, data modules, record presentation callbacks, map metadata, and feature registrations
- [`src/features/fab/`](../src/features/fab): FAB-specific branding, tours, and presentation behavior

## Data And Build Outputs

- [`src/data/`](../src/data/): source GeoJSON, tours, images, and generated lookup JSON checked into the repo
- [`public/data/`](../public/data/): lightweight runtime payloads served by the app
- [`scripts/`](../scripts): build-time generators, migration helpers, and deployment wrappers

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
- Import directly from the module that owns the behavior; avoid adding
  `index.js` barrels that only re-export neighboring files.
- Keep FAB-only behavior in `src/features/fab/` or behind profile callbacks instead of adding new hardcoded app branches.
- Do not add new helpers back under the old flat `src/lib` layout.
