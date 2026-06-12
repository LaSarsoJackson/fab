#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
GEOSPATIAL_PYTHON_RESOLVER="./scripts/geospatial/resolve_geospatial_python.sh"

# Doctor reports hard blockers as FAIL and optional local capabilities as WARN
# so contributors can still run the web app without the GeoParquet toolchain.
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

version_gte() {
  node - "$1" "$2" <<'NODE'
const actual = process.argv[2].replace(/^v/, "");
const expected = process.argv[3].replace(/^v/, "");

const parseVersion = (value) =>
  value.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);

const actualParts = parseVersion(actual);
const expectedParts = parseVersion(expected);
const width = Math.max(actualParts.length, expectedParts.length);

for (let index = 0; index < width; index += 1) {
  const actualPart = actualParts[index] || 0;
  const expectedPart = expectedParts[index] || 0;

  if (actualPart > expectedPart) {
    process.exit(0);
  }

  if (actualPart < expectedPart) {
    process.exit(1);
  }
}

process.exit(0);
NODE
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

REQUIRED_NODE_MAJOR="$(tr -d '[:space:]' < .nvmrc)"
REQUIRED_NODE_MAJOR="${REQUIRED_NODE_MAJOR#v}"
REQUIRED_NODE_MAJOR="${REQUIRED_NODE_MAJOR%%.*}"
NODE_VERSION="$(node -p "process.versions.node")"
if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= Number(process.argv[1]) ? 0 : 1)" "$REQUIRED_NODE_MAJOR"; then
  status_fail "Node ${NODE_VERSION} detected. Need Node ${REQUIRED_NODE_MAJOR} or newer from .nvmrc."
fi
status_ok "Node ${NODE_VERSION} (.nvmrc baseline ${REQUIRED_NODE_MAJOR})"

if ! command -v bun >/dev/null 2>&1; then
  status_fail "Bun is not installed. Install the version declared by packageManager."
fi

PACKAGE_MANAGER="$(node -e "const pkg = require('./package.json'); process.stdout.write(pkg.packageManager || '')")"
REQUIRED_BUN_VERSION="${PACKAGE_MANAGER#bun@}"
BUN_VERSION="$(bun --version)"
if [ "$PACKAGE_MANAGER" = "$REQUIRED_BUN_VERSION" ] || [ -z "$REQUIRED_BUN_VERSION" ]; then
  status_warn "packageManager does not declare a Bun version. Current Bun: ${BUN_VERSION}."
elif ! version_gte "$BUN_VERSION" "$REQUIRED_BUN_VERSION"; then
  status_fail "Bun ${BUN_VERSION} detected. Need Bun ${REQUIRED_BUN_VERSION} or newer from packageManager."
fi
status_ok "Bun ${BUN_VERSION} (packageManager ${PACKAGE_MANAGER})"

if ! command -v python3 >/dev/null 2>&1; then
  status_fail "python3 is not installed. It is required for the local image server."
fi

PYTHON_VERSION="$(python3 -c 'import platform; print(platform.python_version())')"
status_ok "Python ${PYTHON_VERSION}"

if command -v uv >/dev/null 2>&1; then
  UV_VERSION="$(uv --version)"
  status_ok "${UV_VERSION}"
else
  status_warn "uv is not installed. Optional Python data download scripts use 'uv run'."
fi

if GEOSPATIAL_PYTHON="$("$GEOSPATIAL_PYTHON_RESOLVER" 2>/dev/null)"; then
  GEOSPATIAL_PYTHON_VERSION="$("$GEOSPATIAL_PYTHON" -c 'import platform; print(platform.python_version())')"
  status_ok "GeoParquet toolchain ready (${GEOSPATIAL_PYTHON} / Python ${GEOSPATIAL_PYTHON_VERSION})"
else
  status_warn "GeoParquet toolchain not installed. 'build:geoparquet' and 'validate:geoparquet' need a Python with geopandas, pyarrow, and shapely."
fi

if [ ! -d node_modules ]; then
  status_fail "Dependencies are missing. Run 'bun install'."
fi

MISSING_BINARIES=()
for REQUIRED_BINARY in eslint jest playwright react-scripts; do
  if [ ! -e "node_modules/.bin/${REQUIRED_BINARY}" ]; then
    MISSING_BINARIES+=("$REQUIRED_BINARY")
  fi
done

if [ "${#MISSING_BINARIES[@]}" -gt 0 ]; then
  status_fail "Dependencies are incomplete; missing ${MISSING_BINARIES[*]}. Run 'bun install'."
fi
status_ok "Dependencies installed"

if node - <<'NODE' >/dev/null 2>&1
const fs = require("node:fs");
const { chromium } = require("playwright");

process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1);
NODE
then
  status_ok "Playwright Chromium browser installed"
else
  status_warn "Playwright Chromium browser missing. Run 'bunx playwright install chromium' before Playwright or icon-generation workflows."
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
