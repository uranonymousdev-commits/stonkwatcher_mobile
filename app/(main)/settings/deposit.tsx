import { LocalizedText as Text, LocalizedAlert as Alert } from "../../../components/LocalizationContext";
import { useAuth } from "../../../components/AuthContext";
import PrivyExportKeyModal from "../../../components/PrivyExportKeyModal";
import { isPrivyConfigured, privyKeyExportUrl } from "../../../lib/privy-runtime";
import { useLiveSolanaAddress } from "../../../hooks/useLiveSolanaAddress";
import { truncateAddress } from "../../../lib/solana";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS } from "../../../constants/theme";

const SHEET_HEIGHT = 420;

function DepositBody({
  address,
  loading,
  canExport,
  needsSignIn,
  onSignIn,
}: {
  address: string;
  loading: boolean;
  canExport: boolean;
  needsSignIn: boolean;
  onSignIn: () => void;
}) {
  const live = Boolean(address);
  const [exportOpen, setExportOpen] = useState(false);
  const qrUri = useMemo(() => {
    if (!address) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(address)}`;
  }, [address]);

  const copyAddress = async () => {
    if (!live) {
      Alert.alert(
        "Deposit",
        "Sign in with Google to create your personal Solana deposit address.",
      );
      return;
    }
    await Clipboard.setStringAsync(address);
    Alert.alert("Copied", "Your Solana deposit address was copied.");
  };

  const exportKeys = () => {
    if (!canExport || !address) {
      Alert.alert(
        "Export private key",
        "Export is available after you sign in with Google / email (Privy wallet).",
      );
      return;
    }
    if (!privyKeyExportUrl(address)) {
      Alert.alert(
        "Export private key",
        "Set EXPO_PUBLIC_PRIVY_KEY_EXPORT_URL to your Privy export web page.",
      );
      return;
    }
    setExportOpen(true);
  };

  return (
    <View style={styles.body}>
      <Text style={styles.description}>Send any token on the Solana network.</Text>
      <Text style={styles.description}>
        This address is unique to your Google / email account. Deposit USDC or SOL, then trade
        inside the app.
      </Text>

      <View style={styles.qrContainer}>
        {loading ? (
          <ActivityIndicator color="#101010" />
        ) : qrUri ? (
          <Image source={{ uri: qrUri }} style={styles.qrImage} resizeMode="contain" />
        ) : (
          <Text style={styles.qrLabel}>
            {needsSignIn ? "Sign in with Google for your QR" : "Creating wallet…"}
          </Text>
        )}
      </View>

      <Text style={styles.address} numberOfLines={3} selectable>
        {loading
          ? "Creating your Solana wallet…"
          : live
            ? address
            : needsSignIn
              ? "Sign in with Google for a live deposit address"
              : "Waiting for Solana wallet…"}
      </Text>

      {live ? <Text style={styles.shortAddress}>{truncateAddress(address, 6)}</Text> : null}

      {needsSignIn ? (
        <Pressable
          style={styles.copyButton}
          onPress={onSignIn}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
        >
          <Text style={styles.copyButtonText}>Sign in with Google</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.copyButton, !live && styles.copyDisabled]}
          onPress={() => void copyAddress()}
          accessibilityRole="button"
          disabled={!live}
        >
          <Text style={styles.copyButtonText}>Copy Wallet Address</Text>
        </Pressable>
      )}

      {live ? (
        <Pressable
          style={styles.exportButton}
          onPress={exportKeys}
          accessibilityRole="button"
          accessibilityLabel="Export private key"
        >
          <Text style={styles.exportButtonText}>Export Private Key</Text>
        </Pressable>
      ) : null}

      <PrivyExportKeyModal
        visible={exportOpen}
        address={address}
        onClose={() => setExportOpen(false)}
      />
    </View>
  );
}

function PrivyDepositBody() {
  const router = useRouter();
  const live = useLiveSolanaAddress();
  const { wallet } = useAuth();
  const address = live.address || (wallet?.provider === "privy" ? wallet.address : "");
  const needsSignIn = live.ready && !live.authenticated && !address;

  return (
    <DepositBody
      address={address}
      loading={!live.ready || live.creating || (live.authenticated && !address)}
      canExport={Boolean(address)}
      needsSignIn={needsSignIn}
      onSignIn={() => router.push("/login")}
    />
  );
}

function AuthDepositBody() {
  const router = useRouter();
  const { wallet, isLiveWallet } = useAuth();
  const address = isLiveWallet ? wallet?.address || "" : "";
  return (
    <DepositBody
      address={address}
      loading={false}
      canExport={wallet?.provider === "privy"}
      needsSignIn={!address}
      onSignIn={() => router.push("/login")}
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
  qrLabel: {
    fontSize: 11,
    color: "#555555",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  address: {
    color: "#B6B6B6",
    fontFamily: FONTS.regular,
    fontSize: 10,
    textAlign: "center",
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  shortAddress: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
  },
  copyButton: {
    backgroundColor: COLORS.stonkGreen,
    height: 38,
    width: "100%",
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  copyDisabled: {
    opacity: 0.45,
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
