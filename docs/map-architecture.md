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

1. Esri World Hillshade or OpenStreetMap Streets
2. cemetery boundary
3. optional section fill
4. cemetery roads
5. optional section boundaries and selected section
6. road names, section numbers, and landmark names
7. section burial points or active tour stops
8. selected record

That order is the visual hierarchy. Do not solve prominence by raising every
line width or adding more controls.

## Interaction rules

- No pitch or rotation; this is a small-site wayfinding map.
- Section polygons remain tappable when shading is off. Clicking one identifies,
  highlights, and fits that section, and loads its burial points through the
  existing search worker. The full burial list remains one action away.
- A point tap opens the grave, or a name picker if several graves overlap.
  A blank map tap clears the selected section and grave. Clear section provides
  the same action without requiring a canvas tap.
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
- MapLibre credits start collapsed at bottom right, even before tiles finish
  loading. Panels leave space for both the closed and expanded control.
- Geolocation uses MapLibre’s control; directions hand off to Apple or Google Maps.

## Performance

The map is lazy-loaded on the first visit to the map destination. After that,
`App.jsx` keeps the one MapLibre instance mounted and hidden between destination
changes so the user's camera and in-session map context do not reset. The
cemetery-wide burial source is never added to MapLibre. The small Notables Tour
dataset supplies background landmark names. Current tour stops and the selected
section's burials use separate GeoJSON sources so the map does not hide a
selected place. Fonts render locally without a glyph-service request.
