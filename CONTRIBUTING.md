# Contributing To `fab`

`fab` is the shared web surface for Albany Rural Cemetery burial search, map browsing, tours, routing, and deep links. It also feeds the hosted URLs consumed by `FABFG`, so changes here can affect both the web app and the native wrapper.

Current repo priorities:

- keep moving toward a FAB-owned custom map variant
- make the web and native stacks easier to align around shared contracts
- keep the UI closer to Apple HIG conventions: clear hierarchy, touch-first controls, restrained motion, and strong accessibility
- improve contributor DX so new maintainers can find the right files quickly

## Start Here

Read these before making structural changes:

1. [README.md](./README.md)
2. [AGENTS.md](./AGENTS.md)
3. [docs/architecture-index.md](./docs/architecture-index.md)

## Local Setup

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

Useful commands:

- `bun run test`: Bun tests plus Jest DOM tests
- `bun run test:e2e`: Playwright browser tests
- `bun run build:data`: regenerate search/tour/generated-bounds artifacts
- `bun run build:pmtiles`: regenerate PMTiles experiment artifacts
- `bun run deploy`: build and publish the GitHub Pages variant

## Placement Rules

- Keep React state, refs, and runtime orchestration in the top-level shells such as [`src/Map.jsx`](./src/Map.jsx) and [`src/BurialSidebar.jsx`](./src/BurialSidebar.jsx).
- Put pure transforms in the owning feature folder under [`src/features/`](./src/features).
- Put domain-neutral helpers in [`src/shared/`](./src/shared).
- Keep FAB-only behavior in [`src/features/fab/`](./src/features/fab).
- Do not add new helpers back under the retired `src/lib` layout.

## Source Vs Generated Files

Source-of-truth inputs:

- [`src/data/Geo_Burials.json`](./src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](./src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](./src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](./src/data/ARC_Boundary.json)
- tour files referenced by [`src/features/tours/tourDefinitions.js`](./src/features/tours/tourDefinitions.js)

Generated artifacts:

- [`src/data/TourBiographyAliases.json`](./src/data/TourBiographyAliases.json)
- [`src/data/TourMatches.json`](./src/data/TourMatches.json)
- [`public/data/Search_Burials.json`](./public/data/Search_Burials.json)
- [`src/features/map/generatedBounds.js`](./src/features/map/generatedBounds.js)

Regenerate derived outputs instead of editing them by hand:

```bash
bun run build:tour-data
bun run build:data
```

## Validation Checklists

If you change map or selection behavior:

1. Test search result click.
2. Test section polygon and section marker selection.
3. Test tour stop selection.
4. Test deep-link restoration.
5. Check desktop and mobile drawer behavior.

If you change source data:

1. Regenerate derived artifacts.
2. Verify search, section browse, and tour selection still resolve to the same record.

If you change runtime or profile wiring:

1. Verify feature flags in development and production behavior.
2. Run the automated tests for the touched modules.
3. Check whether `FABFG` needs a corresponding change.

If you change shared UI:

1. Verify keyboard focus, visible focus state, and mobile touch targets.
2. Honor reduced motion and safe areas.
3. Prefer labels and live regions over placeholder-only or color-only state.

## Pull Request Expectations

- Keep the change narrowly scoped and explain user-facing impact.
- Call out any effect on hosted URLs, deep links, or FABFG behavior.
- Mention regenerated artifacts explicitly when source data changed.
- Include the commands you ran.
- Prefer additive refactors over broad file moves unless the move is the task.
