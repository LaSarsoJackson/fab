# Routing Architecture

This note is the ownership map for FAB routing and link work. It covers client
share/deep-link query keys, in-app cemetery road routing, and external
directions links.

## One Contract Module

Use [`src/shared/routing/`](../src/shared/routing) for route and URL contracts:

- query-string key names such as `q`, `section`, `tour`, `share`, and `view`
- external Apple Maps and Google Maps directions links

## Supporting Modules

- [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js): route
  calculation, bundled road-graph snapping, and local shortest-path routing.
- [`src/features/deeplinks/`](../src/features/deeplinks): field-packet
  encoding/decoding and URL state parsing using the shared query-key registry.

## Editing Guidance

- Add new query params and external directions-link builders to
  `src/shared/routing/` first.
- Keep map rendering and route state in `src/Map.jsx`; do not add URL-builder
  logic there.
- Keep walking-route calculation in `mapRouting.js`; do not move road-graph
  routing into shared URL helpers.
- Keep packed share payload structure in `src/features/deeplinks/`; the shared
  routing module only owns the public query-key contract.
