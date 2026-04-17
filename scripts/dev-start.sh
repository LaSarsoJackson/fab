#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_command() {
  local command_name="$1"
  local hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required. $hint" >&2
    exit 1
  fi
}

require_command bun "Run 'bun install' after installing Bun >= 1.3."
require_command python3 "Python 3 is required for the companion image server."

if [ "${FAB_SKIP_TOUR_DATA:-0}" = "1" ]; then
  echo "Skipping derived tour popup data refresh (FAB_SKIP_TOUR_DATA=1)"
else
  # Popup biographies for the fixed-format tours are generated data, not raw
  # source fields, so keep that alias file fresh before the app boots.
  echo "Ensuring derived tour popup data..."
  bun run build:tour-data
fi

IMAGE_SERVER_HOST="${FAB_IMAGE_SERVER_HOST:-127.0.0.1}"
IMAGE_SERVER_PORT="${FAB_IMAGE_SERVER_PORT:-8000}"
IMAGE_SERVER_PID=""

is_port_in_use() {
  python3 - "$IMAGE_SERVER_HOST" "$IMAGE_SERVER_PORT" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.settimeout(0.2)
    sys.exit(0 if sock.connect_ex((host, port)) == 0 else 1)
PY
}

cleanup() {
  if [ -n "${IMAGE_SERVER_PID:-}" ] && kill -0 "$IMAGE_SERVER_PID" 2>/dev/null; then
    kill "$IMAGE_SERVER_PID" 2>/dev/null || true
    wait "$IMAGE_SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [ "${FAB_SKIP_IMAGE_SERVER:-0}" = "1" ]; then
  echo "Skipping dev image server (FAB_SKIP_IMAGE_SERVER=1)"
else
  export REACT_APP_DEV_IMAGE_SERVER_ORIGIN="${REACT_APP_DEV_IMAGE_SERVER_ORIGIN:-http://${IMAGE_SERVER_HOST}:${IMAGE_SERVER_PORT}}"

  if is_port_in_use; then
    echo "Using existing dev image server at http://${IMAGE_SERVER_HOST}:${IMAGE_SERVER_PORT}"
  else
    echo "Starting dev image server at http://${IMAGE_SERVER_HOST}:${IMAGE_SERVER_PORT}"
    python3 -m http.server "$IMAGE_SERVER_PORT" --bind "$IMAGE_SERVER_HOST" >/tmp/fab-image-server.log 2>&1 &
    IMAGE_SERVER_PID=$!
  fi
fi

export REACT_APP_ENVIRONMENT=development
react-scripts --max_old_space_size=4096 start "$@"
