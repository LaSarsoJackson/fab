# Static Admin Studio

The app now includes a static admin workspace at `#/admin`.

Example local URL:

- `http://localhost:3000/#/admin`

Production note:

- production hosts intentionally fall back to the public map instead of opening
  `#/admin`

## Availability

The current admin studio is development-only.

Notes:

- It opens at `#/admin` when `REACT_APP_ENVIRONMENT` resolves to development.
- Production builds intentionally do not expose the admin route.
- This keeps the static editor available for local drafting without pretending a
  client-side password would secure a static production host.
- When the product grows a real write path, add server-verified auth at that
  time instead of extending the current dev-only route.

## What it edits

The admin studio treats each file-backed dataset as a module:

- core map layers such as `Geo_Burials.json`, `ARC_Sections.json`, `ARC_Roads.json`, and `ARC_Boundary.json`
- every tour dataset declared in `src/features/fab/tours.js`

Generated artifacts such as `public/data/Search_Burials.json`, `src/data/TourMatches.json`, and `src/features/map/generatedBounds.js` are not edited directly. They are regenerated when you export an update bundle after editing burials, tours, or boundary data.

## Boundaries

- The admin studio is a browser-side drafting tool, not a live CMS.
- The current route is intentionally development-only rather than production-secured.
- Source JSON and GeoJSON files in the repo remain the source of truth after export.
- Generated artifacts should be replaced from the exported bundle or from the normal build scripts, not hand-edited in isolation.

## Static workflow

Because the site remains static, the admin studio does not write back to a server.

Instead, the workflow is:

1. Open `#/admin`
2. Select a dataset module
3. Edit records directly in the UI or import an Excel workbook
4. Download either:
   - a module JSON file for a single dataset, or
   - the full update bundle zip for promotion through the repo/deploy flow

The update bundle includes:

- changed source files
- regenerated `Search_Burials.json`
- regenerated `TourMatches.json`
- regenerated `generatedBounds.js` when boundary-derived data is affected
- an `admin-update-manifest.json` file listing what to replace

The bundle is meant to be applied back to the repo, reviewed, and then promoted through the usual static build flow.

## Excel round-trip

Each module can export an `.xlsx` workbook with:

- a `data` sheet containing rows and schema-aligned columns
- a `schema` sheet describing field types
- an `instructions` sheet explaining the round-trip

Re-importing that workbook merges rows back into the current browser draft. Keep the `__admin_row_id` column so the admin studio can match workbook rows to existing features.

## Publishing

After downloading the update bundle:

1. replace the listed files in the repo
2. run the normal static build flow
3. deploy as usual

This keeps the product static while still giving admins a structured editing workflow.

## Current Limitations

- Drafts live in the current browser tab until you export or reload source data.
- The studio does not perform server-side validation or conflict resolution.
- Large dataset edits should still be spot-checked in the main map UI after promotion because the runtime selection flow depends on regenerated derived data.
