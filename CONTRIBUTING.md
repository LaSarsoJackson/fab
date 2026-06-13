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
For broad cleanup, comment work, or ownership consolidation, start with
[docs/maintainability-playbook.md](./docs/maintainability-playbook.md).

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

- `bun run lint`: run the repository ESLint baseline
- `bun run test`: run the default automated test suite; use this as the
  standard local test command for ordinary changes
- `bun run check`: run `doctor`, `lint`, release metadata validation, and the
  default test suite
- `bun run release:check`: verify SemVer, changelog, and release tag metadata
- `bun run pr:check`: verify pull request branch policy when GitHub provides PR context
- `bun run build:data`: regenerate search data, tour matches, and generated
  bounds
- `bun run deploy`: create a local production build; GitHub Actions deploys
  `main`

Development work starts on short-lived branches and enters the shared pipeline
through `dev`; see [docs/dev-branch-workflow.md](./docs/dev-branch-workflow.md).

## Branches and releases

Use short-lived work branches for product changes. Open those branches into
`dev`; after `dev` CI passes, GitHub Actions opens or updates a `dev` ->
`staging` PR and enables auto-merge. Promote `staging` to `main` manually when
the public GitHub Pages/native-wrapper surface is ready.
Short-lived branches should use `codex/`, `feature/`, `fix/`, `docs/`,
`chore/`, `hotfix/`, `dependabot/`, or `renovate/`. Release branches may target
`staging`; emergency hotfix branches may target `staging` or `main`.

FAB versions are SemVer values in [`package.json`](./package.json). Any
production release must also update [`CHANGELOG.md`](./CHANGELOG.md) with a
matching `## [X.Y.Z] - YYYY-MM-DD` section before tagging `vX.Y.Z`.
See [`docs/release-workflow.md`](./docs/release-workflow.md) for the full
pipeline, CI/CD jobs, and GitHub branch-protection settings.

## Project structure

Primary entry points:

- [`src/App.js`](./src/App.js): top-level theme, runtime metadata, and route shell
- [`src/Map.jsx`](./src/Map.jsx): map orchestration, selection state, and runtime wiring
- [`src/BurialSidebar.jsx`](./src/BurialSidebar.jsx): search, browse, and selected-record UI

Key folders:

- [`src/features/browse/`](./src/features/browse): search indexing and browse-result shaping
- [`src/features/map/`](./src/features/map): map-specific runtime helpers, popup models, shared map chrome, and selection logic
- [`src/features/tours/`](./src/features/tours): tour definitions, matching, and derived metadata
- [`src/features/fieldPackets.js`](./src/features/fieldPackets.js): shared-link encoding, restoration reconciliation, and field packet state
- [`src/shared/`](./src/shared): domain-neutral helpers such as routing contracts, runtime features, and GeoJSON utilities
- [`scripts/`](./scripts): build-time generators, migrations, and deployment wrappers

If you are not sure where a change belongs, stop at
[`docs/codebase-structure.md`](./docs/codebase-structure.md) before adding a new helper.

## Placement rules

- Keep React state, refs, and runtime orchestration in the top-level shells such
  as [`src/Map.jsx`](./src/Map.jsx) and [`src/BurialSidebar.jsx`](./src/BurialSidebar.jsx).
- Keep pure map business rules in [`src/features/map/mapDomain.js`](./src/features/map/mapDomain.js)
  so selection state, section logic, hover rules, geolocation filtering, and map-specific
  styling stay discoverable.
- Keep walking-route calculation and bundled-road routing in
  [`src/features/map/mapRouting.js`](./src/features/map/mapRouting.js) so map
  navigation logic has one home.
- Keep client route hashes, URL query-key names, and external directions links in
  [`src/shared/routing.js`](./src/shared/routing.js).
- Put pure transforms in the owning feature folder under [`src/features/`](./src/features).
- Put domain-neutral helpers in [`src/shared/`](./src/shared).
- Keep FAB-only behavior in [`src/features/fab/profile.js`](./src/features/fab/profile.js) for app/profile/presentation defaults and [`src/features/fab/tours.js`](./src/features/fab/tours.js) for tour definitions.
- Add comments when they explain boundaries, runtime constraints, generated
  data rules, or non-obvious browser/Leaflet behavior; avoid comments that only
  restate ordinary code.
- Do not add new helpers back under the retired `src/lib` layout.

## Source and generated files

Treat these as source-of-truth inputs:

- [`src/data/Geo_Burials.json`](./src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](./src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](./src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](./src/data/ARC_Boundary.json)
- tour files declared in [`src/features/fab/tours.js`](./src/features/fab/tours.js)

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

Default automated check:

- `bun run test`: run the standard local test suite, including Bun pure logic
  tests and Jest/jsdom DOM tests.

Test placement conventions for new or touched tests:

- Pure logic tests belong in `test/<module>.test.js` and run under `bun test`
  or `bun run test:bun`.
- DOM and component tests belong beside the component as
  `src/**/<Component>.test.jsx` and run under Jest/jsdom with
  `bun run test:dom`.
- Browser flows belong in `e2e/` and run under Playwright with
  `bun run test:e2e`.

Do not rename existing tests opportunistically. Keep test-file moves as a
separate, reviewable pass because many tests may already be modified in active
worktrees.

Targeted and advanced checks:

- Pure helper or data-shaping retest: `bun run test:bun`
- DOM/component retest: `bun run test:dom`
- Browser-flow retest: `bun run test:e2e`
- Cross-cutting or release-ready gate: `bun run check`
- Narrow iteration: `bun test <path-to-test>` or
  `node_modules/.bin/jest --config ./jest.dom.config.cjs <path-to-test>`
- Coverage: `bun run test:coverage`. Bun prints coverage for pure logic tests in
  the terminal, and Jest writes DOM coverage files to the default root
  `coverage/` directory.

If you change map or selection behavior:

1. Test search result click.
2. Test section polygon and section marker selection.
3. Test tour stop selection.
4. Test deep-link restoration.
5. Check desktop and mobile drawer behavior.
6. Keep selected-record, active-record, and hover updates on the reducer/actions
   in [`src/features/map/mapDomain.js`](./src/features/map/mapDomain.js).

If you change source data:

1. Regenerate derived artifacts.
2. Verify search, section browse, and tour selection still resolve to the same
   record.

If you change runtime or profile wiring:

1. Verify runtime toggles and environment-specific behavior in both development and production.
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
- Pick the release impact in the pull request template: none, patch, minor, or
  major.
- Prefer additive refactors over broad moves unless the move is the work.
