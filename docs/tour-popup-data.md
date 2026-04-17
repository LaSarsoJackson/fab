# Tour Popup Data Flow

This note explains how tour marker popups get their content, why the code is
structured this way, and where to make changes safely.

## Goal

All tour marker popups should render through the same popup UI model.

The frontend should not have per-tour popup branches such as:

- "Mayors get popup mode A"
- "GAR gets popup mode B"
- "everyone else gets popup mode C"

Instead, the data pipeline should normalize each tour record into the same
canonical fields so the popup layer can stay simple.

## Runtime Flow

1. Raw tour GeoJSON is defined in [`src/features/tours/tourDefinitions.js`](../src/features/tours/tourDefinitions.js).
2. [`src/data/TourBiographyAliases.json`](../src/data/TourBiographyAliases.json) is generated from the bundled tour datasets.
3. [`src/features/browse/browseResults.js`](../src/features/browse/browseResults.js) calls `buildTourBrowseResult(...)` and attaches canonical fields:
   - `portraitImageName`
   - `biographyLink`
4. [`src/features/tours/tourMetadata.js`](../src/features/tours/tourMetadata.js) carries those canonical fields into matched burial records.
5. [`src/features/map/mapRecordPresentation.js`](../src/features/map/mapRecordPresentation.js) builds one popup view model from the normalized record.
6. [`src/Map.jsx`](../src/Map.jsx) only renders the popup component and manages Leaflet lifecycle.

## Why The Alias File Exists

Some tours, especially `MayorsOfAlbany`, do not store biography slugs directly.
They may only have:

- a portrait filename
- a name
- a section/lot

Other tours contain the canonical `Tour_Bio` slug for the same person.

[`src/features/tours/tourDerivedData.js`](../src/features/tours/tourDerivedData.js) builds a
deterministic alias map from the better-annotated tours so fixed-format tours
can inherit a real biography slug without UI special cases.

Lookup order is intentionally conservative:

1. explicit `Tour_Bio` or `biographyLink`
2. exact normalized `name + section + lot`
3. exact normalized name
4. portrait stem

If no trustworthy match exists, the popup should remain image-only rather than
inventing a biography link.

## Build And Test Safety

The alias file is not a hidden manual step anymore.

- [`scripts/generate-tour-biography-aliases.js`](../scripts/generate-tour-biography-aliases.js) regenerates the alias JSON.
- [`scripts/build-production.sh`](../scripts/build-production.sh) runs that generator before every production build.
- [`scripts/dev-start.sh`](../scripts/dev-start.sh) runs it before local development starts.
- [`test/tourDerivedData.test.js`](../test/tourDerivedData.test.js) rebuilds the aliases from source tour data and fails if the checked-in JSON is stale.

That means:

- local dev starts with the required data in place
- production builds regenerate the required data
- tests catch drift if someone edits a tour dataset and forgets to commit the regenerated alias file

## Where To Change Things

If you are changing source tour data:

1. update the relevant file in [`src/data/`](../src/data/)
2. run `bun run build:tour-data`
3. run `bun test`

If you are changing how biographies are inferred:

- edit [`src/features/tours/tourDerivedData.js`](../src/features/tours/tourDerivedData.js)
- keep the inference rule generic
- prefer stronger matching keys over looser ones
- do not add popup-specific conditionals in `Map.jsx`

If you are changing popup presentation:

- edit [`src/features/map/mapRecordPresentation.js`](../src/features/map/mapRecordPresentation.js)
- keep it focused on view-model shaping, not source-data recovery

## Anti-Patterns

Avoid these:

- hardcoding special links for one mayor or one GAR record
- adding new popup modes per tour
- teaching `Map.jsx` how to recover missing biography data
- silently relying on generated JSON without a build or test guard

If a tour still needs special handling after normalization, that usually means
the source data or derivation logic needs to be improved instead.
