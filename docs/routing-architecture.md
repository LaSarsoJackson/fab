# Routing architecture

This note is the ownership map for FAB routing and link work. It covers client
share/deep-link query keys, in-app cemetery road routing, and external
directions links.

## One contract module

Use [`src/shared/routing.js`](../src/shared/routing.js) for route and URL contracts:

- query-string key names such as `q`, `section`, `tour`, `share`, and `view`
- external Apple Maps and Google Maps directions links

## Supporting modules

- [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js): route
  calculation, bundled road-graph snapping, and local shortest-path routing.
- [`src/features/map/mapNavigationDestination.js`](../src/features/map/mapNavigationDestination.js):
  saved route-destination record shaping and localStorage persistence.
- [`src/features/fieldPackets.js`](../src/features/fieldPackets.js): field-packet
  encoding/decoding, URL state parsing, and restored-record reconciliation
  using the shared query-key registry.

## Editing guidance

- Add new query params and external directions-link builders to
  `src/shared/routing.js` first.
- Keep map rendering and route state in `src/Map.jsx`; do not add URL-builder
  logic there.
- Keep walking-route calculation in `mapRouting.js`; do not move road-graph
  routing into shared URL helpers.
- Keep saved navigation destination shaping in `mapNavigationDestination.js`;
  `Map.jsx` should only decide when to save, resume, or clear it.
- Keep packed share payload structure and current-data hydration in
  `src/features/fieldPackets.js`; the shared routing module only owns the public
  query-key contract.
