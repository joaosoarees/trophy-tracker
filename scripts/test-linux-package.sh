#!/usr/bin/env bash
# Installs the .deb from dist/ in a clean Debian container and checks that the
# app starts, shows the onboarding and reads the account from a Steam folder.
# Needs Docker. Build the package first with `pnpm dist:linux`.
set -e
cd "$(dirname "$0")/.."

ls dist/*.deb >/dev/null 2>&1 || { echo "No .deb in dist/. Run: pnpm dist:linux"; exit 1; }

docker run --rm \
  -v "$PWD/dist:/pkg:ro" \
  -v "$PWD/scripts/package-test:/probe:ro" \
  node:24-slim bash /probe/in-container.sh
