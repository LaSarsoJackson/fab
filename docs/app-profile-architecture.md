# App Profile Architecture

This repo now treats FAB as the active profile rather than the hardcoded app.

## Goal

Keep the runtime shell reusable for a generic 2D asset-management app while
making Albany-specific behavior obvious and easy to disable or replace.

## Current Split

- [`src/config/appProfile.js`](../src/config/appProfile.js): selects the active application profile and exposes shared registry helpers.
- [`src/features/fab/profile.js`](../src/features/fab/profile.js): FAB-specific branding, bundled data modules, map defaults, basemap/source registries, optimization-artifact metadata, field aliases, and feature registrations.
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
3. Avoid importing Albany datasets, ARCE URLs, or tour metadata directly from the app shell.
4. Prefer profile fields or feature callbacks over new `if FAB` branches in shared code.

For map work specifically:

- put basemap declarations, overlay-source declarations, and static optimization
  artifact metadata in `APP_PROFILE.map`
- keep renderer-neutral engine vocabulary in
  [`src/features/map/engine/contracts.js`](../src/features/map/engine/contracts.js)
- document new source or artifact formats in
  [`docs/map-engine-api.md`](./map-engine-api.md) and
  [`docs/map-engine-geoparquet.md`](./map-engine-geoparquet.md)
