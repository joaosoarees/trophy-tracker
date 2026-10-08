#!/usr/bin/env bash
# Runs inside the container started by scripts/test-linux-package.sh.
set -e
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends xvfb xauth /pkg/*.deb >/dev/null 2>&1
echo "RESULT installed: $(dpkg -s trophy-tracker | grep -E '^Version') | launcher: $(ls /usr/share/applications | grep -i trophy)"

# A stand-in for a Steam client that has two accounts, the second one signed in.
mkdir -p ~/.local/share/Steam/config
printf '"users"\n{\n\t"76561190000000001"\n\t{\n\t\t"MostRecent"\t\t"0"\n\t}\n\t"76561198000000042"\n\t{\n\t\t"MostRecent"\t\t"1"\n\t}\n}\n' \
  > ~/.local/share/Steam/config/loginusers.vdf

(xvfb-run -a trophy-tracker --no-sandbox --disable-gpu --remote-debugging-port=9333 >/tmp/app.log 2>&1 &)
node /probe/probe.mjs || { echo "--- app log:"; tail -20 /tmp/app.log; exit 1; }
echo "RESULT data folder: $(ls ~/.config | tr '\n' ' ')"
