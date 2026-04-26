# Routing Architecture

This note is the ownership map for FAB routing and link work. It covers client
route hashes, share/deep-link query keys, external directions links, and walking
route provider URL contracts.

## One Contract Module

Use [`src/shared/routing/`](../src/shared/routing) for route and URL contracts:

- app route ids and hashes, including `#/admin`
- query-string key names such as `q`, `section`, `tour`, `share`, `mapEngine`,
  and `routing`
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
- [`src/shared/runtime/runtimeEnv.js`](../src/shared/runtime/runtimeEnv.js):
  development-only provider selection and sticky override persistence.
- [`src/setupProxy.js`](../src/setupProxy.js): local Valhalla proxy wiring using
  the shared proxy defaults.
- [`scripts/routing/`](../scripts/routing): development-only local Valhalla
  container start/stop wrappers.

## Offline Valhalla

Use local Valhalla only as a development routing provider:

```bash
bun run routing:offline:start
bun run routing:offline:stop
```

Set these when testing the proxied offline provider:

```bash
REACT_APP_DEV_ROUTING_PROVIDER=valhalla
FAB_VALHALLA_ORIGIN=http://127.0.0.1:8002
REACT_APP_VALHALLA_PROXY_PATH=/__valhalla
```

The default proxy path and target live in
[`src/shared/routing/routingDefaults.json`](../src/shared/routing/routingDefaults.json)
so the browser URL builder and development proxy stay aligned.

## Editing Guidance

- Add new route hashes, query params, provider ids, and external route URL
  builders to `src/shared/routing/` first.
- Keep map rendering and route state in `src/Map.jsx`; do not add URL-builder
  logic there.
- Keep walking-route calculation and provider fallback in `mapRouting.js`; do
  not move road-graph routing into shared URL helpers.
- Keep packed share payload structure in `src/features/deeplinks/`; the shared
  routing module only owns the public query-key contract.
- When the local proxy default changes, update
  `src/shared/routing/routingDefaults.json` rather than changing
  `src/setupProxy.js` and `mapRouting.js` separately.
