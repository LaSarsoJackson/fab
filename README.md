# FAB

FAB is the shared Albany Grave Finder web app. It has three user destinations:

- Search Tours
- Cemetery Map
- Burial Locator

The web app owns the product, map, data delivery, and deep-link contract. `FABFG`
is a thin native shell around those hosted destinations; it must not recreate
the web app’s map or search state.

## Stack

- React 19
- Vite 8
- MapLibre GL JS 6
- plain semantic HTML and CSS
- a Web Worker for the 97,457-record burial index
- Bun tests, Vitest/jsdom component tests, and Playwright browser tests

There is one map renderer and one burial source path. The checked-in
`src/data/Geo_Burials.json` is the source of truth; `public/data/Search_Burials.json`
is its generated runtime delivery artifact. Map overlays use the checked-in
boundary, roads, and sections GeoJSON directly.

## Quickstart

Requirements:

- Node 22.12 or newer from [`.nvmrc`](./.nvmrc)
- Bun 1.3.8 from [`package.json`](./package.json)

```bash
bun install
bun run doctor
bun run start
```

Vite serves the app at [http://localhost:5173/fab/](http://localhost:5173/fab/).
No Python image server or geospatial Python environment is required.

## Commands

- `bun run start`: run the Vite development server
- `bun run lint`: run ESLint and the vendored anti-slop Oxlint rules
- `bun run test`: run Bun unit/data tests and Vitest component tests
- `bun run test:e2e`: run the Playwright product flows
- `bun run build`: generate tour aliases and build `dist/`
- `bun run build:data`: regenerate tour matches, the compact burial index, and map bounds
- `bun run check`: run the local release-quality gate
- `bun run release:check`: verify SemVer and changelog metadata

## Product routes and FABFG

The query string is the route contract:

| Destination | `view` value | Purpose |
| --- | --- | --- |
| Search Tours | `tours` | Find and open a curated tour |
| Cemetery Map | `map` | View the cemetery, tour stops, sections, and pinned graves |
| Burial Locator | `burials` | Search the generated burial index |

Additional parameters are `q`, `section`, `tour`, and `record`. Old packed
`share` links remain readable, but new links use the smaller `record` contract.

FABFG should load the same hosted app with `embed=fabfg` so the native shell
owns the tabs and the web app does not draw a duplicate navigation bar:

- `?view=tours&embed=fabfg`
- `?view=map&embed=fabfg`
- `?view=burials&embed=fabfg`

Its native tabs should use the same Search Tours, Cemetery Map, and Burial
Locator labels. The ARCE website is a separate external action; it is not the
Cemetery Map tab.

## Cartography

The map uses provider tiles instead of repository-built orthophoto exports:

- a restrained OpenStreetMap reference map
- Esri World Imagery as an optional imagery basemap
- Esri World Hillshade at low opacity
- local cemetery boundary and roads above the terrain context
- sections only after an explicit user choice

Provider attribution stays visible. The design follows figure-ground and visual
hierarchy guidance: the basemap recedes, cemetery structure reads next, and the
active burial or tour stop is dominant. See [`docs/cartography.md`](./docs/cartography.md).

## Data

Source-of-truth files:

- [`src/data/Geo_Burials.json`](./src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](./src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](./src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](./src/data/ARC_Boundary.json)
- tour datasets declared in [`src/features/fab/tours.js`](./src/features/fab/tours.js)

Generated files:

- [`public/data/Search_Burials.json`](./public/data/Search_Burials.json)
- [`src/data/TourMatches.json`](./src/data/TourMatches.json)
- [`src/data/TourBiographyAliases.json`](./src/data/TourBiographyAliases.json)
- [`src/features/map/generatedBounds.js`](./src/features/map/generatedBounds.js)

Run `bun run build:data` after source-data changes. Do not hand-edit generated files.

The old local ortho exports, GeoParquet copy, and PMTiles experiment are retired.
They have been removed from the repository and are not part of the runtime.

## Deployment

`main` is the only long-lived branch. CI installs with the frozen Bun lockfile,
runs lint/tests/build/browser checks, uploads `dist/`, and deploys GitHub Pages.
The app is served under `/fab`, so use `import.meta.env.BASE_URL` for public assets.

GitHub Pages is repository-controlled. Promotion to `albany.edu/arce` remains a
separate institutional operation. A green repository build does not prove that
host or the installed iPhone wrapper has been updated.

## Architecture

Start with:

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`docs/architecture-index.md`](./docs/architecture-index.md)
- [`docs/map-architecture.md`](./docs/map-architecture.md)
- [`docs/routing-architecture.md`](./docs/routing-architecture.md)
- [`docs/ui-principles.md`](./docs/ui-principles.md)
