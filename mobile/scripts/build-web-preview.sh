#!/usr/bin/env bash
#
# Builds the mobile app for the browser and drops it into the website's
# public/app/, so it can be opened at <site>/app/ on a phone -- the real app,
# real data, no install and no app store account.
#
# Deliberately built with no project values baked in: the bundle is committed,
# and the page pulls its config from /app-config.js at load time instead.
#
#   ./scripts/build-web-preview.sh

set -euo pipefail

MOBILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$MOBILE/../public/app"
BUILD="$MOBILE/.web-preview"

cd "$MOBILE"

echo "Bundling the app for the browser…"
rm -rf "$BUILD"
# EXPO_WEB_BASE_URL makes the export prefix every bundle and asset URL with
# /app, which is what lets it be served from a subpath rather than the root.
CI=1 EXPO_NO_TELEMETRY=1 EXPO_WEB_BASE_URL=/app \
  npx expo export --platform web --output-dir "$BUILD" >/dev/null

# Inject the runtime config script, and the manifest and Apple meta tags that
# let this install to an iPhone home screen as a standalone app.
python3 "$MOBILE/scripts/pwa-shell.py" "$BUILD" "$MOBILE/assets/images/icon.png"

rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -r "$BUILD/." "$TARGET/"
rm -rf "$BUILD"

echo "Preview written to public/app/ — open <site>/app/ once deployed."
du -sh "$TARGET"
