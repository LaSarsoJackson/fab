#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

python_supports_geospatial_stack() {
  local python_bin="$1"

  [ -x "$python_bin" ] || return 1

  "$python_bin" - <<'PY' >/dev/null 2>&1
import geopandas  # noqa: F401
import pyarrow  # noqa: F401
import shapely  # noqa: F401
PY
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

echo "No Python interpreter with geopandas, pyarrow, and shapely was found." >&2
echo "Set FAB_GEOSPATIAL_PYTHON to a working interpreter or create a repo-local virtualenv." >&2
exit 1
