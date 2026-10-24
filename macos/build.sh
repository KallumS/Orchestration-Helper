#!/bin/bash
# Builds "Orchestration Helper.app" (Apple Silicon and Intel in one) into
# build/. Needs macOS with the Xcode command-line tools; fetches Lua 5.4 from
# its GitHub mirror the first time. The script and both databases are copied
# into the app unchanged, so the app and the ReaScript are the same program.
set -euo pipefail
cd "$(dirname "$0")/.."

LUA_TAG=v5.4.7
VERSION="${VERSION:-1.0}"
APP="build/Orchestration Helper.app"

mkdir -p build
if [ ! -f build/lua/onelua.c ]; then
  rm -rf build/lua
  git clone --quiet --depth 1 --branch "$LUA_TAG" https://github.com/lua/lua.git build/lua
fi

FLAGS=(-O2 -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 -Wall)
clang "${FLAGS[@]}" -DLUA_USE_POSIX -DMAKE_LIB -w -c build/lua/onelua.c -o build/lua.o
clang "${FLAGS[@]}" -Ibuild/lua -c macos/host.c -o build/host.o
clang "${FLAGS[@]}" -fobjc-arc -Ibuild/lua -c macos/mac.m -o build/mac.o

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
clang "${FLAGS[@]}" build/mac.o build/host.o build/lua.o \
  -framework Cocoa -framework CoreText \
  -o "$APP/Contents/MacOS/Orchestration Helper"

sed "s/VERSION/$VERSION/g" macos/Info.plist > "$APP/Contents/Info.plist"
cp "Orchestration Helper.lua" orchestration_data.lua orchestration_composers.lua \
   "$APP/Contents/Resources/"
cp macos/AppIcon.icns "$APP/Contents/Resources/" 2>/dev/null || true

# No Apple developer account: sign it ad hoc, which Apple Silicon requires to
# run it at all. The first open needs Control-click > Open (see README).
codesign --force --deep --sign - "$APP"
echo "built $APP"
