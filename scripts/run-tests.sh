#!/usr/bin/env bash
set -euo pipefail

# Keep the default test gate split explicit: Bun covers pure modules and data
# contracts, then Jest covers React DOM/component behavior.
bun run test:bun
bun run test:dom
