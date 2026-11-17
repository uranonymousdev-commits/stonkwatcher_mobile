import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import { useLogin } from "@privy-io/expo/ui";
import { useAuth } from "./AuthContext";
import { LocalizedAlert as Alert } from "./LocalizationContext";
import GoogleIcon from "../assets/login/google.svg";
import {
  addressFromPrivyUser,
  addressFromPrivyWallets,
  ensurePrivySolanaAddress,
} from "../lib/privy-solana";

const BRAND = "#BBDC12";

type Props = {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Privy Google / email login → ensures a Solana embedded wallet exists, then enters the app.
 * Each Google/email account maps to its own Privy Solana address.
 */
export default function PrivyEmailLoginButton({ disabled, onBusyChange }: Props) {
  const router = useRouter();
  const { login } = useLogin();
  const { user, refreshUser } = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const { completeWalletSignIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const locking = useRef(false);

  const onPress = async () => {
    if (locking.current || disabled) return;
    locking.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const session = await login({ loginMethods: ["google", "email"] });
      let address =
        addressFromPrivyUser(session?.user) ||
        addressFromPrivyWallets(solana?.wallets) ||
        addressFromPrivyUser(user) ||
        "";

      if (!address) {
        address = await ensurePrivySolanaAddress({
          user: session?.user || user,
          wallets: solana?.wallets,
          create:
            solana && typeof solana.create === "function"
              ? () => solana.create!()
              : undefined,
          refreshUser,
          status: solana?.status,
        });
      }

      // Final pass: hook state may have wallets after createOnLogin settles.
      if (!address) {
        address =
          addressFromPrivyWallets(solana?.wallets) ||
          addressFromPrivyUser((await refreshUser().catch(() => null))?.user) ||
          "";
      }

      if (!address) {
        throw new Error(
          "Solana wallet was not created yet. In Privy → Login methods enable Google/Email, then try again.",
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
