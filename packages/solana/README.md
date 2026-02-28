# @geometrydash/solana

Solana-based gambling integration for Geometry Dash with innovative "time alive" prediction mechanics.

## Overview

This package implements a provably fair, blockchain-based gambling system where players bet on how long they will survive in a Geometry Dash level. The system rewards accuracy - the closer your prediction to your actual survival time, the higher your payout multiplier.

## Directory Structure

```
packages/solana/
├── programs/                    # Anchor smart contracts
│   └── gambling/
│       ├── src/
│       │   └── lib.rs          # Main Solana program logic
│       └── Cargo.toml          # Rust dependencies
├── sdk/                        # TypeScript SDK for frontend integration
│   └── src/
│       ├── client.ts           # Main client for interacting with program
│       ├── types.ts            # TypeScript type definitions
│       └── index.ts            # Package exports
├── tests/                      # Integration tests
├── Anchor.toml                 # Anchor configuration
├── package.json               # Node.js dependencies
└── tsconfig.json              # TypeScript configuration
```

## How Time-Alive Gambling Works

### Core Mechanic

1. **Pre-Game Bet**: Before starting a level, player predicts how many milliseconds they will survive
2. **Place Bet**: Wager SOL on their prediction
3. **Play Level**: Attempt the level while the game tracks survival time
4. **Settle Bet**: After death, actual time is compared to prediction
5. **Payout**: Receive multiplier based on accuracy

### Payout Structure

The system rewards accuracy with different multipliers:

| Accuracy Range | Outcome | Multiplier | Example (0.1 SOL bet) |
|---------------|---------|------------|----------------------|
| Within 100ms  | PERFECT | 10x | 1.0 SOL payout |
| Within 500ms  | EXCELLENT | 5x | 0.5 SOL payout |
| Within 1000ms | GOOD | 2x | 0.2 SOL payout |
| Within 2000ms | BREAK_EVEN | 1x | 0.1 SOL return |
| Beyond 2000ms | LOSS | 0x | Lose bet |

All payouts are subject to a configurable house edge (default: 2-5%).

### Example Scenario

```
Player predicts: 15,000ms (15 seconds)
Actual survival: 14,800ms (14.8 seconds)
Difference: 200ms
Outcome: EXCELLENT (within 500ms)
Bet: 0.1 SOL
Gross Payout: 0.5 SOL (5x multiplier)
House Edge (3%): 0.015 SOL
Net Payout: 0.485 SOL
Profit: 0.385 SOL
```

## Smart Contract Architecture

### Accounts

#### Pool
- **Purpose**: Manages gambling parameters and liquidity
- **Fields**:
  - `authority`: Pool creator/manager
  - `min_bet`: Minimum bet amount
  - `max_bet`: Maximum bet amount
  - `house_edge`: Fee percentage (basis points)
  - `total_wagered`: Lifetime wagers
  - `total_paid_out`: Lifetime payouts

#### Bet
- **Purpose**: Tracks individual player bets
- **Fields**:
  - `player`: Wallet placing bet
  - `pool`: Associated pool
  - `amount`: Wager size
  - `predicted_time_alive`: Predicted survival (ms)
  - `actual_time_alive`: Actual survival (ms)
  - `settled`: Whether bet has been resolved
  - `won`: Win/loss status
  - `payout`: Amount won
  - `timestamp`: When bet was placed

### Instructions

#### `initialize_pool`
Creates a new gambling pool with bet limits and house edge.

#### `place_bet`
Records player's prediction and locks their SOL wager.

#### `settle_bet`
Compares actual vs predicted time, calculates payout, and transfers winnings.

## SDK Usage

### Installation

```bash
cd packages/solana
npm install
```

### Basic Usage

```typescript
import { GamblingClient } from '@geometrydash/solana';
import { Connection, PublicKey } from '@solana/web3.js';

// Initialize client
const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
const client = new GamblingClient(connection, wallet, programId, idl);

// Initialize pool (one-time setup)
await client.initializePool({
  minBet: client.solToLamports(0.01),    // 0.01 SOL min
  maxBet: client.solToLamports(10),      // 10 SOL max
  houseEdge: 300,                         // 3% house edge
});

// Place bet before game starts
const [poolPDA] = await client.getPoolPDA(authority);
await client.placeBet(poolPDA, {
  betAmount: client.solToLamports(0.1),
  predictedTimeAlive: 15000,              // Predict 15 seconds
});

// After game ends, settle bet
await client.settleBet(poolPDA, {
  actualTimeAlive: 14800,                 // Actually survived 14.8 seconds
});

// Check results
const [betPDA] = await client.getBetPDA(poolPDA, playerWallet);
const bet = await client.getBet(betPDA);
console.log(`Won: ${bet.won}, Payout: ${client.lamportsToSol(bet.payout)} SOL`);
```

### Frontend Integration

The SDK provides a clean interface for React/Next.js integration:

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { GamblingClient } from '@geometrydash/solana';

function GameComponent() {
  const wallet = useWallet();
  const [prediction, setPrediction] = useState(10000);
  const [betAmount, setBetAmount] = useState(0.1);

  const placeBet = async () => {
    const client = new GamblingClient(connection, wallet, programId, idl);
    await client.placeBet(poolPDA, {
      betAmount: client.solToLamports(betAmount),
      predictedTimeAlive: prediction,
    });
  };

  // ... rest of component
}
```

## Development

### Build Program

```bash
npm run build
```

### Run Tests

```bash
npm run test
```

### Deploy

```bash
# Devnet
npm run deploy:devnet

# Mainnet (be careful!)
npm run deploy:mainnet
```

## Security Considerations

1. **Bet Settlement**: Only the player who placed the bet can settle it
2. **Double Spending**: Bets can only be settled once
3. **Validation**: All bets are validated against pool min/max limits
4. **PDA Security**: Uses Program Derived Addresses for trustless escrow
5. **Oracle Problem**: Actual time must be submitted by player (consider adding verification)

## Future Enhancements

- **Leaderboards**: Track top predictors on-chain
- **Tournaments**: Pooled competitions with prize pools
- **Oracle Integration**: Chainlink or similar for verifiable game state
- **NFT Badges**: Reward consistent winners with achievement NFTs
- **Social Features**: Share predictions, challenge friends
- **Multi-Level Betting**: Different pools for different difficulty levels
- **LP Tokens**: Allow liquidity providers to earn from house edge

## License

MIT
