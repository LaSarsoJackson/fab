#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
target=${1:-dev}
case "$target" in
  dev) site_path=/arce/dev/; output_dir=arce-dev-upload ;;
  production) site_path=/arce/; output_dir=arce-upload ;;
  *) echo 'ARCE target must be dev or production.' >&2; exit 1 ;;
esac
export ARCE_TARGET="$target"
# Remove only this target's generated package, so obsolete hashes are not re-shipped.
rm -rf "$output_dir"
bun run scripts/build-arce-pages.js
VITE_ARCE_WEBSITE_URL="$site_path" bun run build --base "${site_path}app/" --outDir "${output_dir}/upload${site_path}app"
bun run scripts/package-arce-upload.js
