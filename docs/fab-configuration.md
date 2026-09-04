# FAB configuration

Keep Albany-specific values in these modules:

- [`recordValues.js`](../src/features/fab/recordValues.js) normalizes cemetery fields.
- [`arceLinks.js`](../src/features/fab/arceLinks.js) validates ARCE biography and image URLs.
- [`tours.js`](../src/features/fab/tours.js) declares each tour or collection and its data import.

Keep provider URLs and map paint in `mapStyle.js`. Keep route values in
`routes.js`. Add a value to the module that uses it; FAB does not need a second
configuration registry.

## Tours and collections

A `tour` uses a deterministic proximity order anchored at its first source
record. A `collection` stays in source order and does not show numbered stops or
adjacent-stop controls. Neither order is a reviewed walking route.

If ARCE supplies a reviewed route, store its stable record IDs and optional
GeoJSON line with the tour definition. Do not infer pedestrian routes from the
cemetery road layer.

## Record presentation

Tour source files vary. Some records include a full name and biography; others
include only a portrait or location. The data moves through these files:

1. [`tours.js`](../src/features/fab/tours.js) declares the source.
2. [`tourDerivedData.js`](../src/features/tours/tourDerivedData.js) resolves biography and portrait aliases.
3. [`tourRecords.js`](../src/features/tours/tourRecords.js) creates the record used by the map and detail card.
4. [`loadTour.js`](../src/features/tours/loadTour.js) loads the selected tour.
5. [`RecordCard.jsx`](../src/components/RecordCard.jsx) renders the selected record outside the map canvas.

Generated biography aliases live in `src/data/TourBiographyAliases.json`. Run
`bun run build:tour-data` after changing a tour source file. Keep person-specific
exceptions out of `MapView` and `RecordCard`.
