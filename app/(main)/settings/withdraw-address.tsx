import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedAlert as Alert,
} from "../../../components/LocalizationContext";
import { useAuth } from "../../../components/AuthContext";
import { isSolanaAddress } from "../../../lib/solana";
import { fetchTransferBalances, sendWalletTransfer } from "../../../lib/transfer";
import React, { useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Page } from "../../../components/SettingsUI";

export default function WithdrawAddress() {
  const { amount, asset } = useLocalSearchParams<{ amount?: string; asset?: string }>();
  const router = useRouter();
  const { wallet, isLiveWallet } = useAuth();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (!isSolanaAddress(address.trim())) {
      Alert.alert("Invalid address", "Enter a valid Solana address.");
      return;
    }
    const usd = Number(amount || "0");
    if (!(usd > 0)) {
      Alert.alert("Invalid amount", "Go back and enter an amount.");
      return;
    }

    if (!isLiveWallet) {
      Alert.alert(
        "Simulation only",
        `Demo withdrawal of $${amount || "0"} was simulated. No funds moved.`,
        [{ text: "OK", onPress: () => router.replace("/settings/deposit-and-withdraw" as any) }],
      );
      return;
    }

    if (!wallet) {
      Alert.alert("Withdraw", "Connect a live wallet first.");
      return;
    }

    setBusy(true);
    try {
      const balances = await fetchTransferBalances(wallet.address);
      const result = await sendWalletTransfer({
        session: wallet,
        to: address.trim(),
        amountUsd: usd,
        balances,
      });
      Alert.alert(
        "Withdraw submitted",
        `Sent $${usd.toFixed(2)} (${asset || balances.asset}).\nSignature ${result.signature.slice(0, 12)}…`,
        [{ text: "OK", onPress: () => router.replace("/settings/deposit-and-withdraw" as any) }],
      );
    } catch (error) {
      Alert.alert(
        "Withdraw failed",
        error instanceof Error ? error.message : "Could not submit this transfer.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title="Withdraw"
      action={busy ? "Submitting…" : isLiveWallet ? "Confirm Withdrawal" : "Confirm Demo Withdrawal"}
      onAction={() => {
        if (!busy) void onConfirm();
      }}
    >
      <Text style={st.label}>Recipient Solana address</Text>
      <TextInput
        style={st.input}
        placeholder="Paste Solana address"
        placeholderTextColor="#777"
        autoCapitalize="none"
        value={address}
        editable={!busy}
        onChangeText={setAddress}
      />
      <View style={st.card}>
        <Text style={{ color: "white", marginBottom: 12 }}>Details</Text>
        <Text style={st.muted}>
          Amount: ${amount || "0"}
          {asset && asset !== "demo" ? ` · ${String(asset).toUpperCase()}` : " (demo)"}
        </Text>
        <Text style={[st.muted, { marginTop: 8 }]}>Network: Solana</Text>
        <Text style={[st.muted, { marginTop: 8 }]}>
          Fee: {isLiveWallet ? "Network fee in SOL" : "$0 (simulated)"}
        </Text>
      </View>
      {busy ? <ActivityIndicator color="#C6E900" style={{ marginTop: 16 }} /> : null}
    </Page>
  );
}

const st = StyleSheet.create({
  label: { color: "#aaa", marginBottom: 8 },
  input: {
    backgroundColor: "#1a1a1a",
    color: "white",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#151614",
    borderRadius: 8,
    padding: 14,
  },
  muted: { color: "#aaa", fontSize: 13 },
});
