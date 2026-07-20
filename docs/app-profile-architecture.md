# App profile architecture

This repo now treats FAB as a single concrete app, not as a hypothetical
multi-profile shell.

## Goal

Keep FAB-specific behavior obvious without layering extra indirection on top of
the one app that actually ships.

## Current split

- [`src/features/fab/profile.js`](../src/features/fab/profile.js): source of truth
  for FAB configuration. It owns hosted URLs, branding, shell copy, and record
  presentation. It also owns data modules, map defaults, field aliases, and
  feature registrations.
- [`src/features/fab/tours.js`](../src/features/fab/tours.js): FAB tour definitions, styling, and tour-record enrichment.
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): reads field aliases from the profile so source-field assumptions are not embedded directly in the browse pipeline.

## Runtime features

Only shipped product toggles belong in `RUNTIME_FEATURE_FLAGS` inside
[`src/shared/runtimeEnv.js`](../src/shared/runtimeEnv.js):

- `fieldPackets`

Stable FAB product features such as tours and record presentation must stay in
[`APP_PROFILE.features`](../src/features/fab/profile.js) instead of pretending to
be rollout flags.

Keep development-only surfaces off `main`. Keep these surfaces on short-lived
branches until the shared `dev` pipeline can receive them.

These surfaces include static admin, custom renderer, PMTiles previews, and
site-twin tooling. See [`dev-branch-workflow.md`](./dev-branch-workflow.md).

## Editing guidance

When adding generic asset-management behavior:

1. Extend the shared shell or the profile contract.
2. Put FAB-only logic under `src/features/fab/`.
3. Import [`APP_PROFILE`](../src/features/fab/profile.js) or its exported data-module helpers directly instead of routing through another alias layer.
4. Do not import Albany datasets, ARCE URLs, or tour metadata from the app
   shell.
5. Prefer profile fields or feature callbacks over new hardcoded branches in shared code.

The static web shell follows the same rule. The sync command creates
[`public/index.html`](../public/index.html) and
[`public/manifest.json`](../public/manifest.json) from
[`public/index.template.html`](../public/index.template.html),
[`public/manifest.template.json`](../public/manifest.template.json), and the
FAB app profile with `bun run sync:profile-shell`.

For map work specifically:

- Put basemap declarations, overlay-source declarations, and optimization
  metadata in `APP_PROFILE.map`.
- Document branch-only experiment formats on short-lived work branches.
- Promote only production-ready profile fields to `main`.
