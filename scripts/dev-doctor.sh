#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
GEOSPATIAL_PYTHON_RESOLVER="./scripts/geospatial/resolve_geospatial_python.sh"

status_ok() {
  printf "OK   %s\n" "$1"
}

status_warn() {
  printf "WARN %s\n" "$1"
}

status_fail() {
  printf "FAIL %s\n" "$1" >&2
  exit 1
}

has_env_key() {
  local key="$1"

  if [ -n "${!key:-}" ]; then
    return 0
  fi

  if [ -f .env ] && grep -Eq "^[[:space:]]*${key}=" .env; then
    return 0
  fi

  return 1
}

if ! command -v node >/dev/null 2>&1; then
  status_fail "Node.js is not installed. Install Node 20 or newer."
fi

NODE_VERSION="$(node -p "process.versions.node")"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"; then
  status_fail "Node ${NODE_VERSION} detected. Need Node 20 or newer."
fi
status_ok "Node ${NODE_VERSION}"

if ! command -v bun >/dev/null 2>&1; then
  status_fail "Bun is not installed. Install Bun 1.3 or newer."
fi

BUN_VERSION="$(bun --version)"
if ! bun -e "const [major, minor] = Bun.version.split('.').map(Number); process.exit(major > 1 || (major === 1 && minor >= 3) ? 0 : 1)"; then
  status_fail "Bun ${BUN_VERSION} detected. Need Bun 1.3 or newer."
fi
status_ok "Bun ${BUN_VERSION}"

if ! command -v python3 >/dev/null 2>&1; then
  status_fail "python3 is not installed. It is required for the local image server."
fi

PYTHON_VERSION="$(python3 -c 'import platform; print(platform.python_version())')"
status_ok "Python ${PYTHON_VERSION}"

if GEOSPATIAL_PYTHON="$("$GEOSPATIAL_PYTHON_RESOLVER" 2>/dev/null)"; then
  GEOSPATIAL_PYTHON_VERSION="$("$GEOSPATIAL_PYTHON" -c 'import platform; print(platform.python_version())')"
  status_ok "GeoParquet toolchain ready (${GEOSPATIAL_PYTHON} / Python ${GEOSPATIAL_PYTHON_VERSION})"
else
  status_warn "GeoParquet toolchain not installed. 'build:geoparquet' and 'validate:geoparquet' need a Python with geopandas, pyarrow, and shapely."
fi

if [ -d node_modules/react-scripts ]; then
  status_ok "Dependencies installed"
else
  status_warn "Dependencies are missing or incomplete. Run 'bun install'."
fi

if [ -f src/data/TourBiographyAliases.json ]; then
  status_ok "Derived tour biography aliases present"
else
  status_warn "Missing src/data/TourBiographyAliases.json. Run 'bun run build:tour-data'."
fi

if has_env_key REACT_APP_DEV_IMAGE_SERVER_ORIGIN; then
  status_ok "Custom local image origin configured"
else
  status_ok "Local image origin will default to http://127.0.0.1:8000 via 'bun run start'"
fi
