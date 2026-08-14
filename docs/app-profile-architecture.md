# App profile architecture

This repo now treats FAB as a single concrete app, not as a hypothetical
multi-profile shell.

## Goal

Keep FAB-specific behavior obvious without layering extra indirection on top of
the one app that actually ships.

## Current split

- [`src/features/fab/profile.js`](../src/features/fab/profile.js): direct source of truth for FAB-only hosted URL roots, branding, shell copy, record presentation callbacks, bundled data modules and data-module lookup helpers, map defaults, basemap/source registries, optimization-artifact metadata, field aliases, and feature registrations.
- [`src/features/fab/tours.js`](../src/features/fab/tours.js): FAB tour definitions, styling, and tour-record enrichment.
- [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js): reads field aliases from the profile so source-field assumptions are not embedded directly in the browse pipeline.

## Runtime features

Shipped product behavior is direct and consistent across deployments. Do not
wrap stable features in runtime flags. Tours and record presentation stay in
[`APP_PROFILE.features`](../src/features/fab/profile.js); shared-link behavior
ships as part of the app.

Development-only surfaces are kept out of the shipped app until they are ready
to merge into `main`.

## Editing guidance

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
- document experimental formats on short-lived work branches, and merge only
  production-ready profile fields into `main`
