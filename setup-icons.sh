#!/bin/bash

mkdir -p src-tauri/icons

curl -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/icon.png" -o src-tauri/icons/icon.png
curl -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/32x32.png" -o src-tauri/icons/32x32.png
curl -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/128x128.png" -o src-tauri/icons/128x128.png
curl -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/128x128@2x.png" -o src-tauri/icons/128x128@2x.png
curl -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/icon.icns" -o src-tauri/icons/icon.icns
curl -L "https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/icon.ico" -o src-tauri/icons/icon.ico

echo "✅ Icons downloaded successfully!"