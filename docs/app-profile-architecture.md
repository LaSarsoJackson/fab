# App Profile Architecture

This repo now treats FAB as a single concrete app, not as a hypothetical
multi-profile shell.

## Goal

Keep FAB-specific behavior obvious without layering extra indirection on top of
the one app that actually ships.

## Current Split

- [`src/features/fab/profile.js`](../src/features/fab/profile.js): direct source of truth for FAB-only hosted URL roots, branding, shell copy, record presentation callbacks, bundled data modules and data-module lookup helpers, map defaults, basemap/source registries, optimization-artifact metadata, field aliases, and feature registrations.
- [`src/features/fab/tours.js`](../src/features/fab/tours.js): FAB tour definitions, styling, and tour-record enrichment.
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): reads field aliases from the profile so source-field assumptions are not embedded directly in the browse pipeline.

## Runtime Features

Only shipped product toggles belong in `RUNTIME_FEATURE_FLAGS` inside
[`src/shared/runtime/runtimeEnv.js`](../src/shared/runtime/runtimeEnv.js):

- `fieldPackets`

Stable FAB product features such as tours and record presentation should stay in
[`APP_PROFILE.features`](../src/features/fab/profile.js) instead of pretending to
be rollout flags.

Development-only surfaces are kept off `master`. Static admin, custom renderer,
PMTiles previews, site-twin tooling, and similar DevEx/DevOps surfaces live on
`dev-features`; see [`dev-branch-workflow.md`](./dev-branch-workflow.md).

## Editing Guidance

When adding generic asset-management behavior:

1. Extend the shared shell or the profile contract.
2. Put FAB-only logic under `src/features/fab/`.
3. Import [`APP_PROFILE`](../src/features/fab/profile.js) or its exported data-module helpers directly instead of routing through another alias layer.
4. Avoid importing Albany datasets, ARCE URLs, or tour metadata directly from the app shell.
5. Prefer profile fields or feature callbacks over new hardcoded branches in shared code.

The static web shell follows the same rule: [`public/index.html`](../public/index.html)
and [`public/manifest.json`](../public/manifest.json) are synced from
[`public/index.template.html`](../public/index.template.html),
[`public/manifest.template.json`](../public/manifest.template.json), and the
FAB app profile via `bun run sync:profile-shell`.

For map work specifically:

- put basemap declarations, overlay-source declarations, and static optimization
  artifact metadata in `APP_PROFILE.map`
- document branch-only experiment formats on `dev-features`, and promote only
  production-ready profile fields back to `master`
