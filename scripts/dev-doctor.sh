#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for command in bun node; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) process.exit(1)' || {
  echo "Node 22.12 or newer is required by the Vite toolchain." >&2
  exit 1
}

for binary in eslint oxlint vite vitest; do
  if [[ ! -x "node_modules/.bin/$binary" ]]; then
    echo "Missing dependency binary: $binary. Run bun install." >&2
    exit 1
  fi
done

echo "FAB development environment is ready."
