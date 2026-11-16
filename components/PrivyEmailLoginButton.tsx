import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { useLogin } from "@privy-io/expo/ui";
import { useAuth } from "./AuthContext";
import { LocalizedAlert as Alert } from "./LocalizationContext";
import GoogleIcon from "../assets/login/google.svg";
import { isSolanaAddress } from "../lib/solana";

const BRAND = "#BBDC12";

type Props = {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

function addressFromUser(user: { linked_accounts?: unknown[] } | null | undefined) {
  const linked = user?.linked_accounts ?? [];
  for (const account of linked) {
    if (
      account &&
      typeof account === "object" &&
      "type" in account &&
      account.type === "wallet" &&
      "chain_type" in account &&
      account.chain_type === "solana" &&
      "address" in account &&
      typeof account.address === "string" &&
      isSolanaAddress(account.address)
    ) {
      return account.address;
    }
  }
  return "";
}

function addressFromWallets(wallets: unknown[] | undefined) {
  const first = wallets?.[0];
  if (!first || typeof first !== "object") return "";
  const row = first as { address?: unknown; publicKey?: unknown };
  const value = String(row.address || row.publicKey || "");
  return isSolanaAddress(value) ? value : "";
}

/**
 * Privy Google / email login → ensures a Solana embedded wallet exists, then enters the app.
 */
export default function PrivyEmailLoginButton({ disabled, onBusyChange }: Props) {
  const router = useRouter();
  const { login } = useLogin();
  const { user } = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const { completeWalletSignIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const locking = useRef(false);

  const resolveAddress = async () => {
    let address =
      addressFromWallets(solana?.wallets) || addressFromUser(user) || "";

    if (!address && typeof solana?.create === "function") {
      await solana.create().catch(() => undefined);
      address = addressFromWallets(solana?.wallets) || addressFromUser(user) || "";
    }

    // Wallet list can populate a moment after createOnLogin / create().
    for (let i = 0; i < 25 && !address; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      address =
        addressFromWallets(solana?.wallets) || addressFromUser(user) || "";
    }

    return address;
  };

  const onPress = async () => {
    if (locking.current || disabled) return;
    locking.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const session = await login({ loginMethods: ["google", "email"] });
      let address =
        addressFromUser(session?.user) ||
        addressFromWallets(solana?.wallets) ||
        "";

      if (!address) {
        address = await resolveAddress();
      }

      if (!address) {
        throw new Error(
          "Solana wallet was not created yet. Check Privy dashboard: enable Solana embedded wallets, then try again.",
        );
      }

      await completeWalletSignIn({ provider: "privy", address });
      router.replace("/wallet");
    } catch (error) {
      const message =
        error && typeof error === "object" && "error" in error
          ? JSON.stringify((error as { error: unknown }).error)
          : error instanceof Error
            ? error.message
            : "Could not open the embedded wallet.";
      if (!/cancel/i.test(message)) {
        Alert.alert("Sign in failed", message);
      }
    } finally {
      locking.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator color="#101010" />
      ) : (
        <>
          <GoogleIcon />
          <Text style={styles.buttonText}>Sign in with Google</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 53,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BRAND,
  },
  buttonText: {
    fontFamily: "GoogleSansFlex",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.32,
    color: "#101010",
    flexShrink: 1,
  },
  pressed: { opacity: 0.8 },
});
