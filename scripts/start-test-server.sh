#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
if [[ "${TEST_PRODUCTION:-0}" == "1" ]]; then
  # Offline checks must exercise the shipped asset layout.
  bun run build
  exec bunx vite preview --host 127.0.0.1 --port "$PORT"
fi
exec bunx vite --host 127.0.0.1 --port "$PORT"
