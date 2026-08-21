# Architecture index

Read only the note relevant to the change.

- Map renderer, layers, controls, or selection: [`map-architecture.md`](./map-architecture.md)
- Cartographic hierarchy, basemaps, hillshade, or attribution: [`cartography.md`](./cartography.md)
- Routes, deep links, FABFG URLs, or external directions: [`routing-architecture.md`](./routing-architecture.md)
- File placement and ownership: [`codebase-structure.md`](./codebase-structure.md)
- Cleanup and KISS decisions: [`maintainability-playbook.md`](./maintainability-playbook.md)
- Albany-specific values, ARCE links, or tours: [`fab-configuration.md`](./fab-configuration.md)
- Shared interaction and responsive UI: [`ui-principles.md`](./ui-principles.md)
- Web/native boundary and follow-on work: [`unified-stack-roadmap.md`](./unified-stack-roadmap.md)
- Tour record enrichment: [`tour-popup-data.md`](./tour-popup-data.md)
- CI, deploy, versions, or tags: [`release-workflow.md`](./release-workflow.md)

Current cross-cutting risks are route compatibility, worker search restoration,
tour-to-burial matching, provider attribution, and the native wrapper continuing
to use legacy Albany URLs instead of the canonical FAB routes.
