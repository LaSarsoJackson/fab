#!/bin/bash

# generate_pmtiles.sh
# Requires 'tippecanoe' (brew install tippecanoe)

INPUT_FILE="src/data/Geo_Burials.json"
OUTPUT_FILE="public/data/geo_burials.pmtiles"

if ! command -v tippecanoe &> /dev/null
then
    echo "Error: tippecanoe not found. Please install it via 'brew install tippecanoe'."
    exit 1
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
