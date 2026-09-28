#!/bin/sh
# OCADE Device Agent for macOS: build, sign, notarize and staple.
#
#   OCADE_VERSION=0.2.0 \
#   OCADE_MAC_IDENTITY="Developer ID Application: CARCC (TEAMID)" \
#   OCADE_NOTARY_PROFILE=ocade-notary \
#   sh packaging/macos/build.sh
#
# OCADE_NOTARY_PROFILE is a keychain profile made once with
# `xcrun notarytool store-credentials`. Without an identity the script stops:
# an unsigned or unnotarized app is a private test artifact, never published.
set -eu
cd "$(dirname "$0")/../.."
: "${OCADE_VERSION:?set OCADE_VERSION}"
: "${OCADE_MAC_IDENTITY:?set OCADE_MAC_IDENTITY (Developer ID Application)}"
: "${OCADE_NOTARY_PROFILE:?set OCADE_NOTARY_PROFILE (notarytool keychain profile)}"

pyinstaller --noconfirm packaging/ocade-agent.spec
APP="dist/OCADE Device Agent.app"
rm -rf "$APP" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp -R dist/ocade-agent/. "$APP/Contents/MacOS/"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>in.ocade.agent</string>
  <key>CFBundleName</key><string>OCADE Device Agent</string>
  <key>CFBundleExecutable</key><string>ocade-agent</string>
  <key>CFBundleShortVersionString</key><string>${OCADE_VERSION}</string>
  <key>CFBundleVersion</key><string>${OCADE_VERSION}</string>
  <key>LSUIElement</key><true/>
  <key>NSAppleEventsUsageDescription</key><string>OCADE JARVIS opens and controls apps only when you ask it to.</string>
  <key>NSMicrophoneUsageDescription</key><string>OCADE listens for "Hey OCADE" on this Mac only while Background/Wake Mode is on. Audio stays on this Mac until the phrase is heard.</string>
</dict></plist>
PLIST
codesign --force --deep --options runtime --timestamp \
  --entitlements packaging/macos/entitlements.plist --sign "$OCADE_MAC_IDENTITY" "$APP"
ditto -c -k --keepParent "$APP" "dist/OCADE-Device-Agent-$OCADE_VERSION.zip"
xcrun notarytool submit "dist/OCADE-Device-Agent-$OCADE_VERSION.zip" \
  --keychain-profile "$OCADE_NOTARY_PROFILE" --wait
xcrun stapler staple "$APP"
ditto -c -k --keepParent "$APP" "dist/OCADE-Device-Agent-$OCADE_VERSION-macos.zip"
echo "Signed and notarized: dist/OCADE-Device-Agent-$OCADE_VERSION-macos.zip"
