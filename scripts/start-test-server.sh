#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
# Offline and service-worker checks must exercise the shipped asset layout.
bun run build
exec bunx vite preview --host 127.0.0.1 --port "$PORT"
