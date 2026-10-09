#!/usr/bin/env bash
# Publishes a release with what the build of the three systems left in a
# folder: each installer under a label that says who it is for, and the files
# the installed app reads to update itself labelled as such, so the list on
# the release page explains itself. The notes start with which file to pick.
#
#   scripts/publish-release.sh v1.2.0 installers/
#
# With DRY_RUN=1 it prints what it would publish instead of publishing.
# Needs the GitHub CLI, GH_TOKEN and GITHUB_REPOSITORY (the workflow has them).
set -euo pipefail

tag=$1
dir=${2%/}
version=${tag#v}
download="https://github.com/$GITHUB_REPOSITORY/releases/download/$tag"

# What the release page shows instead of each file name.
label_of() {
  case "$1" in
    *-Windows.exe) echo "Windows — installer" ;;
    *-macOS-arm64.dmg) echo "macOS — Apple Silicon (M1 or newer)" ;;
    *-macOS-x64.dmg) echo "macOS — Intel" ;;
    *-Linux.AppImage) echo "Linux — AppImage (any distribution, updates itself)" ;;
    *-Linux-Debian-Ubuntu.deb) echo "Linux — .deb package (Debian, Ubuntu)" ;;
    *) echo "Not an installer: read by the app to update itself ($1)" ;;
  esac
}

installers=(
  "Trophy-Tracker-$version-Windows.exe"
  "Trophy-Tracker-$version-macOS-arm64.dmg"
  "Trophy-Tracker-$version-macOS-x64.dmg"
  "Trophy-Tracker-$version-Linux.AppImage"
  "Trophy-Tracker-$version-Linux-Debian-Ubuntu.deb"
)
for installer in "${installers[@]}"; do
  [ -f "$dir/$installer" ] || { echo "Missing installer: $installer" >&2; exit 1; }
done

assets=()
for file in "$dir"/*; do
  name=$(basename "$file")
  assets+=("$file#$(label_of "$name")")
done

notes="## Which file to download

| System | File |
| --- | --- |
| Windows | [${installers[0]}]($download/${installers[0]}) |
| macOS, Apple Silicon (M1 or newer) | [${installers[1]}]($download/${installers[1]}) |
| macOS, Intel | [${installers[2]}]($download/${installers[2]}) |
| Linux, any distribution | [${installers[3]}]($download/${installers[3]}) |
| Linux, Debian and Ubuntu | [${installers[4]}]($download/${installers[4]}) |

The other files listed below are not installers: the installed app reads them to update itself.
"

if [ -n "${DRY_RUN:-}" ]; then
  printf '%s\n' "${assets[@]}"
  printf '\n%s\n' "$notes"
  exit 0
fi

gh release create "$tag" "${assets[@]}" \
  --repo "$GITHUB_REPOSITORY" \
  --title "Trophy Tracker $version" \
  --notes "$notes" \
  --generate-notes
