import { useEffect, useRef } from "react";
import { Buffer } from "buffer";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";
import { SOLANA_RPC_URL } from "../lib/config";
import {
  registerPrivyLogout,
  registerPrivySigner,
} from "../lib/privy-runtime";
import {
  addressFromPrivyUser,
  addressFromPrivyWallets,
  ensurePrivySolanaAddress,
} from "../lib/privy-solana";
import { useAuth } from "./AuthContext";

/**
 * Keeps AuthContext + swap signing in sync with the Privy embedded Solana wallet.
 * Must render under both PrivyProvider and AuthProvider.
 */
export default function PrivyWalletBridge() {
  const { isReady, user, logout, refreshUser } = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const { wallet, completeWalletSignIn } = useAuth();
  const ensuring = useRef(false);

  const embedded = solana?.wallets?.[0];
  const address =
    addressFromPrivyWallets(solana?.wallets) ||
    addressFromPrivyUser(user) ||
    "";

  useEffect(() => {
    registerPrivyLogout(async () => {
      await logout();
    });
    return () => registerPrivyLogout(null);
  }, [logout]);

  useEffect(() => {
    if (!embedded || !address || typeof embedded.getProvider !== "function") {
      registerPrivySigner(null);
      return;
    }

    registerPrivySigner(async (transactionBase64: string) => {
      const provider = await embedded.getProvider();
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const bytes = Buffer.from(transactionBase64, "base64");
      let transaction: VersionedTransaction | Transaction;
      try {
        transaction = VersionedTransaction.deserialize(bytes);
      } catch {
        transaction = Transaction.from(bytes);
      }
      const result = await provider.request({
        method: "signAndSendTransaction",
        params: {
          transaction,
          connection,
        },
      });
      const signature =
        typeof result === "string"
          ? result
          : result && typeof result === "object" && "signature" in result
            ? String((result as { signature: string }).signature)
            : "";
      if (!signature) throw new Error("Embedded wallet did not return a signature.");
      return signature;
    });

    return () => registerPrivySigner(null);
  }, [embedded, address]);

  useEffect(() => {
    if (!isReady || !user) return;

    if (address) {
      if (wallet?.provider === "privy" && wallet.address === address) return;
      void completeWalletSignIn({ provider: "privy", address });
      return;
    }

    if (ensuring.current) return;
    if (solana?.status === "creating" || solana?.status === "connecting") return;

    ensuring.current = true;
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
      });
  }, [isReady, user, address, wallet, solana, refreshUser, completeWalletSignIn]);

  return null;
}
