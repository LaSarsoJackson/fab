# AGENTS.md

This file is the fast orientation guide for automated maintainers working in
`fab`.

## Read This First

1. [`README.md`](./README.md) for the product/runtime overview and core commands
2. [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, validation, and review expectations
3. [`docs/architecture-index.md`](./docs/architecture-index.md) for the shortest path to the right architecture note

Then read only the task-specific note you need:

- [`docs/codebase-structure.md`](./docs/codebase-structure.md) for directory ownership
- [`docs/map-architecture.md`](./docs/map-architecture.md) before touching `src/Map.jsx`
- [`docs/app-profile-architecture.md`](./docs/app-profile-architecture.md) before changing FAB-only app configuration
- [`docs/dev-branch-workflow.md`](./docs/dev-branch-workflow.md) before changing development-only surfaces
- [`docs/ui-principles.md`](./docs/ui-principles.md) before changing shared UI patterns
- [`docs/unified-stack-roadmap.md`](./docs/unified-stack-roadmap.md) when planning work that affects FABFG or the shared stack

## Repo Rules Of Thumb

- Keep React state, refs, and Leaflet lifecycle work in [`src/Map.jsx`](./src/Map.jsx) and the top-level app shells.
- Put pure record transforms in the owning feature folder under [`src/features/`](./src/features).
- Put domain-neutral helpers in [`src/shared/`](./src/shared).
- Keep FAB-only branding, hosted URLs, presentation callbacks, and profile wiring in [`src/features/fab/profile.js`](./src/features/fab/profile.js) and tour definitions in [`src/features/fab/tours.js`](./src/features/fab/tours.js).
- Import from the owning module directly; do not add barrel `index.js` files
  that only re-export nearby helpers.
- Do not add new helpers back into the retired flat `src/lib` layout.

## High-Value Entry Points

- [`src/Map.jsx`](./src/Map.jsx): map orchestration, selections, routing, overlays
- [`src/BurialSidebar.jsx`](./src/BurialSidebar.jsx): search, browse, selected-record UI, mobile drawer
- [`src/features/browse/`](./src/features/browse): search indexing and browse-result shaping
- [`src/features/tours/`](./src/features/tours): tour definitions, alias generation, burial-tour reconciliation
- [`src/features/map/`](./src/features/map): popup presentation, viewport helpers, selection reducer/actions

## Source Vs Generated Files

Treat these as source-of-truth inputs:

- [`src/data/Geo_Burials.json`](./src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](./src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](./src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](./src/data/ARC_Boundary.json)
- tour definitions and datasets in [`src/features/fab/tours.js`](./src/features/fab/tours.js)

Treat these as generated artifacts:

- [`src/data/TourBiographyAliases.json`](./src/data/TourBiographyAliases.json)
- [`src/data/TourMatches.json`](./src/data/TourMatches.json)
- [`public/data/Search_Burials.json`](./public/data/Search_Burials.json)
- [`src/features/map/generatedBounds.js`](./src/features/map/generatedBounds.js)

When source data changes, regenerate artifacts instead of hand-editing them:

```bash
bun run build:tour-data
bun run build:data
```

## Validation Expectations

If you change source data:

1. Regenerate derived artifacts.
2. Verify search, section browse, and tour selection still resolve to the same record.

If you change map or selection behavior:

1. Test search result click.
2. Test section polygon and section marker selection.
3. Test tour stop selection.
4. Test deep-link restoration.
5. Check both desktop and mobile drawer behavior.

If you change runtime/profile wiring:

1. Verify runtime toggles and environment-specific behavior still behave in development and production.
2. Run the automated tests that cover the touched modules.

## Commands

- `bun run doctor`: local prerequisite and env check
- `bun run start`: dev startup wrapper, alias refresh, image server, React dev server
- `bun run test`: Bun unit tests plus Jest DOM tests
- `bun run check`: doctor plus the default automated test suite
- `bun run deploy`: production build plus GitHub Pages publish

## Contributor Priorities

- Keep moves additive when possible. The worktree may contain in-flight architecture cleanup already.
- Keep development-only surfaces on `dev-features` unless they are being promoted into the shipped app.
- Treat FABFG alignment as shared-contract work first and wrapper-specific work second.
- Favor clearer Apple-HIG-inspired interaction patterns over decorative UI churn: safer spacing, fewer gestures, stronger hierarchy, and obvious states.

## Known Constraints

- GitHub Pages serves the app under `/fab`, so public asset URLs must respect `process.env.PUBLIC_URL`.
- The native wrapper app (`FABFG`) consumes hosted `fab` URLs, so deep-link changes can affect both web and native flows.
- The worktree may contain in-flight refactors. Prefer additive changes and avoid broad moves unless the task requires them.
