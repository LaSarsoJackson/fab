# Map architecture

FAB has one renderer: MapLibre GL JS.

## Boundary

[`MapView.jsx`](../src/features/map/MapView.jsx) is the only module that creates a
MapLibre map or calls imperative map APIs. It owns:

- map construction and cleanup
- controls and pointer events
- source `setData` updates
- basemap, hillshade, and section visibility
- selected-record and tour viewport focus

[`mapStyle.js`](../src/features/map/mapStyle.js) is declarative. It owns sources,
layers, paint, provider URLs, and attribution. It does not import React.

Record transforms return ordinary GeoJSON in
[`burialRecords.js`](../src/features/locator/burialRecords.js). They do not know
which renderer consumes it.

## Layer order

1. reference map or imagery
2. low-opacity hillshade
3. cemetery ground and boundary
4. cemetery roads
5. optional sections
6. burial-result clusters and individual tour stops
7. selected record

That order is the visual hierarchy. Do not solve prominence by raising every
line width or adding more controls.

## Interaction rules

- No pitch or rotation; this is a small-site wayfinding map.
- Sections stay hidden until requested.
- Curated tour stops are never proximity-clustered; every stop remains visible.
- Burial result sets may cluster at lower zooms to communicate density without
  overwhelming the map.
- A selected record is rendered once in the dedicated selected source.
- Tour stops remain directly selectable in an accessible HTML list; the canvas
  is not the only way to choose one.
- Close dismisses details but keeps the pin. Unpin clears the selection.
- MapLibre attribution remains visible.
- Geolocation uses MapLibre’s control; directions hand off to Apple or Google Maps.

## Performance

The map is lazy-loaded when the map destination first mounts. The full burial
source is never added to MapLibre. Only the current tour, search result set, or
selected record is sent to the renderer. Burial results use MapLibre's native
GeoJSON clustering. Tour stops use a separate unclustered GeoJSON source so the
map does not hide part of a curated sequence.

Do not introduce a second renderer or adapter layer. A renderer migration would
be the point to add an interface; anticipation is not evidence.
