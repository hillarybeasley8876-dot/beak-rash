#!/bin/bash
# Build the game and wrap it in a standalone macOS app (Electron runtime from desktop/electron).
# Usage: tools/package-desktop.sh [--no-build] [--install]   (--install copies the app to ~/Desktop)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
[ -d desktop/electron/Electron.app ] || { echo "missing desktop/electron/Electron.app (see desktop/dl.log)"; exit 1; }
[[ " $* " == *" --no-build "* ]] || npm run build
OUT="$ROOT/desktop/build"
APP="$OUT/暴力鹈鹕.app"
rm -rf "$APP" && mkdir -p "$OUT"
cp -R desktop/electron/Electron.app "$APP"
RES="$APP/Contents/Resources"
rm -f "$RES/default_app.asar"
mkdir -p "$RES/app"
cp desktop/main.cjs desktop/package.json "$RES/app/"
cp -R dist "$RES/app/dist"
PL="$APP/Contents/Info.plist"
plutil -replace CFBundleName -string "暴力鹈鹕" "$PL"
plutil -replace CFBundleDisplayName -string "暴力鹈鹕" "$PL"
plutil -replace CFBundleIdentifier -string "local.beakrash.game" "$PL"
plutil -replace CFBundleShortVersionString -string "$(node -p "require('./package.json').version")" "$PL"
if [ -f desktop/icon.icns ]; then cp desktop/icon.icns "$RES/electron.icns"; fi
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || echo "warning: ad-hoc codesign failed"
echo "built $APP ($(du -sh "$APP" | cut -f1))"
if [[ " $* " == *" --install "* ]]; then
  rm -rf "$HOME/Desktop/暴力鹈鹕.app"
  cp -R "$APP" "$HOME/Desktop/暴力鹈鹕.app"
  echo "installed ~/Desktop/暴力鹈鹕.app"
fi
