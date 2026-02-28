#!/usr/bin/env bash
# Deploy or upgrade the gambling program on devnet.
# Uses Anchor's wallet: ANCHOR_WALLET or ~/.config/solana/id.json.
# For fresh deploy: run npm run setup:gambling instead.
# For upgrade: your wallet must be the program's upgrade authority.

set -e
cd "$(dirname "$0")/../packages/solana"

echo "Building program..."
anchor build

# Program ID from Anchor (keys sync / Anchor.toml)
PROGRAM_ID=$(anchor keys list 2>/dev/null | grep gambling | awk '{print $2}' || grep -A1 'programs.devnet' Anchor.toml | grep gambling | head -1 | sed 's/.*= "\([^"]*\)".*/\1/')
if [ -z "$PROGRAM_ID" ]; then
  PROGRAM_ID=$(grep 'gambling = ' Anchor.toml | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
fi

# Resolve wallet
WALLET_PATH="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
[[ "$WALLET_PATH" == ~* ]] && WALLET_PATH="${WALLET_PATH/#\~/$HOME}"

WALLET=$(solana address --keypair "$WALLET_PATH" 2>/dev/null || true)
if [ -z "$WALLET" ]; then
  echo "Error: Could not read wallet from $WALLET_PATH"
  echo "Create one: solana-keygen new"
  echo "Or set: export ANCHOR_WALLET=/path/to/keypair.json"
  exit 1
fi

echo ""
echo "Program ID: $PROGRAM_ID"
echo "Wallet: $WALLET"
echo ""

# Check if program exists on-chain
PROG_INFO=$(solana program show "$PROGRAM_ID" --url https://api.devnet.solana.com 2>/dev/null || true)
if echo "$PROG_INFO" | grep -q "Program Id"; then
  echo "Program exists. Performing upgrade..."
  ANCHOR_WALLET="$WALLET_PATH" anchor upgrade target/deploy/gambling.so --program-id "$PROGRAM_ID" --provider.cluster devnet
else
  echo "Program not deployed. Performing fresh deploy..."
  ANCHOR_WALLET="$WALLET_PATH" anchor deploy --provider.cluster devnet
fi

echo ""
echo "Copying IDL to web app..."
cp target/idl/gambling.json ../../apps/web/lib/gambling-idl.json
echo "Done."
