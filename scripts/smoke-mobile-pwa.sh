#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${FAB_MOBILE_PWA_PORT:-5174}"
HOST="${FAB_MOBILE_PWA_HOST:-127.0.0.1}"
PUBLIC_URL="${FAB_MOBILE_PWA_PUBLIC_URL:-.}"
TUNNEL="${FAB_MOBILE_PWA_TUNNEL:-}"
SERVER_PID=""
NGROK_PID=""

require_command() {
  local command_name="$1"
  local hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required. $hint" >&2
    exit 1
  fi
}

is_port_in_use() {
  python3 - "$HOST" "$PORT" <<'PY'
import socket
import sys

host = sys.argv[1]
port = int(sys.argv[2])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.settimeout(0.2)
    sys.exit(0 if sock.connect_ex((host, port)) == 0 else 1)
PY
}

wait_for_http() {
  local url="$1"

  python3 - "$url" <<'PY'
import sys
import time
import urllib.request

url = sys.argv[1]
deadline = time.time() + 30

while time.time() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            if response.status < 500:
                sys.exit(0)
    except Exception:
        time.sleep(0.5)

print(f"Timed out waiting for {url}", file=sys.stderr)
sys.exit(1)
PY
}

wait_for_ngrok_url() {
  local api_url="${FAB_NGROK_API_URL:-http://127.0.0.1:4040/api/tunnels}"

  python3 - "$api_url" <<'PY'
import json
import sys
import time
import urllib.request

api_url = sys.argv[1]
deadline = time.time() + 30

while time.time() < deadline:
    try:
        with urllib.request.urlopen(api_url, timeout=1) as response:
            payload = json.load(response)
        for tunnel in payload.get("tunnels", []):
            public_url = tunnel.get("public_url", "")
            if public_url.startswith("https://"):
                print(public_url)
                sys.exit(0)
    except Exception:
        time.sleep(0.5)

print("Timed out waiting for ngrok HTTPS tunnel.", file=sys.stderr)
sys.exit(1)
PY
}

cleanup() {
  if [ -n "${NGROK_PID:-}" ] && kill -0 "$NGROK_PID" 2>/dev/null; then
    kill "$NGROK_PID" 2>/dev/null || true
    wait "$NGROK_PID" 2>/dev/null || true
  fi

  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

require_command bun "Run 'bun install' after installing Bun >= 1.3."
require_command python3 "Python 3 is required to serve the production smoke build."

if [ "${FAB_MOBILE_PWA_SKIP_BUILD:-0}" = "1" ]; then
  if [ ! -f "$ROOT_DIR/build/index.html" ]; then
    echo "build/index.html is missing. Remove FAB_MOBILE_PWA_SKIP_BUILD or run bun run build first." >&2
    exit 1
  fi
  echo "Using existing production build (FAB_MOBILE_PWA_SKIP_BUILD=1)"
else
  echo "Building production PWA smoke bundle with PUBLIC_URL=${PUBLIC_URL}"
  PUBLIC_URL="$PUBLIC_URL" bash ./scripts/build-production.sh
fi

if is_port_in_use; then
  echo "Using existing static server at http://${HOST}:${PORT}"
else
  echo "Serving build at http://${HOST}:${PORT}"
  python3 -m http.server "$PORT" --bind "$HOST" --directory "$ROOT_DIR/build" >/tmp/fab-mobile-pwa-server.log 2>&1 &
  SERVER_PID=$!
  wait_for_http "http://${HOST}:${PORT}/"
fi

echo
echo "Local production smoke URL:"
echo "  http://${HOST}:${PORT}"

case "$TUNNEL" in
  "")
    echo
    echo "For real iPhone PWA behavior, use HTTPS:"
    echo "  bun run smoke:mobile-pwa:ngrok"
    echo
    echo "Plain LAN HTTP can check layout, but iOS will not exercise install/service-worker behavior there."
    ;;
  ngrok)
    require_command ngrok "Install and authenticate ngrok, then rerun this command."
    echo
    echo "Starting ngrok HTTPS tunnel..."
    ngrok http "http://${HOST}:${PORT}" --log=stdout >/tmp/fab-mobile-pwa-ngrok.log 2>&1 &
    NGROK_PID=$!
    TUNNEL_URL="$(wait_for_ngrok_url)"
    echo
    echo "Open this URL in Mobile Safari:"
    echo "  ${TUNNEL_URL}"
    ;;
  *)
    echo "Unsupported FAB_MOBILE_PWA_TUNNEL=${TUNNEL}. Supported value: ngrok" >&2
    exit 1
    ;;
esac

echo
echo "Smoke checklist:"
echo "  1. Search for Lamont and open the result."
echo "  2. Select a section and confirm the mobile sheet stays usable."
echo "  3. Start a tour and open a tour stop popup."
echo "  4. Use Share > Add to Home Screen, then launch the installed icon."
echo "  5. Reopen once offline and confirm the shell plus search payload still load."
echo
echo "Press Ctrl-C to stop the smoke server."

if [ -n "${SERVER_PID:-}" ]; then
  wait "$SERVER_PID"
else
  while true; do
    sleep 3600
  done
fi
