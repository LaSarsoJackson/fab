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
2. cemetery ground tint
3. restrained native hillshade
4. cemetery boundary
5. optional section fill
6. cemetery roads
7. optional section boundaries and selected section
8. burial-result clusters and individual tour stops
9. selected record

That order is the visual hierarchy. Do not solve prominence by raising every
line width or adding more controls.

## Interaction rules

- No pitch or rotation; this is a small-site wayfinding map.
- Sections stay hidden until requested or selected. Clicking one highlights and
  fits it in place, then maps every burial in that section with clustering. Its
  compact context keeps the same records one action away as a list.
- Curated tour stops are never proximity-clustered; every stop remains visible.
- Burial result sets may cluster at lower zooms to communicate density without
  overwhelming the map.
- A selected record is rendered once in the dedicated selected source.
- Tour stops remain directly selectable in an accessible HTML list; the canvas
  is not the only way to choose one.
- Tour details provide Previous, All places, and Next. Close dismisses details
  but keeps the selected place; All places returns to the tour extent.
- Burial details keep the separate Close and Unpin behavior.
- MapLibre attribution remains visible.
- Geolocation uses MapLibre’s control; directions hand off to Apple or Google Maps.

## Performance

The map is lazy-loaded on the first visit to the map destination. After that,
`App.jsx` keeps the one MapLibre instance mounted and hidden between destination
changes so the user's camera and in-session map context do not reset. The
cemetery-wide burial source is never added to MapLibre. Only the current tour,
selected section, search result set, or selected record is sent to the renderer.
The generated-data test keeps every current section within the 5,000 record
client-side limit. Burial results use MapLibre's native GeoJSON clustering. Tour
places use a separate unclustered GeoJSON source so the map does not hide any
place.

Do not introduce a second renderer or adapter layer. A renderer migration would
be the point to add an interface; anticipation is not evidence.
