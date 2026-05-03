#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_REQUIRED_MODULES=(geopandas pyarrow shapely)
REQUIRED_MODULES=("$@")

# Allow callers to probe a smaller module set, but default to the full stack
# needed by the GeoParquet build and validation scripts.
if [ "${#REQUIRED_MODULES[@]}" -eq 0 ]; then
  REQUIRED_MODULES=("${DEFAULT_REQUIRED_MODULES[@]}")
fi

python_supports_geospatial_stack() {
  local python_bin="$1"
  local import_statement=""
  local required_module

  [ -x "$python_bin" ] || return 1

  for required_module in "${REQUIRED_MODULES[@]}"; do
    import_statement+="import ${required_module}; "
  done

  "$python_bin" -c "$import_statement" >/dev/null 2>&1
}

emit_first_supported_python() {
  local candidate
  for candidate in "$@"; do
    [ -n "${candidate:-}" ] || continue
    if python_supports_geospatial_stack "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

VENV_PYTHON=""
if [ -n "${VIRTUAL_ENV:-}" ]; then
  VENV_PYTHON="${VIRTUAL_ENV}/bin/python"
fi

if emit_first_supported_python \
  "${FAB_GEOSPATIAL_PYTHON:-}" \
  "$VENV_PYTHON" \
  "/opt/anaconda3/bin/python" \
  "/opt/homebrew/bin/python3.13" \
  "/opt/homebrew/bin/python3.14" \
  "$(command -v python3 2>/dev/null || true)" \
  "$(command -v python 2>/dev/null || true)"
then
  exit 0
fi

REQUIRED_MODULES_LABEL="$(printf '%s, ' "${REQUIRED_MODULES[@]}")"
REQUIRED_MODULES_LABEL="${REQUIRED_MODULES_LABEL%, }"

echo "No Python interpreter with ${REQUIRED_MODULES_LABEL} was found." >&2
echo "Set FAB_GEOSPATIAL_PYTHON to a working interpreter or create a repo-local virtualenv." >&2
exit 1
