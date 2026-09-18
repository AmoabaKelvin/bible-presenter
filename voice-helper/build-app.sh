#!/bin/bash
# Builds FlowCastVoice.app — the menu-bar helper users download and run.
# Apple Silicon only: it runs Parakeet on the Neural Engine through CoreML.
#
# The zip is copied into public/downloads/, which is where the app links to it:
# GitHub release assets need a login once the repo is private, and a download
# people cannot reach is worse than no button.
#
# Usage: ./build-app.sh   → FlowCastVoice.app and .zip in dist/, zip in public/
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${1:-$(date +%Y.%m.%d)}"
APP="dist/FlowCastVoice.app"

swift build -c release --arch arm64
rm -rf dist && mkdir -p "$APP/Contents/MacOS"

cp .build/arm64-apple-macosx/release/FlowCastVoice "$APP/Contents/MacOS/FlowCastVoice"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>FlowCast Voice</string>
  <key>CFBundleIdentifier</key><string>com.kelvinamoaba.flowcast.voice</string>
  <key>CFBundleExecutable</key><string>FlowCastVoice</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <!-- Menu bar only, no Dock icon or window. -->
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST

# Ad-hoc signature: without one, macOS 26 refuses to run the binary at all.
# It is not notarized, so the first launch still needs right-click -> Open.
codesign --force --deep --sign - "$APP"
ditto -c -k --keepParent "$APP" dist/FlowCastVoice.zip
mkdir -p ../public/downloads
cp dist/FlowCastVoice.zip ../public/downloads/FlowCastVoice.zip
echo "built $APP ($(du -sh "$APP" | cut -f1))"
echo "shipped ../public/downloads/FlowCastVoice.zip ($(du -h dist/FlowCastVoice.zip | cut -f1)) — commit it to publish"
