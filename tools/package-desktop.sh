#!/bin/bash
# Build the game and wrap it in a standalone desktop app with the Electron runtime:
#   macOS:   desktop/build/暴力鹈鹕.app      (runtime: desktop/electron/Electron.app, see desktop/dl.log)
#   Windows: desktop/build/暴力鹈鹕-win/暴力鹈鹕.exe (runtime: desktop/electron-win/, fetched from npmmirror
#            on first use into $BR_CACHE — default ../beak-rash-out — and checked against SHASUMS256)
# Usage: tools/package-desktop.sh [--no-build] [--install]   (--install copies the macOS app to ~/Desktop)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
ELECTRON_WIN=44.9.3
OUT="$ROOT/desktop/build"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) PLATFORM=win ;;
  Darwin) PLATFORM=mac ;;
  *) echo "unsupported platform $(uname -s)"; exit 1 ;;
esac

fetch_electron_win() {
  [ -f desktop/electron-win/electron.exe ] && return
  local cache="${BR_CACHE:-$ROOT/../beak-rash-out}" zip="electron-v$ELECTRON_WIN-win32-x64.zip"
  local url="https://registry.npmmirror.com/-/binary/electron/v$ELECTRON_WIN"
  mkdir -p "$cache"
  [ -f "$cache/$zip" ] || curl -fsSL -o "$cache/$zip" "$url/$zip"
  local want have
  want=$(curl -fsSL "$url/SHASUMS256.txt" | grep " \*$zip" | cut -d' ' -f1)
  have=$(sha256sum "$cache/$zip" | cut -d' ' -f1)
  [ -n "$want" ] && [ "$want" = "$have" ] || { echo "electron zip checksum mismatch ($have vs $want)"; exit 1; }
  rm -rf desktop/electron-win
  python -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$cache/$zip" desktop/electron-win
}

if [ "$PLATFORM" = mac ]; then
  [ -d desktop/electron/Electron.app ] || { echo "missing desktop/electron/Electron.app (see desktop/dl.log)"; exit 1; }
else
  fetch_electron_win
fi
[[ " $* " == *" --no-build "* ]] || npm run build
mkdir -p "$OUT"

if [ "$PLATFORM" = win ]; then
  APP="$OUT/暴力鹈鹕-win"
  rm -rf "$APP"
  cp -R desktop/electron-win "$APP"
  rm -f "$APP/resources/default_app.asar"
  mkdir -p "$APP/resources/app"
  cp desktop/main.cjs desktop/package.json "$APP/resources/app/"
  cp -R dist "$APP/resources/app/dist"
  mv "$APP/electron.exe" "$APP/暴力鹈鹕.exe"
  echo "built $APP/暴力鹈鹕.exe ($(du -sh "$APP" | cut -f1))"
  exit 0
fi

APP="$OUT/暴力鹈鹕.app"
rm -rf "$APP"
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
