import { Buffer } from "buffer";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { SOLANA_RPC_URL, USDC_MINT, WSOL_MINT } from "./config";
import { fetchWalletBalances, signAndSendWalletTransaction, type WalletSession } from "./wallet";
import { isSolanaAddress } from "./solana";

export type TransferAsset = "usdc" | "sol";

export type TransferBalances = {
  usdc: number;
  sol: number;
  solPriceUsd: number;
  /** Preferred spendable USD-like balance for the withdraw/send UIs. */
  availableUsd: number;
  asset: TransferAsset;
};

const SOL_FEE_BUFFER = 0.005;

function connection() {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

function toBase64(tx: VersionedTransaction) {
  return Buffer.from(tx.serialize()).toString("base64");
}

async function buildVersionedTx(payer: PublicKey, instructions: TransactionInstruction[]) {
  const conn = connection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

export async function fetchTransferBalances(walletAddress: string): Promise<TransferBalances> {
  const empty: TransferBalances = {
    usdc: 0,
    sol: 0,
    solPriceUsd: 0,
    availableUsd: 0,
    asset: "usdc",
  };
  if (!isSolanaAddress(walletAddress)) return empty;

  try {
    const balances = await fetchWalletBalances(walletAddress, USDC_MINT);
    const pay = balances.pay ?? [];
    const usdcRow =
      pay.find((row) => row.mint === USDC_MINT) ||
      (balances.token?.symbol?.toUpperCase() === "USDC"
        ? { amount: balances.token.amount || "0" }
        : null);
    const solRow = pay.find((row) => row.mint === WSOL_MINT || row.symbol?.toUpperCase() === "SOL");

    let usdc = Number(usdcRow?.amount || 0);
    let sol = Number(solRow?.amount || 0);

    // Fallback to RPC if API omits native SOL / USDC.
    if (!(usdc > 0) || !(sol > 0)) {
      const conn = connection();
      if (!(sol > 0)) {
        const lamports = await conn.getBalance(new PublicKey(walletAddress), "confirmed");
        sol = lamports / LAMPORTS_PER_SOL;
      }
      if (!(usdc > 0)) {
        try {
          const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT), new PublicKey(walletAddress));
          const info = await conn.getTokenAccountBalance(ata, "confirmed");
          usdc = Number(info.value.uiAmount || 0);
        } catch {
          /* no USDC ATA */
        }
      }
    }

    // Price: prefer SOL quote from pay list heuristics, else market endpoint.
    let solPriceUsd = 0;
    try {
      const { apiGet } = await import("./api");
      const market = await apiGet<{ priceUsd?: number }>("/api/dex/market", { mint: WSOL_MINT });
      solPriceUsd = Number(market.priceUsd || 0);
    } catch {
      solPriceUsd = 0;
    }

    const usdcUsd = Math.max(0, usdc);
    const solUsd = solPriceUsd > 0 ? Math.max(0, sol) * solPriceUsd : 0;

    // Prefer USDC for $-denominated withdraw/send; else SOL valued in USD.
    if (usdcUsd >= 0.01) {
      return { usdc, sol, solPriceUsd, availableUsd: usdcUsd, asset: "usdc" };
    }
    return {
      usdc,
      sol,
      solPriceUsd,
      availableUsd: solUsd,
      asset: "sol",
    };
  } catch {
    return empty;
  }
}

export async function buildSolTransfer(input: {
  from: string;
  to: string;
  /** Human SOL amount */
  amountSol: number;
}) {
  if (!isSolanaAddress(input.from) || !isSolanaAddress(input.to)) {
    throw new Error("Invalid Solana address");
  }
  if (!(input.amountSol > 0)) throw new Error("Enter an amount above zero");

  const from = new PublicKey(input.from);
  const to = new PublicKey(input.to);
  const lamports = Math.round(input.amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) throw new Error("Amount too small");

  const tx = await buildVersionedTx(from, [
    SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }),
  ]);
  return toBase64(tx);
}

export async function buildUsdcTransfer(input: {
  from: string;
  to: string;
  /** Human USDC amount */
  amountUsdc: number;
}) {
  if (!isSolanaAddress(input.from) || !isSolanaAddress(input.to)) {
    throw new Error("Invalid Solana address");
  }
  if (!(input.amountUsdc > 0)) throw new Error("Enter an amount above zero");

  const conn = connection();
  const from = new PublicKey(input.from);
  const to = new PublicKey(input.to);
  const mint = new PublicKey(USDC_MINT);
  const mintInfo = await getMint(conn, mint);
  const decimals = mintInfo.decimals;
  const raw = BigInt(Math.round(input.amountUsdc * 10 ** decimals));
  if (raw <= 0n) throw new Error("Amount too small");

  const fromAta = getAssociatedTokenAddressSync(mint, from);
  const toAta = getAssociatedTokenAddressSync(mint, to);

  const instructions = [
    createAssociatedTokenAccountIdempotentInstruction(from, toAta, to, mint),
    createTransferCheckedInstruction(fromAta, mint, toAta, from, raw, decimals),
  ];

  const tx = await buildVersionedTx(from, instructions);
  return toBase64(tx);
}

/** Convert a USD keypad amount into a chain transfer for the preferred asset. */
export async function buildUsdTransfer(input: {
  from: string;
  to: string;
  amountUsd: number;
  balances: TransferBalances;
}) {
  const { balances } = input;
  if (!(input.amountUsd > 0)) throw new Error("Enter an amount above zero");
  if (input.amountUsd > balances.availableUsd + 1e-9) {
    throw new Error("Amount exceeds available balance");
  }

  if (balances.asset === "usdc") {
    return {
      asset: "usdc" as const,
      transaction: await buildUsdcTransfer({
        from: input.from,
        to: input.to,
        amountUsdc: input.amountUsd,
      }),
    };
  }

  if (!(balances.solPriceUsd > 0)) {
    throw new Error("Could not price SOL for this withdrawal");
  }
  let amountSol = input.amountUsd / balances.solPriceUsd;
  const maxSendable = Math.max(0, balances.sol - SOL_FEE_BUFFER);
  if (amountSol > maxSendable) amountSol = maxSendable;
  if (!(amountSol > 0)) {
    throw new Error("Not enough SOL to cover this transfer and network fees");
  }

  return {
    asset: "sol" as const,
    transaction: await buildSolTransfer({
      from: input.from,
      to: input.to,
      amountSol,
    }),
  };
}

export async function sendWalletTransfer(input: {
  session: WalletSession;
  to: string;
  amountUsd: number;
  balances?: TransferBalances;
}) {
  const balances = input.balances ?? (await fetchTransferBalances(input.session.address));
  const built = await buildUsdTransfer({
    from: input.session.address,
    to: input.to,
    amountUsd: input.amountUsd,
    balances,
  });
  const signature = await signAndSendWalletTransaction(input.session, built.transaction);
  if (!signature) {
    throw new Error("Approve the transfer in your wallet, then return to Stonk Watcher.");
  }
  return { signature, asset: built.asset };
}

export function formatAvailableLabel(balances: TransferBalances) {
  if (balances.asset === "usdc") {
    return `$${balances.availableUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} USDC`;
  }
  return `${balances.sol.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} SOL (≈ $${balances.availableUsd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })})`;
}
