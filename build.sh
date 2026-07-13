#!/bin/bash
# Build script for Render and other cloud platforms

echo "📦 Installing dependencies..."
npm install

echo "📥 Installing yt-dlp..."
# Try pip first (Render has Python available)
if command -v pip &> /dev/null; then
  pip install --upgrade yt-dlp
  echo "✅ yt-dlp installed via pip"
elif command -v pip3 &> /dev/null; then
  pip3 install --upgrade yt-dlp
  echo "✅ yt-dlp installed via pip3"
else
  # Direct download as fallback
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp
  chmod +x ./yt-dlp
  echo "✅ yt-dlp downloaded directly"
fi

echo "✅ Build complete!"
