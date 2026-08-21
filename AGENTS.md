# AGENTS.md

Fast orientation for automated maintainers working in `fab`.

## Read first

1. [`README.md`](./README.md)
2. [`CONTRIBUTING.md`](./CONTRIBUTING.md)
3. [`docs/architecture-index.md`](./docs/architecture-index.md)

Read the task-specific note before changing map, routing, UI, data, or release behavior.

## Product contract

FAB has three destinations: Search Tours, Cemetery Map, and Burial Locator. The
ARCE website is an external action. Tours is the default web route.

`FABFG` is a native shell over hosted FAB routes. Its WebViews should use
`embed=fabfg`, which hides web navigation so there is one visible tab owner.

## Code ownership

- `src/App.jsx`: destination and selected-record orchestration
- `src/app/routes.js`: route and FABFG URL contract
- `src/features/map/MapView.jsx`: MapLibre lifecycle only
- `src/features/map/mapStyle.js`: map sources, layers, cartography, and attribution
- `src/features/locator/`: burial worker/search/result delivery
- `src/features/tours/`: tour runtime and matching
- `src/features/fab/`: Albany-specific configuration
- `src/shared/`: domain-neutral helpers

Use the owning module directly. Do not add barrel files, renderer adapters, UI
frameworks, or duplicate state registries without a demonstrated need.

## Data

Source of truth:

- `src/data/Geo_Burials.json`
- `src/data/ARC_Sections.json`
- `src/data/ARC_Roads.json`
- `src/data/ARC_Boundary.json`
- tour files declared in `src/features/fab/tours.js`

Generated:

- `public/data/Search_Burials.json`
- `src/data/TourMatches.json`
- `src/data/TourBiographyAliases.json`
- `src/features/map/generatedBounds.js`

Run `bun run build:data` after source-data changes. Do not add shapefile,
GeoParquet, PMTiles, or local ortho pipelines without measured evidence.

## Validation

- `bun run doctor`
- `bun run lint`
- `bun run test`
- `bun run build`
- `bun run test:e2e` for rendered product flows

Map changes must verify Tours, Locator search, tour selection, record deep links,
section selection, desktop/mobile navigation, and the FABFG embedded boundary.
Installed-iPhone acceptance remains separate from browser automation.

## Delivery

`main` is the only long-lived branch. Focused PRs target `main`; a green merge
deploys `dist/` to GitHub Pages. Do not create staging or promotion branches.
GitHub publishing or human-directed comments require explicit user authorization.
