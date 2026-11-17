import { LocalizedText as Text, LocalizedAlert as Alert } from "../../../components/LocalizationContext";
import { useAuth } from "../../../components/AuthContext";
import {
  fetchTransferBalances,
  formatAvailableLabel,
  type TransferBalances,
} from "../../../lib/transfer";
import { isPrivyConfigured } from "../../../lib/privy-runtime";
import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Page } from "../../../components/SettingsUI";

const DEMO_BALANCE = 93737.34;

export default function Withdraw() {
  const router = useRouter();
  const { wallet, isLiveWallet } = useAuth();
  const [amount, setAmount] = useState("0");
  const [balances, setBalances] = useState<TransferBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const privy = isPrivyConfigured();
  const liveRequired = privy || isLiveWallet;

  const balance = isLiveWallet ? balances?.availableUsd ?? 0 : DEMO_BALANCE;

  useEffect(() => {
    if (!isLiveWallet || !wallet?.address) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setLoading(true);
      void fetchTransferBalances(wallet.address)
        .then((next) => {
          if (!cancelled) setBalances(next);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isLiveWallet, wallet?.address]);

  const add = (n: string) => setAmount((a) => (a === "0" ? n : a + n));

  return (
    <Page
      title="Withdraw"
      action={liveRequired && !isLiveWallet ? "Sign in with Google" : "Continue"}
      onAction={() => {
        if (liveRequired && !isLiveWallet) {
          Alert.alert(
            "Live withdraw",
            "Sign in with Google to withdraw from your in-app Solana wallet.",
            [{ text: "Sign in", onPress: () => router.push("/login") }],
          );
          return;
        }
        const n = Number(amount);
        if (!n || n > balance + 1e-9) {
          Alert.alert(
            "Invalid amount",
            isLiveWallet
              ? "Enter an amount within your available balance."
              : "Enter an amount within the sample balance.",
          );
          return;
        }
        if (!wallet?.address) {
          Alert.alert("Withdraw", "Connect a live wallet first.");
          return;
        }
        router.push({
          pathname: "/settings/withdraw-address" as any,
          params: { amount, asset: balances?.asset || "usdc" },
        });
      }}
    >
      <Text style={{ textAlign: "center", color: "white", fontSize: 48, fontWeight: "700", marginTop: 65 }}>
        ${amount}
      </Text>
      <View style={{ flex: 1 }} />
      <Text style={{ color: "#aaa", marginBottom: 15 }}>
        Available{" "}
        <Text style={{ color: "white" }}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : isLiveWallet && balances ? (
            formatAvailableLabel(balances)
          ) : liveRequired ? (
            "Sign in with Google for live balance"
          ) : (
            `$${DEMO_BALANCE.toLocaleString("en-US", { minimumFractionDigits: 2 })} (demo)`
          )}
        </Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 5, marginBottom: 12 }}>
        {[10, 25, 50, 100].map((x) => (
          <Pressable
            key={x}
            onPress={() => setAmount(((balance * x) / 100).toFixed(2))}
            style={{
              flex: 1,
              backgroundColor: "#252C00",
              padding: 12,
              alignItems: "center",
              borderRadius: 5,
            }}
          >
            <Text style={{ color: "white" }}>{x === 100 ? "Max" : `${x}%`}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((n) => (
          <Pressable
            key={n}
            onPress={() =>
              n === "⌫"
                ? setAmount((a) => a.slice(0, -1) || "0")
                : n === "."
                  ? setAmount((a) => (a.includes(".") ? a : a + "."))
                  : add(n)
            }
            style={{
              width: "32%",
              height: 58,
              backgroundColor: "#141414",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 26, fontWeight: "700" }}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}
