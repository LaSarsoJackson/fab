# Architecture Index

Use this file to decide which note to read before making a change.

## Start Here

1. [README.md](../README.md) for product/runtime overview and commands
2. [CONTRIBUTING.md](../CONTRIBUTING.md) for workflow and validation expectations
3. [AGENTS.md](../AGENTS.md) for quick repo rules

## By Task

- Touching `src/Map.jsx` or map selection flow:
  [map-architecture.md](./map-architecture.md)

- Changing client route hashes, shared-link query params, in-app road routing,
  or external directions links:
  [routing-architecture.md](./routing-architecture.md)

- Changing where helpers or feature code should live:
  [codebase-structure.md](./codebase-structure.md)

- Doing repo-wide maintainability work, adding comments, or consolidating
  ownership:
  [maintainability-playbook.md](./maintainability-playbook.md)

- Adding FAB-only branding, data modules, tours, or presentation rules:
  [app-profile-architecture.md](./app-profile-architecture.md)

- Changing development-only surfaces such as static admin, custom renderer,
  PMTiles previews, or site-twin tooling:
  [dev-branch-workflow.md](./dev-branch-workflow.md)

- Changing shared UI patterns, spacing, interaction, or motion:
  [ui-principles.md](./ui-principles.md)

- Planning web/native alignment or repo modernization:
  [unified-stack-roadmap.md](./unified-stack-roadmap.md)

- Working on tour popup normalization or tour-derived presentation:
  [tour-popup-data.md](./tour-popup-data.md)

## Current High-Risk Cross-Cutting Areas

- deep links and selected-record restoration
- section browse and section marker parity
- tour stop matching and tour popup data
- contributor-facing docs drifting away from current architecture
- comments that describe old architecture after source consolidation
