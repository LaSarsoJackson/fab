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
python3 scripts/geospatial/build_site_twin.py --metadata-only
```

Full native download plus preview build:

```bash
python3 scripts/geospatial/build_site_twin.py
```

Terrain-only prototype build for renderer iteration:

```bash
python3 scripts/geospatial/build_site_twin.py --terrain-only
```

Override AOI or municipality:

```bash
python3 scripts/geospatial/build_site_twin.py \
  --aoi path/to/boundary.geojson \
  --county Albany \
  --municipality Colonie
```

## Notes

- The current Albany Rural Cemetery default resolves to 2024 Colonie ortho imagery on the NYS GIS site.
- The intersecting raw 3DEP LiDAR currently resolves to the `NY_Columbia_Rensselaer_2016` Planetary Computer project for this AOI.
- The script uses GDAL Python bindings already present on this machine plus the `pdal` CLI for COPC metadata capture and COPC-derived raster fallback.
- On this machine, the staged 3DEP derivative TIFFs are LERC-compressed and the local GDAL build cannot open them. The pipeline now falls back to deriving DTM, DSM, HAG, intensity, and classification preview rasters directly from the raw COPC LiDAR when that happens.
