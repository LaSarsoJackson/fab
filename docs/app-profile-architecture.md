# App Profile Architecture

This repo now treats FAB as the active profile rather than the hardcoded app.

## Goal

Keep the runtime shell reusable for a generic 2D asset-management app while
making Albany-specific behavior obvious and easy to disable or replace.

## Current Split

- [`src/config/appProfile.js`](../src/config/appProfile.js): tiny active-profile boundary used by shared shell code. It should stay small and expose the active profile, not grow a second set of alias registries.
- [`src/features/fab/profile.js`](../src/features/fab/profile.js): FAB-specific branding, bundled data modules, map defaults, basemap/source registries, optimization-artifact metadata, field aliases, and feature registrations.
- [`src/features/fab/siteConfig.js`](../src/features/fab/siteConfig.js): FAB-only hosted URL roots, shell copy, and other migration-sensitive constants that should move together.
- [`src/features/fab/tours.js`](../src/features/fab/tours.js): FAB tour definitions, styling, and tour-record enrichment.
- [`src/features/fab/presentation.js`](../src/features/fab/presentation.js): FAB-only ARCE biography/image behavior and popup row shaping.
- [`src/admin/moduleRegistry.js`](../src/admin/moduleRegistry.js): reads modules from the active profile instead of rebuilding a local hardcoded list.
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): reads field aliases from the profile so source-field assumptions are not embedded directly in the browse pipeline.

## Feature Flags

The boutique FAB surfaces are explicit:

- `fabTours`
- `fabRecordPresentation`
- `fieldPackets`

Those flags live in [`src/shared/runtime/runtimeEnv.js`](../src/shared/runtime/runtimeEnv.js).

## Editing Guidance

When adding generic asset-management behavior:

1. Extend the shared shell or the profile contract.
2. Put FAB-only logic under `src/features/fab/`.
3. Keep `src/config/appProfile.js` narrow. If a caller only needs `dataModules`, tour definitions, or a single feature, derive it beside that caller instead of exporting another alias constant from the config layer.
4. Avoid importing Albany datasets, ARCE URLs, or tour metadata directly from the app shell.
5. Prefer profile fields or feature callbacks over new `if FAB` branches in shared code.

The static web shell follows the same rule: [`public/index.html`](../public/index.html)
and [`public/manifest.json`](../public/manifest.json) are synced from
[`public/index.template.html`](../public/index.template.html),
[`public/manifest.template.json`](../public/manifest.template.json), and the
active profile via `bun run sync:profile-shell`.

For map work specifically:

- put basemap declarations, overlay-source declarations, and static optimization
  artifact metadata in `APP_PROFILE.map`
- keep renderer-neutral engine vocabulary in
  [`src/features/map/engine/contracts.js`](../src/features/map/engine/contracts.js)
- document new source or artifact formats in
  [`docs/map-engine-api.md`](./map-engine-api.md) and
  [`docs/map-engine-geoparquet.md`](./map-engine-geoparquet.md)
