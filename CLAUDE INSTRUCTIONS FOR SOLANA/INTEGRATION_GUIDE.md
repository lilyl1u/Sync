
SOLANA INTEGRATION GUIDE

OVERVIEW
This folder contains plug‑and‑play Solana payment logic for a game.
It handles:
- wallet connect
- buy‑in transfer
- payout transfer
- token balance check

You only connect your game logic to 2 functions:
    buyIn()
    POST /api/settle

--------------------------------------------------

STEP 1 — INSTALL DEPENDENCIES

npm install @solana/web3.js @solana/wallet-adapter-react
npm install @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
npm install @solana/spl-token bs58

--------------------------------------------------

STEP 2 — ENV SETUP

Rename:
.env.example → .env.local

Fill values:

RPC
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

TOKEN
NEXT_PUBLIC_GAME_TOKEN_MINT=<mint address>

BUYIN
NEXT_PUBLIC_BUYIN_BASE_UNITS=5000000

HOUSE WALLET
HOUSE_SECRET_KEY_JSON=[secret array]
NEXT_PUBLIC_HOUSE_PUBKEY=<public key>

--------------------------------------------------

STEP 3 — WHERE FILES GO

Copy folders into project root:

/lib → your project /lib
/app/api/settle → your app/api/settle

--------------------------------------------------

STEP 4 — ADD WALLET PROVIDER

Wrap root layout:

<SolanaProviders>
   {children}
</SolanaProviders>

--------------------------------------------------

STEP 5 — START GAME FLOW

When player clicks Start:

const sig = await buyIn({connection, wallet})

IF SUCCESS:
start game timer

--------------------------------------------------

STEP 6 — END GAME FLOW

When player dies:

await fetch("/api/settle", {
 method:"POST",
 body: JSON.stringify({
   playerPubkey,
   durationSeconds
 })
})

Server sends payout.

--------------------------------------------------

ARCHITECTURE

Frontend
    handles gameplay + UI

Solana
    handles money only

Backend
    calculates payout

--------------------------------------------------

COMMON ERRORS

Wallet not connected
→ connect Phantom

Token account missing
→ send tokens once manually

Transaction fails
→ airdrop SOL

--------------------------------------------------

SECURITY (hackathon level)

Do NOT:
commit .env.local

OK for demo:
server holds house wallet

--------------------------------------------------

DONE

If buy‑in works and payout works,
integration is complete.
