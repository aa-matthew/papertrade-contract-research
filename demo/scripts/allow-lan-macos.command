#!/bin/zsh
# Run by the host after reviewing. Allows ONLY this API executable; leaves the
# macOS firewall enabled and Anvil, Redis and the signing engine loopback-only.
set -euo pipefail
api="${0:A:h}/../backend/target/release/robinpaper-api"
[[ -x "$api" ]] || { print 'Build the backend first: npm run build:backend --prefix demo'; exit 1; }
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$api"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$api"
/usr/libexec/ApplicationFirewall/socketfilterfw --getappblocked "$api"
print 'API permission added. Test the LAN URL from another computer on the same Wi-Fi.'
