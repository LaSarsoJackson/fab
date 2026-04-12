#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_SERVER_HOST="127.0.0.1"
IMAGE_SERVER_PORT="8000"
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

if is_port_in_use; then
  echo "Using existing dev image server at http://${IMAGE_SERVER_HOST}:${IMAGE_SERVER_PORT}"
else
  echo "Starting dev image server at http://${IMAGE_SERVER_HOST}:${IMAGE_SERVER_PORT}"
  python3 -m http.server "$IMAGE_SERVER_PORT" --bind "$IMAGE_SERVER_HOST" >/tmp/fab-image-server.log 2>&1 &
  IMAGE_SERVER_PID=$!
fi

react-scripts --max_old_space_size=4096 start
