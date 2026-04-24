#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SITE_TWIN_PYTHON="$(bash ./scripts/geospatial/resolve_geospatial_python.sh numpy osgeo)"
NEEDS_PDAL=1

for arg in "$@"; do
  if [ "$arg" = "--metadata-only" ]; then
    NEEDS_PDAL=0
    break
  fi
done

if [ "$NEEDS_PDAL" -eq 1 ] && ! command -v pdal >/dev/null 2>&1; then
  echo "Error: pdal not found. Install PDAL to build the site twin preview outputs." >&2
  exit 1
fi

echo "Using geospatial Python: ${SITE_TWIN_PYTHON}"
exec "$SITE_TWIN_PYTHON" ./scripts/geospatial/build_site_twin.py "$@"
