import { useEffect, useRef, useState } from "react";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { useAuth } from "../components/AuthContext";
import {
  addressFromPrivyUser,
  addressFromPrivyWallets,
  ensurePrivySolanaAddress,
} from "../lib/privy-solana";

/**
 * Live Solana deposit address from Privy embedded wallet (unique per Google/email user).
 * Keeps AuthContext.wallet in sync so deposit / withdraw / trade share the same address.
 */
export function useLiveSolanaAddress() {
  const { isReady, user, refreshUser } = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const { wallet, completeWalletSignIn } = useAuth();
  const ensuring = useRef(false);
  const [pending, setPending] = useState(false);

  const embeddedAddress =
    addressFromPrivyWallets(solana?.wallets) ||
    addressFromPrivyUser(user) ||
    "";
  const cached =
    wallet?.provider === "privy" && wallet.address ? wallet.address : "";
  const address = embeddedAddress || cached;

  useEffect(() => {
    if (!isReady || !user) return;

    if (embeddedAddress) {
      if (wallet?.provider === "privy" && wallet.address === embeddedAddress) return;
      void completeWalletSignIn({ provider: "privy", address: embeddedAddress });
      return;
    }

    if (ensuring.current) return;
    if (solana?.status === "creating" || solana?.status === "connecting") return;

    ensuring.current = true;
    const timer = setTimeout(() => {
      setPending(true);
      void ensurePrivySolanaAddress({
        user,
        wallets: solana?.wallets,
        create:
          solana && typeof solana.create === "function" ? () => solana.create!() : undefined,
        refreshUser,
        status: solana?.status,
      })
        .then((next) => {
          if (!next) return;
          return completeWalletSignIn({ provider: "privy", address: next });
        })
        .catch(() => undefined)
        .finally(() => {
          ensuring.current = false;
          setPending(false);
        });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [
    isReady,
    user,
    embeddedAddress,
    wallet,
    solana,
    refreshUser,
    completeWalletSignIn,
  ]);

  return {
    address,
    ready: Boolean(isReady),
    authenticated: Boolean(user),
    creating: pending || solana?.status === "creating",
  };
}
