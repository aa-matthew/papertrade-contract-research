#!/bin/zsh
set -eu
cd "$(dirname "$0")/.."
npm run up --prefix demo
for attempt in {1..60}; do
  if curl --fail --silent http://127.0.0.1:4173/api/showcase >/dev/null; then
    npm run check --prefix demo
    echo 'Showcase ready: http://127.0.0.1:4173/#showcase'
    open 'http://127.0.0.1:4173/#showcase'
    exit 0
  fi
  sleep 1
done
echo 'Startup timed out. Inspect demo/.runtime/service.local.log'
exit 1
