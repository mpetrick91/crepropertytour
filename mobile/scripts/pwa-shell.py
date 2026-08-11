"""
Turns the exported browser bundle into something an iPhone can install to the
home screen.

Without this, Add to Home Screen produces a Safari bookmark: it opens in the
browser with the address bar, and loses its place every time. With a manifest
and the Apple meta tags it launches standalone, full screen, with its own icon
and its own task-switcher card -- close enough to the real app to test with.

Run from build-web-preview.sh, against the export directory.
"""

import json
import pathlib
import re
import shutil
import sys

BUILD = pathlib.Path(sys.argv[1])
ICON_SOURCE = pathlib.Path(sys.argv[2])

page = BUILD / "index.html"
html = page.read_text()

# The Supabase client is constructed while the bundle evaluates, so its config
# has to be in place before the bundle runs.
if "/app-config.js" not in html:
    html, count = re.subn(
        r'(<script[^>]*src="/app/_expo/)',
        r'<script src="/app-config.js"></script>\1',
        html,
        count=1,
    )
    if count != 1:
        raise SystemExit("could not find the bundle script tag to inject before")

# status-bar-style `default` keeps the web view below the status bar, so
# content never sits under the notch -- which matters because the safe-area
# insets React Native relies on are not reliable in a standalone web view.
head_additions = """
    <link rel="manifest" href="/app/manifest.webmanifest" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Property Tour" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#14304f" />
    <link rel="apple-touch-icon" href="/app/icon.png" />
"""

if "manifest.webmanifest" not in html:
    html = html.replace("</head>", f"{head_additions}  </head>", 1)

# Safari ignores viewport-fit unless it is on the existing viewport tag.
html = re.sub(
    r'(<meta name="viewport" content="[^"]*)"',
    r'\1, viewport-fit=cover"',
    html,
    count=1,
)

page.write_text(html)

manifest = {
    "name": "CRE Property Tour",
    "short_name": "Property Tour",
    "description": "Run a property tour and collect client feedback in one place.",
    "start_url": "/app/",
    "scope": "/app/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#ffffff",
    "theme_color": "#14304f",
    "icons": [
        {"src": "/app/icon.png", "sizes": "1024x1024", "type": "image/png"},
        {
            "src": "/app/icon.png",
            "sizes": "1024x1024",
            "type": "image/png",
            "purpose": "maskable",
        },
    ],
}

(BUILD / "manifest.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n")
shutil.copy(ICON_SOURCE, BUILD / "icon.png")

print("added manifest, apple-touch-icon and standalone meta tags")
