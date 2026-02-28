#!/usr/bin/env bash
# Setup script for Anchor CLI and Solana toolchain
# Matches packages/solana Anchor.toml: anchor_version = "0.32.1"
# Run from repo root: ./scripts/setup-anchor.sh

set -e

ANCHOR_VERSION="0.32.1"

echo "=== Anchor & Solana Setup (Anchor ${ANCHOR_VERSION}) ==="

# 1. Rust
if ! command -v rustc &>/dev/null; then
  echo "Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  . "$HOME/.cargo/env"
else
  echo "Rust already installed: $(rustc --version)"
fi

# Ensure cargo is on PATH for this session
export PATH="$HOME/.cargo/bin:$PATH"

# 2. Solana CLI
if ! command -v solana &>/dev/null; then
  echo "Installing Solana CLI..."
  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
  echo "Solana CLI already installed: $(solana --version)"
fi

# 3. AVM (Anchor Version Manager)
if ! command -v avm &>/dev/null; then
  echo "Installing AVM..."
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
else
  echo "AVM already installed: $(avm --version)"
fi

# 4. Anchor CLI (exact version from Anchor.toml)
echo "Installing Anchor CLI ${ANCHOR_VERSION}..."
avm install "${ANCHOR_VERSION}"
avm use "${ANCHOR_VERSION}"

echo ""
echo "=== Verification ==="
anchor --version
solana --version

echo ""
echo "=== Next steps ==="
echo "1. Restart your terminal (or run: source ~/.bashrc / source ~/.zshrc)"
echo "2. Generate a wallet if needed: solana-keygen new"
echo "3. Set cluster for devnet: solana config set --url devnet"
echo "4. Airdrop devnet SOL: solana airdrop 2"
echo "5. Build Solana programs: cd packages/solana && anchor build"
echo "6. Run tests: cd packages/solana && anchor test"
echo ""
echo "Done."
