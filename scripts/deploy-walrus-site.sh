#!/bin/bash
set -e

echo "🔨 Building frontend..."
cd apps/web
bun run build

echo "🌐 Deploying to Walrus Sites..."
site-builder --context=testnet deploy ./dist --epochs 50

echo "✅ Done! Site is live on Walrus."
