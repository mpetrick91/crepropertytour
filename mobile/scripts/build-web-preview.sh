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

# The Supabase client is constructed while the bundle evaluates, so its config
# has to be in place before the bundle runs.
python3 - "$BUILD/index.html" <<'PY'
import re, sys, pathlib

page = pathlib.Path(sys.argv[1])
html = page.read_text()

if '/app-config.js' not in html:
    html, count = re.subn(
        r'(<script[^>]*src="/app/_expo/)',
        r'<script src="/app-config.js"></script>\1',
        html,
        count=1,
    )
    if count != 1:
        raise SystemExit('could not find the bundle script tag to inject before')

page.write_text(html)
print('injected /app-config.js ahead of the bundle')
PY

rm -rf "$TARGET"
mkdir -p "$TARGET"
cp -r "$BUILD/." "$TARGET/"
rm -rf "$BUILD"

echo "Preview written to public/app/ — open <site>/app/ once deployed."
du -sh "$TARGET"
