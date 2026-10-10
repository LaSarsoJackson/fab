#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

VITE_ARCE_WEBSITE_URL=/fab/arce/ bun run build
bun run build:arce github-pages
bun run check:arce github-pages
cp -R arce-pages-build/upload/fab/arce dist/arce
