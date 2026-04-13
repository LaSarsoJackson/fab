# FAB (`fab`)

`fab` is the main web application for the Albany Rural Cemetery burial-finder experience. It is a React app and installable PWA that provides:

- burial search
- map browsing by section and tour
- on-site navigation and directions
- deep links used by the hosted web app and the native wrapper

This repository is the core product surface. If the map, search, tours, routing, or shared UI are wrong, the fix usually starts here.

## Relationship To The Other Projects

There are three systems to keep straight:

1. `fab`
   This repo. It owns the shared web experience, data pipeline, map behavior, deep links, and PWA shell.
2. `FABFG`
   A separate native wrapper app that loads hosted `fab` URLs inside a native shell.
3. `albany.edu/arce`
   The institutional production host for the promoted static build, plus a source of some legacy content and image assets.

Primary links:

- Source repo: [github.com/LaSarsoJackson/fab](https://github.com/LaSarsoJackson/fab)
- GitHub Pages deploy: [lasarsojackson.github.io/fab](https://lasarsojackson.github.io/fab/)
- Production site: [albany.edu/arce](https://www.albany.edu/arce/)
- Native wrapper repo: [github.com/LaSarsoJackson/FABFG](https://github.com/LaSarsoJackson/FABFG)
- iOS app: [Albany Grave Finder on the App Store](https://apps.apple.com/us/app/albany-grave-finder/id6746413050)

How they fit together:

```mermaid
flowchart LR
  FAB["fab<br/>React app + PWA source"] --> GH["GitHub Pages<br/>repo-controlled hosted build"]
  FAB --> BUILD["build/<br/>static production artifact"]
  BUILD --> FTP["ARCE FTP upload<br/>manual promotion"]
  FTP --> PROD["albany.edu/arce<br/>production deployment"]
  GH --> FABFG["FABFG<br/>native wrapper repo"]
  PROD --> FABFG
  FABFG --> IOS["iOS app"]
```

Practical rule of thumb:

- Change `fab` for map/search/tour/deep-link/PWA work.
- Change `FABFG` for native tabs, packaging, or wrapper-level behavior.
- Change ARCE content separately when the issue is a legacy page, hosted image, or institutional content asset.

## Get Started

### Prerequisites

- Node `>= 20` from [.nvmrc](./.nvmrc)
- Bun `>= 1.3`
- Python 3 for the local image server used in development
- Optional GraphHopper API key if you need full routing behavior locally

### Install

Recommended:

```bash
bun install
```

Fallback:

```bash
npm install
```

### Configure Local Environment

Create a local `.env` file when you need routing or local portrait/image support:

```bash
REACT_APP_GRAPHHOPPER_API_KEY=your_key_here
REACT_APP_DEV_IMAGE_SERVER_ORIGIN=http://127.0.0.1:8000
```

Notes:

- Routing will be limited without `REACT_APP_GRAPHHOPPER_API_KEY`.
- `REACT_APP_DEV_IMAGE_SERVER_ORIGIN` is used for local image references in popups and detail views.

### Run The App

Recommended:

```bash
bun run start
```

Fallback:

```bash
npm run start
```

This starts:

- the React dev server
- the local image server on `http://127.0.0.1:8000`
- the app in development mode with `REACT_APP_ENVIRONMENT=development`

Default local URL:

- [http://localhost:3000](http://localhost:3000)

### Most Important Developer Commands

Regenerate derived data after changing source cemetery data:

```bash
bun run build:data
```

Run tests:

```bash
bun test
```

Create a production build:

```bash
bun run build
```

Deploy the GitHub Pages version:

```bash
bun run deploy
```

## How The Project Works

### Runtime Model

At runtime, `fab` is a client-side React app centered around [src/Map.jsx](./src/Map.jsx).

The main flows are:

- load a lightweight burial search index
- harmonize those burial records with precomputed tour matches
- lazily build the client-side search index
- render map overlays, section browsing, selected markers, and tours
- open directions and deep links from the same shared record model

Key point:

- marker clusters are the default and canonical rendering path for burial browsing
- PMTiles is not the default map mode, including in development
- PMTiles is only available as an explicit dev toggle from the in-app menu for experimentation and validation

### Data Pipeline

The app does not do its heaviest data work on every page load anymore.

Source-of-truth data lives in:

- `src/data/Geo_Burials.json`
- `src/data/ARC_Sections.json`
- `src/data/ARC_Roads.json`
- the tour definition modules referenced by `src/lib/tourDefinitions.js`

Generated artifacts live in:

- `public/data/Search_Burials.json`
- `src/data/TourMatches.json`
- `src/lib/constants.js`

`bun run build:data` runs [scripts/precalculate-metadata.js](./scripts/precalculate-metadata.js), which:

1. loads the burial source data
2. loads tour data
3. matches tour stops against burial records
4. writes the minified search index used by the client
5. writes static bounds/constants used by the app

If you change source cemetery data and do not regenerate these files, the app can behave inconsistently.

### Map Rendering Model

The map has a few distinct rendering paths:

- section polygons
- roads and cemetery boundary overlays
- selected/pinned burial markers
- section-level clustered burial markers when section browsing is active
- lazily loaded tour layers
- optional PMTiles experiment in development only

The intended behavior is:

- browsing a section uses the marker-cluster path
- selecting from search, section, or tour should resolve to the same burial record shape
- a selection should focus and behave the same regardless of where in the UI it started

If you change selection logic, validate all of these:

- search result click
- selected-person card click
- section polygon click
- section marker click
- tour stop click
- deep-link selection

### Tours

Tours are defined through [src/lib/tourDefinitions.js](./src/lib/tourDefinitions.js) and loaded lazily. The app:

- loads tour GeoJSON only when needed
- precomputes cross-links between burial records and tour records
- normalizes tour browse results into the same UI model used elsewhere

That means a tour stop and a burial record should feel like the same object from the UI’s point of view, even if they came from different datasets.

### Public Asset Paths

This app is deployed under `/fab` on GitHub Pages, so public assets must be loaded via `process.env.PUBLIC_URL` rather than raw `/data/...` absolute paths.

If you see JSON requests returning `<!DOCTYPE html>`, check whether a data file was accidentally fetched from the wrong base path.

## Repo Tour

Start here when you are orienting yourself:

- [src/Map.jsx](./src/Map.jsx): main app shell, map orchestration, selections, tours, routing, overlays
- [src/BurialSidebar.jsx](./src/BurialSidebar.jsx): search UI, browse controls, mobile drawer, selected/results panels
- [src/lib/burialSearch.js](./src/lib/burialSearch.js): indexing, normalization, search helpers
- [src/lib/browseResults.js](./src/lib/browseResults.js): shared UI result shaping
- [src/lib/tourMetadata.js](./src/lib/tourMetadata.js): harmonizing burial and tour metadata
- [src/lib/constants.js](./src/lib/constants.js): generated map bounds and related constants
- [src/data/](./src/data/): local GeoJSON and generated metadata used at build/runtime
- [public/data/Search_Burials.json](./public/data/Search_Burials.json): generated lightweight search payload
- [scripts/precalculate-metadata.js](./scripts/precalculate-metadata.js): data generation script
- [scripts/dev-start.sh](./scripts/dev-start.sh): development startup wrapper
- [scripts/build-production.sh](./scripts/build-production.sh): production build wrapper
- [scripts/deploy-production.sh](./scripts/deploy-production.sh): GitHub Pages deploy wrapper

## Development Workflow

### Common Change Types

If you change source data:

1. edit the relevant files in `src/data/`
2. run `bun run build:data`
3. test search, section browse, and tours

If you change map UI or selection behavior:

1. test desktop and mobile
2. test section browse and tour flows
3. test that selected markers and popups still match the clicked record

If you change anything under `public/` or public data fetching:

1. verify it still works under `localhost`
2. verify it still works under the `/fab` GitHub Pages base path

### Mobile Drawer Expectations

The mobile sidebar is a bottom drawer, not a desktop card squeezed onto a phone screen.

The intended model is:

- collapsed: minimal search shell
- peek: search plus browse controls
- full: selected people and results work area

If you touch `src/BurialSidebar.jsx` or related CSS, validate that the drawer still behaves like a drawer and not just a styled panel.

### Dev vs Production

Environment mode is driven by `REACT_APP_ENVIRONMENT`.

- `scripts/dev-start.sh` starts the app as `development`
- `scripts/build-production.sh` builds as `production`
- `scripts/deploy-production.sh` always deploys the production build

Production should not expose developer-only chrome. Development can show lightweight dev context where it helps.

## Deployment

The deployment flow is intentionally split into two environments.

### 1. GitHub Pages

Use this for repo-controlled public validation:

```bash
bun run deploy
```

This runs the production build and publishes `build/` to GitHub Pages.

### 2. ARCE Production

This repo does not currently automate the institutional production publish.

Current flow:

1. build and validate the release candidate
2. publish to GitHub Pages for validation
3. promote the approved static build from `build/`
4. upload the static files to the ARCE FTP host

Important:

- GitHub Pages is the easiest public validation target
- ARCE is the real production deployment
- a change here can affect both the hosted web app and the native wrapper app

## Deep Links And Wrapper Integration

The native wrapper and shared URLs depend on query-driven state in `fab`.

Important patterns include:

- `?view=burials`
- `?view=tours`
- `?section=<value>`
- `?tour=<name fragment>`
- `?q=<search text>`

If you change deep-link handling, verify whether `FABFG` needs a corresponding update.

## Troubleshooting

### Burial data fails to load and JSON parsing complains about HTML

Usually means a public asset path is wrong for the current host base path. Check any `fetch()` or static asset URL that starts with `/`.

### Tours or search results do not match the right burial record

Regenerate derived data with:

```bash
bun run build:data
```

Then retest the selection flow from:

- search
- section browse
- tours
- deep links

### A change works on the web but not in the iOS app

Decide whether the problem is:

- the shared hosted experience in `fab`
- the native shell behavior in `FABFG`
- an external ARCE-hosted content dependency

## Additional Context

See [docs/arce-content-upgrade-plan.md](./docs/arce-content-upgrade-plan.md) for broader migration and cross-project notes involving:

- the legacy ARCE web presence
- `fab`
- `FABFG`
