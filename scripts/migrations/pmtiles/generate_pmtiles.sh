#!/bin/bash

# generate_pmtiles.sh
# Requires 'tippecanoe' (brew install tippecanoe)

INPUT_FILE="src/data/Geo_Burials.json"
OUTPUT_FILE="public/data/geo_burials.pmtiles"
GEOPARQUET_SOURCE="src/data/Geo_Burials.parquet"
TEMP_GEOJSON_FILE=""
GEOSPATIAL_PYTHON=""

cleanup() {
    if [ -n "${TEMP_GEOJSON_FILE:-}" ] && [ -f "${TEMP_GEOJSON_FILE:-}" ]; then
        rm -f "$TEMP_GEOJSON_FILE"
    fi
}

trap cleanup EXIT INT TERM

if ! command -v tippecanoe &> /dev/null
then
    echo "Error: tippecanoe not found. Please install it via 'brew install tippecanoe'."
    exit 1
fi

if [ -f "$GEOPARQUET_SOURCE" ]; then
    GEOSPATIAL_PYTHON="$(bash ./scripts/geospatial/resolve_geospatial_python.sh)"
    echo "GeoParquet source detected at $GEOPARQUET_SOURCE. Attempting to materialize GeoJSON for tippecanoe..."
    echo "Using geospatial Python: $GEOSPATIAL_PYTHON"
    TEMP_GEOJSON_FILE="$(mktemp "${TMPDIR:-/tmp}/fab-burials.XXXXXX.geojson")"

    if "$GEOSPATIAL_PYTHON" ./scripts/migrations/geoparquet/read_geoparquet.py "$GEOPARQUET_SOURCE" > "$TEMP_GEOJSON_FILE"; then
        INPUT_FILE="$TEMP_GEOJSON_FILE"
    else
        echo "Warning: GeoParquet materialization failed. Falling back to $INPUT_FILE."
        rm -f "$TEMP_GEOJSON_FILE"
        TEMP_GEOJSON_FILE=""
    fi
fi

echo "Converting $INPUT_FILE to $OUTPUT_FILE..."

# tippecanoe arguments:
# -Z 0 (min zoom)
# -z 15 (max zoom for vector tiles, usually enough for points)
# -o output file
# --force (overwrite)
# --layer burials
# --drop-densest-as-needed (simplification if too many points at low zoom)

tippecanoe -z15 -Z10 -o "$OUTPUT_FILE" --force --layer burials "$INPUT_FILE"

echo "Done! PMTiles generated at $OUTPUT_FILE"
