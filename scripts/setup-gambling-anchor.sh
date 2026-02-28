#!/usr/bin/env bash
# One-time Anchor setup for the gambling app. Uses your default Solana wallet
# (~/.config/solana/id.json or ANCHOR_WALLET) — no separate house keypair.
#
# Run from repo root: npm run setup:gambling
# Prerequisites: Anchor CLI, Solana CLI, ~2 SOL on devnet for deploy + pool funding.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/packages/solana"

# Resolve wallet: Anchor's default
WALLET_PATH="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
# Expand ~ in path
[[ "$WALLET_PATH" == ~* ]] && WALLET_PATH="${WALLET_PATH/#\~/$HOME}"

echo "=== Gambling App — Anchor Setup (no house keypair) ==="
echo ""

# 1. Check wallet
WALLET=$(solana address --keypair "$WALLET_PATH" 2>/dev/null || true)
if [ -z "$WALLET" ]; then
  echo "Error: No wallet found at $WALLET_PATH"
  echo ""
  echo "Create one with: solana-keygen new"
  echo "Or set: export ANCHOR_WALLET=/path/to/your-keypair.json"
  exit 1
fi

echo "Using wallet: $WALLET"
echo ""

# 2. Sync program keys (ensures declare_id matches target/deploy/gambling-keypair.json)
echo "Syncing program keys..."
anchor keys sync

PROGRAM_ID=$(anchor keys list 2>/dev/null | grep gambling | awk '{print $2}')
if [ -z "$PROGRAM_ID" ]; then
  echo "Error: Could not get program ID. Run 'anchor build' first."
  exit 1
fi

echo "Program ID: $PROGRAM_ID"
echo ""

# 3. Build
echo "Building program..."
anchor build

# 4. Check balance
BALANCE=$(solana balance "$WALLET" --url https://api.devnet.solana.com 2>/dev/null | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL (need ~2 SOL for deploy + pool funding)"
echo ""

read -p "Deploy program to devnet and initialize pool? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Skipped. Run manually:"
  echo "  cd packages/solana && anchor deploy --provider.cluster devnet"
  echo "  npm run pool:init"
  echo "  npm run pool:fund -- 200000000"
  exit 0
fi

# 5. Deploy (fresh deploy, not upgrade)
echo "Deploying program..."
ANCHOR_WALLET="$WALLET_PATH" anchor deploy --provider.cluster devnet

# 6. Copy IDL
echo ""
echo "Copying IDL to web app..."
cp target/idl/gambling.json "$REPO_ROOT/apps/web/lib/gambling-idl.json"

# 7. Initialize pool
echo ""
echo "Initializing pool..."
cd "$REPO_ROOT/packages/solana"
ANCHOR_WALLET="$WALLET_PATH" GAMBLING_PROGRAM_ID="$PROGRAM_ID" \
  ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
  npm run pool:init

# 8. Fund pool (0.2 SOL default)
FUND_AMOUNT="${1:-200000000}"
echo ""
echo "Funding pool with $FUND_AMOUNT lamports..."
ANCHOR_WALLET="$WALLET_PATH" GAMBLING_PROGRAM_ID="$PROGRAM_ID" \
  ANCHOR_PROVIDER_URL="https://api.devnet.solana.com" \
  npm run pool:fund -- "$FUND_AMOUNT"

# 9. Update .env.local
ENV_FILE="$REPO_ROOT/apps/web/.env.local"
mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

# Update or add vars (preserve others). Portable sed for macOS/Linux.
update_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    fi
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

update_env "NEXT_PUBLIC_GAMBLING_PROGRAM_ID" "$PROGRAM_ID"
update_env "NEXT_PUBLIC_POOL_AUTHORITY_PUBKEY" "$WALLET"
update_env "NEXT_PUBLIC_SOLANA_RPC_URL" "https://api.devnet.solana.com"

# Remove legacy house key if present
if grep -q "HOUSE_SECRET_KEY_JSON" "$ENV_FILE" 2>/dev/null; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' '/^HOUSE_SECRET_KEY_JSON/d' "$ENV_FILE"
  else
    sed -i '/^HOUSE_SECRET_KEY_JSON/d' "$ENV_FILE"
  fi
fi

echo ""
echo "=== Done ==="
echo ""
echo "Updated apps/web/.env.local:"
echo "  NEXT_PUBLIC_GAMBLING_PROGRAM_ID=$PROGRAM_ID"
echo "  NEXT_PUBLIC_POOL_AUTHORITY_PUBKEY=$WALLET"
echo ""
echo "Start the app: npm run dev"
