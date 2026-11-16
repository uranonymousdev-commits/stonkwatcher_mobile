import { useEffect, useRef } from "react";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { useAuth } from "../components/AuthContext";
import { isSolanaAddress } from "../lib/solana";

function readWalletAddress(wallet: unknown): string {
  if (!wallet || typeof wallet !== "object") return "";
  const row = wallet as { address?: unknown; publicKey?: unknown };
  const value = String(row.address || row.publicKey || "");
  return isSolanaAddress(value) ? value : "";
}

/**
 * Live Solana deposit address from Privy embedded wallet.
 * Also keeps AuthContext.wallet in sync so trading/withdraw see the same address.
 */
export function useLiveSolanaAddress() {
  const { isReady, user } = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const { wallet, completeWalletSignIn } = useAuth();
  const creating = useRef(false);

  const embeddedAddress = readWalletAddress(solana?.wallets?.[0]);
  const address = embeddedAddress || (wallet?.provider === "privy" ? wallet.address : "");

  useEffect(() => {
    if (!isReady || !user) return;

    if (!embeddedAddress) {
      if (creating.current || typeof solana?.create !== "function") return;
      if (solana.status === "creating" || solana.status === "connecting") return;
      creating.current = true;
      void solana
        .create()
        .catch(() => undefined)
        .finally(() => {
          creating.current = false;
        });
      return;
    }

    if (wallet?.provider === "privy" && wallet.address === embeddedAddress) return;
    void completeWalletSignIn({ provider: "privy", address: embeddedAddress });
  }, [isReady, user, embeddedAddress, wallet, solana, completeWalletSignIn]);

  return {
    address,
    ready: Boolean(isReady),
    authenticated: Boolean(user),
    creating: solana?.status === "creating" || creating.current,
  };
}
