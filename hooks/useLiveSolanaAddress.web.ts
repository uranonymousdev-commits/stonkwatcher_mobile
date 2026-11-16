import { useAuth } from "../components/AuthContext";

/** Privy embedded wallets are native-only. */
export function useLiveSolanaAddress() {
  const { wallet } = useAuth();
  const address = wallet?.provider === "privy" ? wallet.address : wallet?.address || "";
  return {
    address,
    ready: true,
    authenticated: Boolean(wallet?.address),
    creating: false,
  };
}
