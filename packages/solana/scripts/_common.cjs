const fs = require('fs');
const os = require('os');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');

const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';
const DEFAULT_WALLET_PATH = '~/.config/solana/id.json';

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function parseU64String(raw, fieldName) {
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${fieldName} must be a non-negative integer string (lamports)`);
  }
  return raw;
}

function loadIdl() {
  const candidatePaths = [
    path.resolve(__dirname, '../target/idl/gambling.json'),
    path.resolve(__dirname, '../../../apps/web/lib/gambling-idl.json'),
  ];

  for (const idlPath of candidatePaths) {
    if (fs.existsSync(idlPath)) {
      return JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    }
  }

  throw new Error(
    `IDL not found. Checked: ${candidatePaths.join(', ')}. Run \`anchor build\` or copy IDL to apps/web/lib/gambling-idl.json.`,
  );
}

function loadWalletKeypair() {
  const walletPath = expandHome(process.env.ANCHOR_WALLET || process.env.SOLANA_KEYPAIR_PATH || DEFAULT_WALLET_PATH);
  const raw = fs.readFileSync(walletPath, 'utf8');
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

function buildProgram() {
  const idl = loadIdl();
  const programId = new PublicKey(process.env.GAMBLING_PROGRAM_ID || idl.address);
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL;
  const keypair = loadWalletKeypair();
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  const program = new anchor.Program(idl, provider);

  return { anchor, program, provider, programId, authority: wallet.publicKey, rpcUrl };
}

function derivePoolPda(authority, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), authority.toBuffer()],
    programId,
  )[0];
}

function deriveVaultPda(pool, programId) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), pool.toBuffer()],
    programId,
  )[0];
}

function resolveMethod(methods, camelName, snakeName) {
  const method = methods[camelName] || methods[snakeName];
  if (!method) {
    const available = Object.keys(methods).join(', ');
    throw new Error(`Could not find method ${camelName}/${snakeName}. Available methods: ${available}`);
  }
  return method;
}

module.exports = {
  parseU64String,
  buildProgram,
  derivePoolPda,
  deriveVaultPda,
  resolveMethod,
};
