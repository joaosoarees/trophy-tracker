#!/usr/bin/env bash
# Installs the .deb from dist/ in a clean Debian container and checks that the
# app starts, shows the onboarding and reads the account from a Steam folder.
# Needs Docker. Build the package first with `pnpm dist:linux`.
#
# The image is Docker's official `node`, taken from its mirror on Amazon's
# public registry: Docker Hub limits downloads from shared machines such as
# the ones GitHub runs the release on, and a refused download failed a release.
set -e
cd "$(dirname "$0")/.."

ls dist/*.deb >/dev/null 2>&1 || { echo "No .deb in dist/. Run: pnpm dist:linux"; exit 1; }

docker run --rm \
  -v "$PWD/dist:/pkg:ro" \
  -v "$PWD/scripts/package-test:/probe:ro" \
  public.ecr.aws/docker/library/node:24-slim bash /probe/in-container.sh
