#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Production builds must regenerate the profile-driven shell and tour alias
# artifact first so the static output matches the current source/profile state.
echo "Ensuring derived tour popup data..."
bun run build:tour-data
bun run sync:profile-shell

REACT_APP_ENVIRONMENT=production react-scripts build "$@"
