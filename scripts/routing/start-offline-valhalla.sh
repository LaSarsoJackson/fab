#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="${FAB_VALHALLA_CONTAINER_NAME:-fab-valhalla}"
HOST_PORT="${FAB_VALHALLA_PORT:-8002}"
SERVER_THREADS="${FAB_VALHALLA_THREADS:-2}"
TILE_URL="${FAB_VALHALLA_TILE_URL:-https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf}"
DATA_DIR="${FAB_VALHALLA_DATA_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/fab/valhalla}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run offline Valhalla." >&2
  exit 1
fi

mkdir -p "$DATA_DIR"

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Starting existing Valhalla container: ${CONTAINER_NAME}"
  docker start "$CONTAINER_NAME" >/dev/null
else
  echo "Creating Valhalla container: ${CONTAINER_NAME}"
  echo "Caching OSM extract and tiles in: ${DATA_DIR}"
  echo "Using OSM source: ${TILE_URL}"

  docker run -dt \
    --name "$CONTAINER_NAME" \
    -p "${HOST_PORT}:8002" \
    -v "${DATA_DIR}:/custom_files" \
    -e "tile_urls=${TILE_URL}" \
    -e "server_threads=${SERVER_THREADS}" \
    ghcr.io/valhalla/valhalla-scripted:latest >/dev/null
fi

echo "Valhalla is starting on http://127.0.0.1:${HOST_PORT}"
echo "Tail logs with: docker logs -f ${CONTAINER_NAME}"
