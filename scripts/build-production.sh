#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Ensuring derived tour popup data..."
bun run build:tour-data

REACT_APP_ENVIRONMENT=production react-scripts build "$@"
