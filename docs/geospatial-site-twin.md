# Geospatial Site Twin Pipeline

`scripts/geospatial/build_site_twin.py` downloads native source assets for the cemetery AOI and then builds a quasi-3D grave-relief preview from clipped raster derivatives.

## What It Preserves

- Native NYS ortho ZIP for the matched municipality and year
- Native 3DEP COPC point-cloud tiles intersecting the AOI
- Native 3DEP derivative rasters used for preview generation:
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
- `grave_relief_quasi_3d.tif`
- `grave_relief_quasi_3d.png`
- `manifest.json`

These are written under `output/geospatial/<aoi-hash>/derived/`.

## Usage

Metadata-only dry run:

```bash
python3 scripts/geospatial/build_site_twin.py --metadata-only
```

Full native download plus preview build:

```bash
python3 scripts/geospatial/build_site_twin.py
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
- The script uses GDAL Python bindings already present on this machine plus the `pdal` CLI for COPC metadata capture. It does not require a separate Python geospatial environment to run here.
