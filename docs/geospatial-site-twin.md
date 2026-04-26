# Geospatial Site Twin Pipeline

`scripts/geospatial/build_site_twin.py` downloads native source assets for the cemetery AOI and then builds a static site-twin package for the app.

## What It Preserves

- Native NYS ortho ZIP for the matched municipality and year
- Native 3DEP COPC point-cloud tiles intersecting the AOI
- Native 3DEP derivative rasters used for preview generation when the local GDAL build can read them:
- `dtm`
- `dsm`
- `hag`
- `intensity`
- `classification`

These are staged under `output/geospatial/<aoi-hash>/raw/`.

## What It Builds

- AOI metadata and cutline GeoJSONs
- Preview-grid aligned rasters for ortho, DTM, DSM, HAG, intensity, and classification
- `nDSM`
- multi-azimuth hillshade
- headstone anchor mask from the existing repo point layers
- `terrain_surface.tif`
- `terrain_surface.png`
- `grave_candidates.geojson`
- `manifest.json`

These are written under `output/geospatial/<aoi-hash>/derived/`.

The app-consumable static package is also written to `public/data/site_twin/`:

- `manifest.json`
- `terrain_surface.png`
- `terrain_surface.tif`
- `grave_candidates.geojson`

## Usage

Metadata-only dry run:

```bash
bun run build:site-twin:metadata
```

Full native download plus preview build:

```bash
bun run build:site-twin
```

Terrain-only prototype build for renderer iteration:

```bash
bun run build:site-twin:terrain
```

Override AOI or municipality:

```bash
bash ./scripts/geospatial/run_site_twin.sh \
  --aoi path/to/boundary.geojson \
  --county Albany \
  --municipality Colonie
```

## Notes

- The current Albany Rural Cemetery default resolves to 2024 Colonie ortho imagery on the NYS GIS site.
- The intersecting raw 3DEP LiDAR currently resolves to the `NY_Columbia_Rensselaer_2016` Planetary Computer project for this AOI.
- Use `scripts/geospatial/run_site_twin.sh` when you need to pass custom flags. It resolves a Python interpreter with `numpy` and GDAL bindings before calling `build_site_twin.py`.
- The preview build path uses GDAL Python bindings plus the `pdal` CLI for COPC metadata capture and COPC-derived raster fallback.
- On this machine, the staged 3DEP derivative TIFFs are LERC-compressed and the local GDAL build cannot open them. The pipeline now falls back to deriving DTM, DSM, HAG, intensity, and classification preview rasters directly from the raw COPC LiDAR when that happens.
