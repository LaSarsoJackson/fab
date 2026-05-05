#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

INPUT_FILE="${1:-src/data/Geo_Burials.json}"
OUTPUT_FILE="${2:-src/data/Geo_Burials.parquet}"
GEOSPATIAL_PYTHON="$(bash ./scripts/geospatial/resolve_geospatial_python.sh)"

# Keep the migration wrapper thin: interpreter resolution lives in the shared
# geospatial resolver, and the Python script owns the actual file conversion.
echo "Generating GeoParquet from ${INPUT_FILE}..."
echo "Using geospatial Python: ${GEOSPATIAL_PYTHON}"
"$GEOSPATIAL_PYTHON" ./scripts/migrations/geoparquet/geojson_to_geoparquet.py "$INPUT_FILE" "$OUTPUT_FILE"
echo "Done! GeoParquet generated at ${OUTPUT_FILE}"
