# FAB Map Engine Spec

This is the application-specific spec for the FAB custom map engine.

Use it when the question is not "what is the generic runtime API?" but "what
does this product actually need the engine to do?"

## Source Of Truth

The machine-readable source of truth is:

- [`src/features/map/engine/manifest.js`](../src/features/map/engine/manifest.js)

You can print the current manifest with:

```bash
bun run describe:map-engine
```

That command is the fastest way to inspect the current runtime/backend posture
without manually reading several modules.

Important posture note:

- The product ships these flows today.
- Leaflet is still the production-default runtime.
- The custom runtime now has verified end-to-end coverage for the core shipped FAB flows and remains behind the feature flag for rollout control, not because those flows are still unverified.
- Runtime coverage in the table below reflects validated end-to-end behavior, not aspirational support.

## Application Requirements

For FAB, the engine must support these shipped user-facing flows at the product level:

| Need | Status | Runtime coverage |
| --- | --- | --- |
| burial search selection and popup inspection | shipped | custom, leaflet-adapter |
| section polygon browsing and scoped results | shipped | custom, leaflet-adapter |
| tour stop selection and popup inspection | shipped | custom, leaflet-adapter |
| mobile selected-person actions and sheet coordination | shipped | custom, leaflet-adapter |
| deep-link restoration into selected records | shipped | custom, leaflet-adapter |
| GeoParquet-backed static artifact generation | shipped | build backend |

These are still app-integrated rather than engine-owned, but the user-facing flows are now validated in both runtimes:

| Need | Status | Runtime coverage |
| --- | --- | --- |
| Valhalla and local-road on-map routing | adapter-backed | custom, leaflet-adapter |
| live geolocation controls | adapter-backed | custom, leaflet-adapter |

These are still deferred:

| Need | Status |
| --- | --- |
| interactive authoring, drawing, and editing | deferred |

## What The Engine Owns

For this application, the engine owns:

- runtime selection behind `REACT_APP_ENABLE_CUSTOM_MAP_ENGINE`
- basemap and overlay declarations from `APP_PROFILE.map`
- selection synchronization between map, sidebar, and popup state
- canvas rendering, hit testing, clustering, and popup anchoring in the custom runtime
- static artifact selection and build-source preference in the backend
- GeoParquet parity enforcement for invisible source-format migration

It does not yet fully own:

- Valhalla service wiring and local road-routing integration
- browser geolocation workflows and device permission handling
- admin editing tools

## Delivery Model

FAB is a static-hosted application. That means the engine should optimize for:

- build-time transforms instead of server-side tile APIs
- static artifacts that can ship on GitHub Pages or equivalent hosting
- browser delivery formats that do not require Mapbox, AGOL, or a custom tile server

Current preferred data roles:

- checked-in fallback source: GeoJSON
- preferred build source: GeoParquet
- preferred vector delivery: PMTiles
- preferred search delivery: minified JSON

## Runtime Model

The runtime model for FAB is:

1. `Map.jsx` orchestrates selection, deep links, drawer state, and routing state.
2. The runtime contract selects either the custom runtime or the Leaflet adapter.
3. The sidebar and popup presentation talk to shared record models, not provider APIs.
4. The backend chooses which build artifact format should feed the runtime payloads.

This split matters because it is what allows the product to say:

- FAB has its own map engine API.
- FAB has its own build-time geospatial backend.
- Leaflet is a compatibility adapter and current production default, not the long-term platform boundary.

## Promotion Requirements

Before calling the custom engine the default engine for FAB, keep these gates:

1. `bun run test`
2. `bun run build:data`
3. `bun run validate:geoparquet`
4. `bun run build`
5. `bun run test:e2e`

The custom runtime can remain behind the feature flag while rollout risk is
managed, but the remaining gates are now about default-runtime confidence and
ownership decisions, not basic interaction parity for the shipped flows above.

## Editing Guidance

When making engine changes for FAB:

- update the runtime/backend contract before adding app-specific shortcuts
- keep basemap and artifact declarations in [`src/features/fab/profile.js`](../src/features/fab/profile.js)
- update the manifest when engine ownership or capability boundaries change
- update this spec when the product-level engine claim changes

If you add a new format, runtime, or application flow and it is not reflected in
the manifest or this spec, the documentation is incomplete.
