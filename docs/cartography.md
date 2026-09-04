# Cartography

FAB is a cemetery wayfinding map, not a basemap gallery. Every cartographic
choice must help a visitor understand the cemetery and act on a selected grave
or tour stop.

## Evidence

- Esri’s [primary design principles for cartography](https://www.esri.com/arcgis-blog/products/arcgis-pro/mapping/primary-design-principles-for-cartography)
  put figure-ground and visual hierarchy ahead of decoration.
- Esri’s [visual hierarchy guidance](https://www.esri.com/arcgis-blog/products/arcgis-online/education/visual-hierarchy-for-maps)
  treats the basemap as context that recedes behind thematic data.
- Esri’s [World Hillshade guidance](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/national-government/symbolizing-the-hillshade-for-the-world-topographic-map)
  calls for noncompetitive relief, especially in flatter areas.
- [MapLibre's glyph documentation](https://maplibre.org/maplibre-style-spec/glyphs/)
  describes local font rendering when the style omits a glyph-service URL.
- The [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/)
  requires visible attribution and forbids bulk or offline preloading from the
  standard tile service.

## FAB rules

- Default to a muted reference map for orientation.
- Use one reference map. A second imagery choice adds controls without helping
  visitors identify cemetery landmarks beneath the tree canopy.
- Keep terrain on by default. Use the earlier Esri World Hillshade source under
  a desaturated, translucent OpenStreetMap reference layer. The cemetery's
  ravines must remain visible at the overview and at walking scale.
- Draw the cemetery boundary and roads above terrain context.
- Draw cemetery paths in red with a pale casing so they remain distinct from
  streets, terrain, and section boundaries.
- Keep all-section shading off until requested. Section taps still identify and
  highlight the selected section.
- When sections are on, use a warm fill beneath the cemetery roads and draw
  section boundaries and numbers above them. Keep the selected section's
  number visible when all-section shading is off.
- Show every stop in the active tour; do not collapse curated stops into
  proximity clusters.
- Keep section inventories in the Burial Locator. The map highlights the
  selected section and pins an individual grave only after a visitor chooses it.
- Use one warm section highlight and one strong selected-record color.
- Label roads from `ARC_Roads.json` and landmarks from `NotablesTour20.json`.
  Draw these names above the basemap at full opacity with pale halos. Use local
  fonts, collision handling, and zoom thresholds. A landmark label opens the
  same record as its tour entry; names and coordinates remain source-derived.
- Keep provider attribution visible in every map mode.

## What is deliberately absent

- no local ortho tiling or export grid
- no imagery basemap control
- no pitch, terrain exaggeration, or 3D monuments
- no decorative map textures
- no separate color per burial category
- no layer drawer with implementation-oriented names

The September 2026 visual comparison found clearer ravines with the earlier
Esri hillshade source. Merely increasing native DEM exaggeration or reducing
the street map's opacity did not also solve label readability. Terrain and
cemetery labels therefore use separate layers. Credit Esri, USGS, and the
terrain contributors alongside OpenStreetMap.

Check the cemetery overview, Chester Arthur's grave, a selected section, and
all-section shading on desktop and a small phone. Repeat with Terrain off.
Interaction tests and source presence alone do not establish readable relief.
