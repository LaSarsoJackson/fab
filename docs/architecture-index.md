# Architecture Index

Use this file to decide which note to read before making a change.

## Start Here

1. [README.md](../README.md) for product/runtime overview and commands
2. [CONTRIBUTING.md](../CONTRIBUTING.md) for workflow and validation expectations
3. [AGENTS.md](../AGENTS.md) for quick repo rules

## By Task

- Touching `src/Map.jsx` or map selection flow:
  [map-architecture.md](./map-architecture.md)

- Planning or defending the FAB custom map story:
  [custom-map-engine.md](./custom-map-engine.md)

- Changing map runtime or backend contracts:
  [map-engine-api.md](./map-engine-api.md)

- Planning or documenting the engine as a standalone clean-room API:
  [map-engine-standalone-api.md](./map-engine-standalone-api.md)

- Working on custom-runtime parity, popup/hover bugs, or engine ownership:
  [map-engine-runtime-ownership.md](./map-engine-runtime-ownership.md)

- Working on GeoParquet, PMTiles, or static geospatial artifacts:
  [map-engine-geoparquet.md](./map-engine-geoparquet.md)

- Working on the cemetery site twin / digital twin pipeline:
  [geospatial-site-twin.md](./geospatial-site-twin.md)

- Changing where helpers or feature code should live:
  [codebase-structure.md](./codebase-structure.md)

- Changing admin editing, workbook flows, or update bundles:
  [static-admin-studio.md](./static-admin-studio.md)

- Adding FAB-only branding, data modules, tours, or presentation rules:
  [app-profile-architecture.md](./app-profile-architecture.md)

- Changing shared UI patterns, spacing, interaction, or motion:
  [ui-principles.md](./ui-principles.md)

- Planning web/native alignment, custom-map rollout, or repo modernization:
  [unified-stack-roadmap.md](./unified-stack-roadmap.md)

- Working on tour popup normalization or tour-derived presentation:
  [tour-popup-data.md](./tour-popup-data.md)

## Current High-Risk Cross-Cutting Areas

- deep links and selected-record restoration
- section browse and section marker parity
- tour stop matching and tour popup data
- custom runtime versus Leaflet parity
- contributor-facing docs drifting away from current architecture
