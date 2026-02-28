#!/usr/bin/env bash
# Generate a new pool authority keypair for the gambling program.
# Use this if you need to start fresh (new program + new pool).
# The keypair will be saved to packages/solana/pool-authority-keypair.json
# IMPORTANT: Add this file to .gitignore and never commit it!

set -e
cd "$(dirname "$0")/.."

OUTPUT="${1:-packages/solana/pool-authority-keypair.json}"
mkdir -p "$(dirname "$OUTPUT")"

echo "Generating new pool authority keypair..."
solana-keygen new --no-bip39-passphrase --outfile "$OUTPUT" --force 2>/dev/null || \
  solana keygen new --no-bip39-passphrase --outfile "$OUTPUT" --force

ADDR=$(solana address -k "$OUTPUT")
echo ""
echo "Created: $OUTPUT"
echo "Address: $ADDR"
echo ""
echo "Next steps:"
echo "  1. Add pool-authority-keypair.json to .gitignore"
echo "  2. Update .env.local: NEXT_PUBLIC_POOL_AUTHORITY_PUBKEY=$ADDR"
echo "  3. For upgrades and pool scripts, point Anchor at this keypair, for example:"
echo "       export ANCHOR_WALLET=$(pwd)/$OUTPUT"
echo "     then run:"
echo "       npm run deploy:gambling"
echo "       npm run pool:init"
echo "       npm run pool:fund -- <amount_lamports>"
echo "  4. For new deployment: update declare_id and Anchor.toml [programs.*.gambling] to match your program, then run pool:init"
