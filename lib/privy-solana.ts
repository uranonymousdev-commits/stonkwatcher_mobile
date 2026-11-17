import { isSolanaAddress } from "./solana";

/** Pull a Solana address from a Privy wallet / provider-shaped object. */
export function addressFromPrivyWallet(wallet: unknown): string {
  if (!wallet || typeof wallet !== "object") return "";
  const row = wallet as {
    address?: unknown;
    publicKey?: unknown;
    wallet?: { address?: unknown; publicKey?: unknown };
  };
  const candidates = [
    row.address,
    row.publicKey,
    row.wallet?.address,
    row.wallet?.publicKey,
  ];
  for (const value of candidates) {
    const text = String(value || "");
    if (isSolanaAddress(text)) return text;
  }
  return "";
}

/** First Solana embedded/external wallet on a Privy user (linked_accounts). */
export function addressFromPrivyUser(user: { linked_accounts?: unknown[] } | null | undefined) {
  const linked = user?.linked_accounts ?? [];
  for (const account of linked) {
    if (!account || typeof account !== "object") continue;
    const row = account as {
      type?: unknown;
      chain_type?: unknown;
      address?: unknown;
    };
    if (row.type !== "wallet") continue;
    if (row.chain_type && row.chain_type !== "solana") continue;
    const address = String(row.address || "");
    if (isSolanaAddress(address)) return address;
  }
  return "";
}

export function addressFromPrivyWallets(wallets: unknown[] | undefined) {
  for (const wallet of wallets ?? []) {
    const address = addressFromPrivyWallet(wallet);
    if (address) return address;
  }
  return "";
}

/**
 * Ensure the authenticated Privy user has a Solana embedded wallet and return its address.
 * Each Privy user gets their own address (createOnLogin / create() does not share keys).
 */
export async function ensurePrivySolanaAddress(opts: {
  user: { linked_accounts?: unknown[] } | null | undefined;
  wallets: unknown[] | undefined;
  create?: (() => Promise<unknown>) | undefined;
  refreshUser?: (() => Promise<{ user: { linked_accounts?: unknown[] } } | null | undefined>) | undefined;
  status?: string;
}): Promise<string> {
  let address =
    addressFromPrivyWallets(opts.wallets) || addressFromPrivyUser(opts.user) || "";
  if (address) return address;

  if (typeof opts.create === "function" && opts.status !== "creating" && opts.status !== "connecting") {
    const created = await opts.create().catch(() => null);
    address = addressFromPrivyWallet(created);
    if (address) return address;
  }

  if (typeof opts.refreshUser === "function") {
    for (let i = 0; i < 20 && !address; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const refreshed = await opts.refreshUser().catch(() => null);
      address =
        addressFromPrivyUser(refreshed?.user) ||
        addressFromPrivyWallets(opts.wallets) ||
        "";
    }
  }

  return address;
}
