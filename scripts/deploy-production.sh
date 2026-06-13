#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Production deploys are owned by .github/workflows/deploy.yml when staging is
# promoted to main. Keep this script as a local production-build validation
# helper so maintainers do not publish from one machine.
bash ./scripts/build-production.sh

echo
echo "Production build complete."
echo "Merge staging into main to deploy through GitHub Actions."
