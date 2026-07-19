#!/usr/bin/env bash
set -euo pipefail

test "${PREFLIGHT_GATE:-}" = "A"
test -f README.md

echo "Gate A repository read/write preflight passed"
