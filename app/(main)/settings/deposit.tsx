import { LocalizedText as Text, LocalizedAlert as Alert } from "../../../components/LocalizationContext";
import { useAuth } from "../../../components/AuthContext";
import { isPrivyConfigured, privyKeyExportUrl } from "../../../lib/privy-runtime";
import { useLiveSolanaAddress } from "../../../hooks/useLiveSolanaAddress";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../../../constants/theme";

const PLACEHOLDER = require("../../../assets/images/placeholder.webp");
const SHEET_HEIGHT = 380;

function DepositBody({
  address,
  loading,
  canExport,
}: {
  address: string;
  loading: boolean;
  canExport: boolean;
}) {
  const live = Boolean(address);
  const qrUri = useMemo(() => {
    if (!address) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(address)}`;
  }, [address]);

  const copyAddress = async () => {
    if (!live) {
      Alert.alert(
        "Deposit",
        "Sign in with Google to create your in-app Solana address, then open Deposit again.",
      );
      return;
    }
    await Clipboard.setStringAsync(address);
    Alert.alert("Copied", "Your Solana deposit address was copied.");
  };

  const exportKeys = async () => {
    if (!canExport || !address) {
      Alert.alert(
        "Export keys",
        "Export is available after you sign in with Google / email (Privy wallet).",
      );
      return;
    }
    const url = privyKeyExportUrl(address);
    if (!url) {
      Alert.alert(
        "Export keys",
        "Set EXPO_PUBLIC_PRIVY_KEY_EXPORT_URL to your Privy export web page.",
      );
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.body}>
      <Text style={styles.description}>Send any token on the Solana network.</Text>
      <Text style={styles.description}>
        This is your personal in-app Solana address. Deposit USDC or SOL, then trade inside the app.
      </Text>

      <View style={styles.qrContainer}>
        {loading ? (
          <ActivityIndicator color="#101010" />
        ) : qrUri ? (
          <Image source={{ uri: qrUri }} style={styles.qrImage} resizeMode="contain" />
        ) : (
          <>
            <Image source={PLACEHOLDER} style={styles.qrPlaceholder} resizeMode="contain" />
            <Text style={styles.qrLabel}>Sign in with Google first</Text>
          </>
        )}
      </View>

      <Text style={styles.address} numberOfLines={3} selectable>
        {loading ? "Creating your Solana wallet…" : live ? address : "Wallet address not connected"}
      </Text>

      <Pressable
        style={styles.copyButton}
        onPress={() => void copyAddress()}
        accessibilityRole="button"
      >
        <Text style={styles.copyButtonText}>Copy Wallet Address</Text>
      </Pressable>

      {live ? (
        <Pressable
          style={styles.exportButton}
          onPress={() => void exportKeys()}
          accessibilityRole="button"
          accessibilityLabel="Export private key"
        >
          <Text style={styles.exportButtonText}>Export Private Key</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PrivyDepositBody() {
  const live = useLiveSolanaAddress();
  const { wallet } = useAuth();
  const address = live.address || (wallet?.provider === "privy" ? wallet.address : "");
  return (
    <DepositBody
      address={address}
      loading={!live.ready || live.creating || (live.authenticated && !address)}
      canExport={Boolean(address)}
    />
  );
}

function AuthDepositBody() {
  const { wallet, isLiveWallet } = useAuth();
  const address = isLiveWallet ? wallet?.address || "" : "";
  return (
    <DepositBody
      address={address}
      loading={false}
      canExport={wallet?.provider === "privy"}
    />
  );
}

export default function DepositScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const privy = isPrivyConfigured();

  const [translateY] = useState(() => new Animated.Value(500));
  const closing = useRef(false);

  const closeSheet = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(translateY, {
      toValue: 500,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/tokens");
    });
  }, [router, translateY]);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      damping: 24,
      stiffness: 190,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  return (
    <View style={styles.root}>
      <View style={styles.backdrop}>
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.darkOverlay} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeSheet}
          accessibilityRole="button"
          accessibilityLabel="Close deposit"
        />
      </View>

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.dragArea}>
          <View style={styles.handle} />
        </View>
        <Text style={styles.title}>Deposit</Text>
        {privy ? <PrivyDepositBody /> : <AuthDepositBody />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheet: {
    backgroundColor: "#171C05",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: SHEET_HEIGHT,
    paddingHorizontal: 14,
    paddingTop: 0,
    overflow: "hidden",
  },
  dragArea: {
    height: 28,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 8,
  },
  handle: {
    width: 45,
    height: 5,
    borderRadius: 10,
    backgroundColor: "#41463B",
  },
  title: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  body: {
    alignItems: "center",
  },
  description: {
    color: "#A5A5A5",
    fontFamily: FONTS.regular,
    fontSize: 11,
    textAlign: "center",
    marginBottom: 4,
  },
  qrContainer: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 10,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qrImage: {
    width: 150,
    height: 150,
  },
  qrPlaceholder: {
    width: 90,
    height: 90,
  },
  qrLabel: {
    fontSize: 10,
    color: "#555555",
    marginTop: 5,
  },
  address: {
    color: "#B6B6B6",
    fontFamily: FONTS.regular,
    fontSize: 10,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  copyButton: {
    backgroundColor: COLORS.stonkGreen,
    height: 38,
    width: "100%",
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  copyButtonText: {
    color: "#101010",
    fontFamily: FONTS.regular,
    fontSize: 14,
    fontWeight: "700",
  },
  exportButton: {
    marginTop: 8,
    height: 38,
    width: "100%",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#41463B",
    justifyContent: "center",
    alignItems: "center",
  },
  exportButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 13,
    fontWeight: "600",
  },
});
