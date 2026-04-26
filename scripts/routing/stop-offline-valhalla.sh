#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="${FAB_VALHALLA_CONTAINER_NAME:-fab-valhalla}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to stop offline Valhalla." >&2
  exit 1
fi

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "No Valhalla container named ${CONTAINER_NAME} is present."
  exit 0
fi

docker stop "$CONTAINER_NAME" >/dev/null
echo "Stopped ${CONTAINER_NAME}"
