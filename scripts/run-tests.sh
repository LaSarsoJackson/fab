#!/usr/bin/env bash
set -euo pipefail

bun run test:bun
bun run test:dom
