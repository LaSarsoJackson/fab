# Tour record presentation

Tour datasets are uneven. Some records carry full names and biography slugs;
others carry only a portrait or location. The normalization path is:

1. [`tours.js`](../src/features/fab/tours.js) declares each dataset directly.
2. [`tourDerivedData.js`](../src/features/tours/tourDerivedData.js) resolves biography and portrait aliases.
3. [`tourRecords.js`](../src/features/tours/tourRecords.js) creates the map/detail record shape.
4. [`loadTour.js`](../src/features/tours/loadTour.js) loads only the selected tour.
5. [`RecordCard.jsx`](../src/components/RecordCard.jsx) renders the selected record outside the map canvas.

The map does not own popup markup. A selected point remains a map feature; the
detail card is ordinary React UI with Close, Navigate, Biography, Unpin, and the
secondary share disclosure.

Generated biography aliases live in `src/data/TourBiographyAliases.json`. Run
`bun run build:tour-data` after changing tour source records. Do not add
individual-person exceptions to `MapView` or `RecordCard`.
