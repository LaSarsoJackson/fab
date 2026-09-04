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

1. neutral background and Esri World Hillshade
2. reference map
3. neutral cemetery ground tint
4. cemetery boundary
5. optional section fill
6. cemetery roads
7. optional section boundaries and selected section
8. road names, section numbers, and landmark names in local fonts
9. individually selected burial records and tour stops
10. selected record

That order is the visual hierarchy. Do not solve prominence by raising every
line width or adding more controls.

## Interaction rules

- No pitch or rotation; this is a small-site wayfinding map.
- Section polygons remain tappable when shading is off. Clicking one identifies,
  highlights, and fits that section, then keeps its burial list one action away.
  Do not replace that list with hundreds of unlabeled grave markers.
- Fit every polygon belonging to the selected section. Sections such as 49
  consist of multiple features; using only one gives an incomplete extent.
- Landmark names label the map. They do not start a tour or intercept section taps.
- Curated tour stops are never proximity-clustered; every stop remains visible.
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
cemetery-wide burial source is never added to MapLibre. The small Notables Tour
dataset supplies background landmark names. Current tour stops and individually
selected burials use separate GeoJSON sources so the map does not hide a
selected place. Fonts render locally without a glyph-service request.

Do not introduce a second renderer or adapter layer. A renderer migration would
be the point to add an interface; anticipation is not evidence.
