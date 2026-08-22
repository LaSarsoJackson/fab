# FAB configuration

FAB is one product, so it does not use a profile registry or plugin layer.
Albany-specific facts stay in three direct modules:

- [`recordValues.js`](../src/features/fab/recordValues.js) normalizes uneven cemetery fields.
- [`arceLinks.js`](../src/features/fab/arceLinks.js) validates ARCE biography and image URLs.
- [`tours.js`](../src/features/fab/tours.js) declares each bundled name, route
  key, tour-or-collection kind, and lazy data import.

Tour record construction lives in
[`tourRecords.js`](../src/features/tours/tourRecords.js). Burial delivery records
live in [`burialRecords.js`](../src/features/locator/burialRecords.js). Neither
module goes through a generic adapter.

Map provider URLs and paint belong in `mapStyle.js`. Route values belong in
`routes.js`. Add configuration to the owning module instead of rebuilding a
cross-cutting product profile.

Explicit `kind: "tour"` definitions use a deterministic nearest-neighbor visit
order anchored at the source first stop. `kind: "collection"` definitions stay
source-ordered because they are inventories, not itineraries. The proximity
order is a browsing aid, not a reviewed pedestrian route or a safety claim. A
future reviewed route belongs directly on its tour definition as stable ordered
record IDs and, when available, one reviewed local GeoJSON line. Do not add a
generic route registry or infer pedestrian geometry from the cemetery road
layer.
