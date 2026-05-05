#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Deploy only the freshly built static bundle; gh-pages owns publishing the
# generated build directory to the repository's Pages branch.
bash ./scripts/build-production.sh
gh-pages -d build
