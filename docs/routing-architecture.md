# Routing Architecture

This note is the ownership map for FAB routing and link work. It covers client
share/deep-link query keys, external directions links, and walking
route provider URL contracts.

## One Contract Module

Use [`src/shared/routing/`](../src/shared/routing) for route and URL contracts:

- query-string key names such as `q`, `section`, `tour`, `share`, and `view`
- routing provider ids: `api`, `local`, and `valhalla`
- default Valhalla API and local proxy endpoints
- Valhalla request URL/payload builders
- external Apple Maps and Google Maps directions links

[`src/shared/routing/routingDefaults.json`](../src/shared/routing/routingDefaults.json)
is intentionally JSON because both browser code and the CommonJS development
proxy can consume it.

## Supporting Modules

- [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js): route
  calculation, bundled road-graph snapping, local shortest-path routing,
  Valhalla response normalization, and provider fallback behavior.
- [`src/features/deeplinks/`](../src/features/deeplinks): field-packet
  encoding/decoding and URL state parsing using the shared query-key registry.
- [`docs/dev-branch-workflow.md`](./dev-branch-workflow.md): branch workflow
  for development-only routing provider experiments.

## Editing Guidance

- Add new query params, provider ids, and external route URL
  builders to `src/shared/routing/` first.
- Keep map rendering and route state in `src/Map.jsx`; do not add URL-builder
  logic there.
- Keep walking-route calculation and provider fallback in `mapRouting.js`; do
  not move road-graph routing into shared URL helpers.
- Keep packed share payload structure in `src/features/deeplinks/`; the shared
  routing module only owns the public query-key contract.
- Keep development-only proxy scripts and sticky provider switches on
  `dev-features` unless they become part of the shipped app.
