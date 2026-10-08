#!/usr/bin/env bash
# Builds the Linux and Windows installers inside a container, so the result
# does not depend on what is installed on this machine (the Windows installer
# needs Wine, which the image brings). macOS installers can only be built on
# macOS: those come from the GitHub Actions workflow.
# Needs Docker. Installers land in dist/.
set -e
cd "$(dirname "$0")/.."
mkdir -p dist

docker run --rm \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  -v "$PWD:/src:ro" \
  -v "$PWD/dist:/out" \
  electronuserland/builder:wine bash -c '
    set -e
    # Work on a copy: the source is mounted read-only and nothing here should
    # touch the node_modules of the host.
    mkdir /build && cd /src
    tar --exclude=./node_modules --exclude=./dist --exclude=./out --exclude=./.git -cf - . | tar -xf - -C /build
    cd /build
    corepack enable
    pnpm install --frozen-lockfile
    pnpm exec electron-vite build
    pnpm exec electron-builder --linux --win --publish never
    cp dist/*.AppImage dist/*.deb dist/*.exe /out/
    chown "$HOST_UID:$HOST_GID" /out/*
  '
ls -la dist/*.AppImage dist/*.deb dist/*.exe
