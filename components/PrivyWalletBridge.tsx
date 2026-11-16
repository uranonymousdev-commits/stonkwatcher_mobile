import { useEffect, useRef } from "react";
import { Buffer } from "buffer";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";
import { SOLANA_RPC_URL } from "../lib/config";
import {
  registerPrivyLogout,
  registerPrivySigner,
} from "../lib/privy-runtime";
import { useAuth } from "./AuthContext";

/**
 * Keeps AuthContext + swap signing in sync with the Privy embedded Solana wallet.
 * Must render under both PrivyProvider and AuthProvider.
 */
export default function PrivyWalletBridge() {
  const { isReady, user, logout } = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const { wallet, completeWalletSignIn } = useAuth();
  const creating = useRef(false);

  const embedded = solana?.wallets?.[0];
  const address =
    embedded && typeof embedded === "object"
      ? String(
          ("address" in embedded && embedded.address) ||
            ("publicKey" in embedded && embedded.publicKey) ||
            "",
        )
      : "";

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

    if (!address) {
      if (creating.current || !solana?.create) return;
      creating.current = true;
      void solana
        .create()
        .catch(() => undefined)
        .finally(() => {
          creating.current = false;
        });
      return;
    }

    if (wallet?.provider === "privy" && wallet.address === address) return;
    // Privy embedded wallet is the product wallet — always sync it for deposit/trade.
    void completeWalletSignIn({ provider: "privy", address });
  }, [isReady, user, address, wallet, solana, completeWalletSignIn]);

  return null;
}
