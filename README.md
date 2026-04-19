# FAB

FAB is the web application behind the Albany Rural Cemetery burial finder. It
is a React app and installable PWA for:

- searching burial records
- browsing the cemetery map by section or tour
- opening directions for on-site navigation
- sharing direct links that restore selections and map views
- restoring shared URLs and deep links

This repository owns the shared web experience. The same hosted URLs are used
directly on the web and inside `FABFG`, the native wrapper app.

## Project layout

The broader product surface is split across three systems:

- `fab`: this repository, which owns the shared web app, data pipeline, map
  behavior, and deep-link handling
- `FABFG`: the native wrapper that loads hosted `fab` URLs in a native shell
- `albany.edu/arce`: the institutional production host for the promoted static
  build, along with some legacy content and image assets

Primary links:

- Source repository: [github.com/LaSarsoJackson/fab](https://github.com/LaSarsoJackson/fab)
- GitHub Pages deployment: [lasarsojackson.github.io/fab](https://lasarsojackson.github.io/fab/)
- Production site: [albany.edu/arce](https://www.albany.edu/arce/)
- Native wrapper repository: [github.com/LaSarsoJackson/FABFG](https://github.com/LaSarsoJackson/FABFG)
- iOS app: [Albany Grave Finder on the App Store](https://apps.apple.com/us/app/albany-grave-finder/id6746413050)

## Get started

### Requirements

- Node `>= 20` from [.nvmrc](./.nvmrc)
- Bun `>= 1.3`
- Python 3 for the local image server used in development

Optional tools:

- `geopandas`, `pyarrow`, and `shapely` for GeoParquet conversion and parity
  validation
- `tippecanoe` for PMTiles generation
- Docker for the optional local/offline Valhalla routing workflow

### Install

```bash
bun install
```

### Configure local environment

Create a local `.env` file when you need routing overrides or want to override
the default image origin:

```bash
REACT_APP_DEV_ROUTING_PROVIDER=api
REACT_APP_VALHALLA_API_URL=https://valhalla1.openstreetmap.de
REACT_APP_VALHALLA_PROXY_PATH=/__valhalla
REACT_APP_DEV_IMAGE_SERVER_ORIGIN=http://127.0.0.1:8000
```

Notes:

- Routing providers:
  `api` uses the hosted Valhalla HTTP API,
  `local` uses the bundled `src/data/ARC_Roads.json` road graph in-browser,
  `valhalla` uses the local dev proxy for an offline Valhalla instance.
- `REACT_APP_DEV_ROUTING_PROVIDER` is honored in development only. The default
  provider is `api`.
- `REACT_APP_ENABLE_CLIENT_SIDE_ROUTING=true` remains supported as a legacy
  alias for `REACT_APP_DEV_ROUTING_PROVIDER=local`.
- `REACT_APP_VALHALLA_API_URL` only affects the hosted `api` provider.
- `REACT_APP_VALHALLA_PROXY_PATH` defaults to `/__valhalla` and is used by the
  development proxy for local/offline Valhalla.
- The route destination is still snapped against the bundled cemetery road
  network before routing so the app continues to respect the project’s local
  road geometry even when the hosted or offline Valhalla provider is active.
- `bun run start` defaults `REACT_APP_DEV_IMAGE_SERVER_ORIGIN` to the local
  companion image server on `http://127.0.0.1:8000`.
- The static admin studio at `#/admin` is development-only for now. It opens
  when `REACT_APP_ENVIRONMENT` resolves to development and is hidden in
  production builds.

### Run the app

Start with the environment check:

```bash
bun run doctor
```

Then launch the development stack:

```bash
bun run start
```

This starts the React dev server, refreshes derived tour alias data, and serves
local images on `http://127.0.0.1:8000`.

Default local URL:

- [http://localhost:3000](http://localhost:3000)

Useful overrides:

- `FAB_SKIP_TOUR_DATA=1`: skip the alias refresh on restart
- `FAB_SKIP_IMAGE_SERVER=1`: skip the local image server
- `FAB_IMAGE_SERVER_PORT=9000`: run the image server on a different port
- `FAB_GEOSPATIAL_PYTHON=/path/to/python`: force a specific Python interpreter
  for geospatial tooling

## Common commands

- `bun run start`: start the development environment
- `bun run routing:offline:start`: start or create the local Valhalla container
- `bun run routing:offline:stop`: stop the local Valhalla container
- `bun run doctor`: check local prerequisites and optional tooling
- `bun run lint`: run the repository ESLint baseline across app, unit, and browser tests
- `bun run test`: run the default automated test suite
- `bun run check`: run `doctor`, `lint`, and the default test suite
- `bun run build`: create a production build
- `bun run deploy`: build and publish the GitHub Pages deployment
- `bun run build:tour-data`: regenerate tour biography aliases
- `bun run build:data`: regenerate search data, tour matches, and generated map
  bounds
- `bun run build:geoparquet`: convert the burial source JSON into GeoParquet
- `bun run validate:geoparquet`: verify GeoParquet parity with the JSON source
- `bun run build:pmtiles`: generate PMTiles experiment artifacts

Test split:

- `bun run test:bun`: module and data tests
- `bun run test:dom`: React DOM and component tests
- `bun run test:e2e`: Playwright browser coverage

## Data pipeline

Source-of-truth data lives in:

- [`src/data/Geo_Burials.json`](./src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](./src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](./src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](./src/data/ARC_Boundary.json)
- tour definitions referenced from [`src/features/tours/tourDefinitions.js`](./src/features/tours/tourDefinitions.js)

Generated artifacts live in:

- [`src/data/TourBiographyAliases.json`](./src/data/TourBiographyAliases.json)
- [`src/data/TourMatches.json`](./src/data/TourMatches.json)
- [`public/data/Search_Burials.json`](./public/data/Search_Burials.json)
- [`src/features/map/generatedBounds.js`](./src/features/map/generatedBounds.js)

If you change source data, regenerate derived outputs instead of editing them by
hand:

```bash
bun run build:tour-data
bun run build:data
```

When `src/data/Geo_Burials.parquet` exists, the build pipeline prefers it and
falls back to `src/data/Geo_Burials.json` if the GeoParquet toolchain is not
available.

## Architecture notes

Start with these documents:

- [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor workflow and validation
- [AGENTS.md](./AGENTS.md) for repo-specific automation and maintainer notes
- [docs/architecture-index.md](./docs/architecture-index.md) for a guide to the
  architecture notes
- [docs/map-engine-standalone-api.md](./docs/map-engine-standalone-api.md) for
  the clean-room standalone engine surface
- [docs/codebase-structure.md](./docs/codebase-structure.md) for directory
  ownership and placement rules

Common entry points:

- [`src/Map.jsx`](./src/Map.jsx): map orchestration, selections, overlays, and
  routing
- [`src/BurialSidebar.jsx`](./src/BurialSidebar.jsx): search, browse controls,
  selected record UI, and mobile drawer behavior
- [`src/AdminApp.jsx`](./src/AdminApp.jsx): static admin workspace
- [`src/features/browse/`](./src/features/browse): search indexing and browse
  result shaping
- [`src/features/tours/`](./src/features/tours): tour definitions, alias
  generation, and burial-tour reconciliation
- [`src/features/map/`](./src/features/map): popup models, selection helpers,
  viewport helpers, and runtime-specific map logic
- [`src/admin/`](./src/admin): file-backed admin modules, workbook import and
  export, and update bundles

## Deployment notes

There are two relevant hosted environments:

- GitHub Pages is the repo-controlled public validation target. Use
  `bun run deploy` to publish that version.
- `albany.edu/arce` is the institutional production deployment. Promotion to
  that host is still manual.

The app is served under `/fab` on GitHub Pages, so public asset URLs must honor
`process.env.PUBLIC_URL`. If a data fetch returns `<!DOCTYPE html>`, check the
requested path first.

Because `FABFG` consumes hosted `fab` URLs, any change to shared routing,
selection state, or deep links should be checked in both the web app and the
native wrapper.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) for
setup, validation expectations, and pull request guidance.
