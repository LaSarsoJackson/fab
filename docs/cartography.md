# Cartography

FAB is a cemetery wayfinding map, not a basemap gallery. Every cartographic
choice should help a visitor understand the cemetery and act on a selected
grave or tour stop.

## Evidence

- Esri’s [primary design principles for cartography](https://www.esri.com/arcgis-blog/products/arcgis-pro/mapping/primary-design-principles-for-cartography)
  put figure-ground and visual hierarchy ahead of decoration.
- Esri’s [visual hierarchy guidance](https://www.esri.com/arcgis-blog/products/arcgis-online/education/visual-hierarchy-for-maps)
  treats the basemap as context that should recede behind thematic data.
- Esri’s [World Hillshade guidance](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/national-government/symbolizing-the-hillshade-for-the-world-topographic-map)
  calls for noncompetitive relief, especially in flatter areas.
- The [MapLibre hillshade example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-hillshade-layer/)
  uses a raster DEM with a native hillshade layer instead of a pre-rendered
  gray raster overlay.
- The Esri World Street Map service provides the familiar street and landmark
  context used by the earlier burial map. Keep its complete source attribution
  visible.

## FAB rules

- Default to the Esri streets reference map for the familiar orientation and
  landmark context of the earlier burial map.
- Use one reference map. A second imagery choice adds controls without helping
  visitors identify cemetery landmarks beneath the tree canopy.
- Keep hillshade available and on by default. Use native MapLibre shading over
  a Terrarium DEM beneath the labeled reference map so relief reads without
  dimming place names. Draw boundary, sections, roads, and all markers above it.
- Draw the cemetery boundary and roads above terrain context.
- Give cemetery paths a warm red casing so they remain distinct from streets
  and the pale path lines in the reference map.
- Keep sections off until the user asks for them.
- When sections are on, use a warm fill beneath the cemetery roads and draw
  section boundaries above them.
- Show every stop in the active tour; do not collapse curated stops into
  proximity clusters.
- Keep section inventories in the Burial Locator. The map highlights the
  selected section and pins an individual grave only after a visitor chooses it.
- Use one warm section highlight and one strong selected-record color.
- Keep labels supplied by the reference basemap; do not add an external glyph
  service solely to label section polygons.
- Keep provider attribution visible in every map mode.

## What is deliberately absent

- no local ortho tiling or export grid
- no imagery basemap control
- no pitch, terrain exaggeration, or 3D monuments
- no decorative map textures
- no separate color per burial category
- no layer drawer with implementation-oriented names

Hillshade remains because the cemetery’s terrain materially affects on-site
orientation. It is context, not the subject. The DEM uses Mapzen Terrain Tiles;
in this United States extent its elevation data is credited to the USGS 3D
Elevation Program.
