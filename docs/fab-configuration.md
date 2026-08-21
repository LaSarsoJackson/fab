# FAB configuration

FAB is one product, so it does not use a profile registry or plugin layer.
Albany-specific facts stay in three direct modules:

- [`recordValues.js`](../src/features/fab/recordValues.js) normalizes uneven cemetery fields.
- [`arceLinks.js`](../src/features/fab/arceLinks.js) validates ARCE biography and image URLs.
- [`tours.js`](../src/features/fab/tours.js) declares the bundled tour name, route key, and lazy data import.

Tour record construction lives in
[`tourRecords.js`](../src/features/tours/tourRecords.js). Burial delivery records
live in [`burialRecords.js`](../src/features/locator/burialRecords.js). Neither
module goes through a generic adapter.

Map provider URLs and paint belong in `mapStyle.js`. Route values belong in
`routes.js`. Add configuration to the owning module instead of rebuilding a
cross-cutting product profile.
