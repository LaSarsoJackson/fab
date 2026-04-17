#!/usr/bin/env bash
set -euo pipefail

bun test src test
node_modules/.bin/jest --config ./jest.dom.config.cjs --runInBand
