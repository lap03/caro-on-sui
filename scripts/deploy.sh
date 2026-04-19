#!/bin/bash
set -e

echo "🔨 Building Move package..."
cd packages/move
sui move build

echo "🧪 Running tests..."
sui move test

echo "🚀 Deploying to testnet..."
RESULT=$(sui client publish --gas-budget 500000000 --json)

PACKAGE_ID=$(echo $RESULT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
echo ""
echo "✅ Deployed successfully!"
echo "📦 Package ID: $PACKAGE_ID"
echo ""
echo "Update apps/web/.env (and your Vercel project env) with:"
echo "  NEXT_PUBLIC_PACKAGE_ID=$PACKAGE_ID"
echo "  PACKAGE_ID=$PACKAGE_ID            # server-only, for app/api/sponsor allowlist"
echo ""
echo "Look for the Leaderboard shared object in the output above and set:"
echo "  NEXT_PUBLIC_LEADERBOARD_ID=<object_id>"
