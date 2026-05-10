# Maintainability Playbook

Use this note when a change is broad, architectural, or easy to scatter across
the app. It complements the subsystem notes in the architecture index by making
the current source-of-truth boundaries explicit.

## Working Standard

- Find the owner before adding code. If no owner is obvious, update
  [codebase-structure.md](./codebase-structure.md) before creating a new helper.
- Prefer deleting stale seams once a clearer owner exists. Do not preserve
  compatibility layers that only hide dead code.
- Add comments for constraints, invariants, and browser/runtime tradeoffs. Do
  not add comments that restate the next line of code.
- Keep generated outputs generated. Source data and tour definitions should
  drive artifacts through the build scripts.
- After consolidation, search docs and tests for the old module names before
  treating the cleanup as done.

## Current Owners

| Concern | Owner | Keep Out |
| --- | --- | --- |
| App shell, theme, metadata, lazy map mount | [`src/App.js`](../src/App.js) | Record transforms, Leaflet lifecycle, FAB URL constants |
| FAB branding, hosted URLs, data modules, profile callbacks | [`src/features/fab/profile.js`](../src/features/fab/profile.js) | Generic map rules, React component state |
| Tour definitions and FAB tour enrichment | [`src/features/fab/tours.js`](../src/features/fab/tours.js) | Runtime browse state, popup rendering |
| Map orchestration, React state, Leaflet refs and effects | [`src/Map.jsx`](../src/Map.jsx) | Pure domain rules and record formatting helpers |
| Pure map rules, selection reducer, viewport intent, popup geometry | [`src/features/map/mapDomain.js`](../src/features/map/mapDomain.js) | DOM, React hooks, Leaflet layer lifecycles |
| Local cemetery road routing | [`src/features/map/mapRouting.js`](../src/features/map/mapRouting.js) | URL query contracts, external Maps handoff |
| Popup record view models | [`src/features/map/mapRecordPresentation.js`](../src/features/map/mapRecordPresentation.js) | Cemetery-specific row labels and URL roots |
| Leaflet controls, layer adapters, map chrome | [`src/features/map/mapChrome.jsx`](../src/features/map/mapChrome.jsx) | Top-level state ownership |
| Sidebar composition | [`src/BurialSidebar.jsx`](../src/BurialSidebar.jsx) | Search scoring, section/tour result shaping |
| Browse result normalization and section indexes | [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js) | React state and Leaflet concerns |
| Search scoring and search indexes | [`src/features/browse/burialSearch.js`](../src/features/browse/burialSearch.js) | UI copy and component state |
| Sidebar copy, empty states, location notices | [`src/features/browse/sidebarPresentation.js`](../src/features/browse/sidebarPresentation.js) | Map effects, data loading |
| Sidebar browse/mobile-sheet hooks | [`src/features/browse/sidebarState.js`](../src/features/browse/sidebarState.js) | Render markup |
| Shared-link payloads and deep-link restoration | [`src/features/fieldPackets.js`](../src/features/fieldPackets.js) | External directions URL builders |
| Query-key names and external Apple/Google Maps links | [`src/shared/routing.js`](../src/shared/routing.js) | In-app road-graph routing |
| Runtime flags, public asset URLs, idle scheduling, metadata sync | [`src/shared/runtimeEnv.js`](../src/shared/runtimeEnv.js) | FAB product configuration |
| Generic GeoJSON bounds helpers | [`src/shared/geoJsonBounds.js`](../src/shared/geoJsonBounds.js) | Cemetery-specific policy |
| Global layout and Leaflet/sidebar/popup styling | [`src/index.css`](../src/index.css) | Dynamic component state |
| Root shell fallback styling | [`src/App.css`](../src/App.css) | Map/sidebar workflow styling |
| PWA cache policy | [`public/service-worker.js`](../public/service-worker.js) | Development caching behavior |

## Comment Policy

Good comments explain why a boundary exists or why a seemingly simple change is
risky. Examples worth keeping:

- Leaflet emits the same move events for programmatic and user viewport changes.
- GitHub Pages serves the app under `/fab`, so public URLs must pass through
  `buildPublicAssetUrl`.
- Tour and burial datasets are not one-to-one, so matching must stay heuristic
  and centralized.
- Full-cemetery search should defer large scans so mobile drawer animation and
  typing stay responsive.

Comments to avoid:

- Line-by-line narration of ordinary JavaScript.
- Historical notes that no longer affect the current code.
- "Temporary" comments without a removal condition.
- Repeating information already made obvious by a function or file name.

When a comment becomes false, fix the code or delete the comment in the same
change.

## Source And Generated Data

Source inputs:

- [`src/data/Geo_Burials.json`](../src/data/Geo_Burials.json)
- [`src/data/ARC_Sections.json`](../src/data/ARC_Sections.json)
- [`src/data/ARC_Roads.json`](../src/data/ARC_Roads.json)
- [`src/data/ARC_Boundary.json`](../src/data/ARC_Boundary.json)
- tour definitions and data modules in [`src/features/fab/tours.js`](../src/features/fab/tours.js)

Generated outputs:

- [`src/data/TourBiographyAliases.json`](../src/data/TourBiographyAliases.json)
- [`src/data/TourMatches.json`](../src/data/TourMatches.json)
- [`public/data/Search_Burials.json`](../public/data/Search_Burials.json)
- [`src/features/map/generatedBounds.js`](../src/features/map/generatedBounds.js)

Regenerate generated outputs instead of editing them by hand:

```bash
bun run build:tour-data
bun run build:data
```

## Change Checklist

1. Read the architecture note for the subsystem you are touching.
2. Search for existing owners before adding a file or helper.
3. If consolidating, delete the replaced layer and search `src/`, `test/`, and
   `docs/` for the old name.
4. Update tests that describe the current behavior, not legacy behavior.
5. Update docs in the same change when ownership or commands move.
6. Run the narrow test first, then widen to the appropriate gate.

## Validation Matrix

| Change Type | Minimum Gate |
| --- | --- |
| Docs and comments only | `git diff --check` |
| Pure helper or data-shaping logic | `bun run test:bun` |
| React/sidebar/component UI | `bun run test:dom` |
| Map interaction, selection, routing, or deep links | `bun run check` and `bun run test:e2e` when behavior changed |
| Source data or tour definitions | `bun run build:tour-data`, `bun run build:data`, then targeted browse/search/tour tests |
| Runtime/profile/public URL behavior | `bun run check` and verify production path assumptions |
| Release-ready or cross-cutting work | `bun run build` and `bun run check` |

## Review Hotspots

- `Map.jsx` and `BurialSidebar.jsx` should stay orchestration/composition files,
  not new homes for pure rules.
- `src/lib` is retired. Do not add new helpers there.
- Development-only surfaces belong on `dev-features` unless they are being
  promoted into the shipped app.
- `Route on Map` is local-road routing; `Open in Maps` is the external handoff.
- Shared URLs affect both the web app and `FABFG`.
