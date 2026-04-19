# Contributing to `fab`

`fab` is the shared web application for Albany Rural Cemetery burial search,
map browsing, tours, routing, and deep links. Changes here can affect both the
public web app and `FABFG`, the native wrapper that consumes hosted `fab` URLs.

## Read first

Start with these documents:

1. [README.md](./README.md)
2. [AGENTS.md](./AGENTS.md)
3. [docs/architecture-index.md](./docs/architecture-index.md)

If you are changing a specific subsystem, follow the relevant note from the
architecture index before you start moving files around.

## Local development

Install dependencies:

```bash
bun install
```

Check local prerequisites:

```bash
bun run doctor
```

Start the app:

```bash
bun run start
```

Common commands:

- `bun run test`: run the default automated test suite
- `bun run test:e2e`: run Playwright coverage
- `bun run check`: run `doctor` plus the default test suite
- `bun run build:data`: regenerate search data, tour matches, and generated
  bounds
- `bun run build:pmtiles`: regenerate PMTiles experiment artifacts
- `bun run deploy`: build and publish the GitHub Pages deployment

## Placement rules

- Keep React state, refs, and runtime orchestration in the top-level shells such
  as [`src/Map.jsx`](./src/Map.jsx) and [`src/BurialSidebar.jsx`](./src/BurialSidebar.jsx).
- Put pure transforms in the owning feature folder under [`src/features/`](./src/features).
- Put domain-neutral helpers in [`src/shared/`](./src/shared).
- Keep FAB-only behavior in [`src/features/fab/`](./src/features/fab).
- Do not add new helpers back under the retired `src/lib` layout.

## Source and generated files

Treat these as source-of-truth inputs:

- [`src/data/Geo_Burials.json`](./src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](./src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](./src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](./src/data/ARC_Boundary.json)
- tour files referenced by [`src/features/tours/tourDefinitions.js`](./src/features/tours/tourDefinitions.js)

Treat these as generated artifacts:

- [`src/data/TourBiographyAliases.json`](./src/data/TourBiographyAliases.json)
- [`src/data/TourMatches.json`](./src/data/TourMatches.json)
- [`public/data/Search_Burials.json`](./public/data/Search_Burials.json)
- [`src/features/map/generatedBounds.js`](./src/features/map/generatedBounds.js)

Regenerate derived outputs instead of editing them by hand:

```bash
bun run build:tour-data
bun run build:data
```

## Validation

If you change map or selection behavior:

1. Test search result click.
2. Test section polygon and section marker selection.
3. Test tour stop selection.
4. Test deep-link restoration.
5. Check desktop and mobile drawer behavior.

If you change source data:

1. Regenerate derived artifacts.
2. Verify search, section browse, and tour selection still resolve to the same
   record.

If you change runtime or profile wiring:

1. Verify feature flags in both development and production behavior.
2. Run the automated tests for the touched modules.
3. Check whether `FABFG` needs a corresponding change.

If you change shared UI:

1. Verify keyboard focus, visible focus state, and mobile touch targets.
2. Honor reduced motion and safe areas.
3. Prefer labels and live regions over placeholder-only or color-only state.

## Pull requests

- Keep changes narrowly scoped and describe the user-facing impact.
- Call out any effect on hosted URLs, deep links, or `FABFG` behavior.
- Mention regenerated artifacts when source data changed.
- List the commands you ran.
- Prefer additive refactors over broad moves unless the move is the work.
