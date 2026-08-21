# Contributing to `fab`

FAB is one web product consumed directly and through the `FABFG` native shell.
Changes to routes, selection, or hosted assets can affect both.

## Start here

1. [`README.md`](./README.md)
2. [`AGENTS.md`](./AGENTS.md)
3. [`docs/architecture-index.md`](./docs/architecture-index.md)

## Local workflow

```bash
bun install
bun run doctor
bun run start
```

Use these gates:

- `bun run lint`
- `bun run test`
- `bun run build`
- `bun run test:e2e`
- `bun run check` for the release-quality local gate

Focused branches target `main`. Do not add integration, staging, promotion, or
agent-specific branch layers.

## Ownership

- [`src/App.jsx`](./src/App.jsx): product route, selected record, and destination orchestration
- [`src/app/routes.js`](./src/app/routes.js): web/FABFG URL contract
- [`src/components/AppNavigation.jsx`](./src/components/AppNavigation.jsx): the three web destinations
- [`src/features/map/MapView.jsx`](./src/features/map/MapView.jsx): the only imperative MapLibre lifecycle boundary
- [`src/features/map/mapStyle.js`](./src/features/map/mapStyle.js): sources, layers, hierarchy, and attribution
- [`src/features/locator/`](./src/features/locator): worker search and burial delivery records
- [`src/features/tours/`](./src/features/tours): tour loading, matching, and derived metadata
- [`src/features/fab/`](./src/features/fab): Albany-specific record values, ARCE links, and tour definitions
- [`src/shared/`](./src/shared): domain-neutral helpers

Keep UI state out of `mapStyle.js`. Keep MapLibre calls out of record transforms.
Do not introduce a renderer abstraction while FAB has one renderer. Do not add
a UI framework for controls that semantic HTML and CSS already cover.

## Data rules

The canonical burial source is `src/data/Geo_Burials.json`. The browser never
imports that 31 MB file. `scripts/precalculate-metadata.js` produces the compact
runtime index at `public/data/Search_Burials.json`; the locator worker fetches,
prepares, and searches it off the main thread.

Boundary, road, and section GeoJSON are small enough to use directly in the
MapLibre style. Do not add shapefile conversion, GeoParquet, or PMTiles paths
without a measured runtime problem and a documented migration plan.

After source-data changes:

```bash
bun run build:data
bun run test
```

## Validation

Pure `.test.js` files run with Bun. Component `.test.jsx` files run with
Vitest/jsdom. User flows live under `e2e/` and run with Playwright.

Map or routing changes must cover:

1. Tours default route and tour selection.
2. Locator search and result selection.
3. One MapLibre instance with hillshade and visible attribution.
4. Close preserving a pin and Unpin clearing it.
5. Desktop navigation, mobile navigation, and `embed=fabfg` without duplicate tabs.
6. `record` and `tour` deep-link restoration.

Source-data changes must preserve record counts, coordinates, tour matching, and
generated-artifact shape.

## Pull requests and releases

Describe the user-visible result, any FABFG effect, generated artifacts, and the
commands run. Versions are SemVer values in `package.json`; tagged releases need
a matching `CHANGELOG.md` section. See [`docs/release-workflow.md`](./docs/release-workflow.md).
