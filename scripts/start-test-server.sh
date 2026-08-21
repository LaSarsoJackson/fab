#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
exec bunx vite --host 127.0.0.1 --port "$PORT"
