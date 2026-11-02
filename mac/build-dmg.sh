#!/bin/sh
# TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
# Creates dist/DenaDesk-<version>-<arch>.dmg from dist/DenaDesk.app (npm run dmg), named after
# the app inside it like the other platforms' downloads: DenaDesk-2.3.0-arm64.dmg (Apple silicon)
# or DenaDesk-2.3.0-x64.dmg (Intel), the words the updater tells them apart by (shared/updates.js
# pickAsset, which takes only DenaDesk-named files). A name as the argument instead: ./build-dmg.sh Other.dmg.
# Its volume is "DenaDesk <version>", so an older one still mounted isn't the one that opens.
# The app and an Applications link over the hand-drawn background in dmg/ (dmg/make-background.sh
# renders it); the window layout is written by dmgbuild, installed once into dist/.dmgbuild (needs python3).
set -e
cd "$(dirname "$0")"

APP="dist/DenaDesk.app"
if [ ! -d "$APP" ]; then
  echo "Error: $APP not found. Run ./build-app.sh first." >&2
  exit 1
fi

# The version and architecture of the app that was built (build-app.sh x64 / arm64).
VER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist" 2>/dev/null \
  || node -p "require('./package.json').version")"
ARCH="$(lipo -archs "$APP/Contents/MacOS/DenaDesk")"
case "$ARCH" in
  x86_64) ARCH=x64 ;;
  arm64) ;;
  *) echo "Error: $APP is '$ARCH', not one architecture (build-app.sh x64 or arm64)." >&2; exit 2 ;;
esac
DMG_NAME=${1:-DenaDesk-$VER-$ARCH.dmg}
case "$DMG_NAME" in
  */*) DMG="$DMG_NAME" ;;
  *) DMG="dist/$DMG_NAME" ;;
esac
VOLNAME="DenaDesk $VER"
VENV="dist/.dmgbuild"

if [ ! -x "$VENV/bin/dmgbuild" ]; then
  echo "Installing dmgbuild into $VENV..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --disable-pip-version-check dmgbuild
fi

echo "Creating disk image $DMG..."
rm -f "$DMG"
"$VENV/bin/dmgbuild" -s dmg/settings.py \
  -D app="$APP" -D icon=dist/DenaDesk.icns -D background=dmg/background.tiff \
  "$VOLNAME" "$DMG"

echo "DMG created successfully: $DMG"
ls -lh "$DMG"

# Developer ID signing & Apple Notarization (optional, avoids Gatekeeper quarantine)
if [ -n "$MAC_IDENTITY" ]; then
  echo "Signing $DMG with Developer ID: $MAC_IDENTITY..."
  codesign --force --sign "$MAC_IDENTITY" --timestamp "$DMG"
fi

# Notarised only when it was signed above: Apple turns down an unsigned (or ad-hoc signed) disk image.
if [ -z "$MAC_IDENTITY" ]; then
  if [ -n "$APPLE_ID$APPLE_APP_SPECIFIC_PASSWORD$APPLE_TEAM_ID$APPLE_KEYCHAIN_PROFILE" ]; then
    echo "Not notarising $DMG: no MAC_IDENTITY (Developer ID) to sign it with."
  fi
elif [ -n "$APPLE_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ] && [ -n "$APPLE_TEAM_ID" ]; then
  echo "Submitting $DMG to Apple Notary Service..."
  xcrun notarytool submit "$DMG" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
  echo "Stapling notarization ticket to $DMG..."
  xcrun stapler staple "$DMG"
  echo "Successfully notarized and stapled! Gatekeeper quarantine will not block this DMG."
elif [ -n "$APPLE_KEYCHAIN_PROFILE" ]; then
  echo "Submitting $DMG to Apple Notary Service using keychain profile '$APPLE_KEYCHAIN_PROFILE'..."
  xcrun notarytool submit "$DMG" \
    --keychain-profile "$APPLE_KEYCHAIN_PROFILE" \
    --wait
  echo "Stapling notarization ticket to $DMG..."
  xcrun stapler staple "$DMG"
  echo "Successfully notarized and stapled! Gatekeeper quarantine will not block this DMG."
fi
