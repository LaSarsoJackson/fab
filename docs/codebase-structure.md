# Codebase structure

## Runtime

| Owner | Path | Does not own |
| --- | --- | --- |
| Product shell | `src/App.jsx` | MapLibre layer definitions, search scoring |
| URL contract | `src/app/routes.js` | Component state, native code |
| Navigation | `src/components/AppNavigation.jsx` | Route parsing |
| Record detail | `src/components/RecordCard.jsx` | Map popup lifecycle |
| Map lifecycle | `src/features/map/MapView.jsx` | Record normalization, provider configuration |
| Map style | `src/features/map/mapStyle.js` | React state and event handlers |
| Locator worker | `src/features/locator/` | Tour matching, MapLibre calls |
| Tours | `src/features/tours/` | Product navigation |
| FAB configuration | `src/features/fab/` | Generic browser helpers |

## Build and data

- `scripts/precalculate-metadata.js` turns canonical GeoJSON into runtime artifacts.
- `src/data/` contains source and generated tour data.
- `public/data/Search_Burials.json` is the only large browser-delivery dataset.
- `dist/` is generated and never committed.

## Placement test

Ask what the code knows:

- MapLibre API knowledge belongs in `features/map`.
- Burial row/search knowledge belongs in `features/locator`.
- Albany URLs and uneven source-record values belong in `features/fab`.
- Route query keys belong in `app/routes.js` or `shared/routing.js`.
- A helper with no product or renderer knowledge belongs in `shared`.

Prefer a direct import over another registry, adapter, or wrapper.
