import { LocalizedText as Text, LocalizedAlert as Alert } from "../components/LocalizationContext";
import { useAuth } from "../components/AuthContext";
import PrivyEmailLoginButton from "../components/PrivyEmailLoginButton";
import { isPrivyConfigured } from "../lib/privy-runtime";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";
import GuestIcon from "../assets/login/guest.svg";
import Logo from "../assets/login/logo.svg";

const BRAND = "#BBDC12";
const logoAnimation = require("../assets/login/official-logo-animation.json");

function LoginBackground() {
  return (
    <View pointerEvents="none" accessible={false} style={styles.background}>
      <Image source={require("../assets/login/glow-top.webp")} style={styles.glowTop} />
      <Image source={require("../assets/login/glow-bottom.webp")} style={styles.glowBottom} />
      <Image source={require("../assets/login/glow-side.webp")} style={styles.glowLeft} />
      <Image source={require("../assets/login/glow-side.webp")} style={styles.glowRight} />
      <Image source={require("../assets/login/mathematics.png")} resizeMode="repeat" style={styles.grid} />
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithDemo } = useAuth();
  const reducedMotion = useReducedMotion();
  const signingIn = useRef(false);
  const [busy, setBusy] = useState<"guest" | "privy" | null>(null);
  const [animationFailed, setAnimationFailed] = useState(false);
  const privyReady = isPrivyConfigured();

  const continueAsGuest = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy("guest");
    try {
      await signInWithDemo("guest");
      router.replace("/wallet");
    } catch {
      Alert.alert("Sign in failed", "Could not start the guest account. Please try again.");
    } finally {
      signingIn.current = false;
      setBusy(null);
    }
  };

  return (
    <View style={styles.container}>
      <LoginBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 32), paddingBottom: Math.max(insets.bottom, 32) + 64 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topSpacer} />
        <View style={styles.brand}>
          <View style={styles.logo} accessible={false}>
            {reducedMotion || animationFailed ? (
              <Logo />
            ) : (
              <LottieView
                source={logoAnimation}
                autoPlay
                loop
                resizeMode="contain"
                style={styles.logo}
                webStyle={{ width: 79.358, height: 82 }}
                onAnimationFailure={() => setAnimationFailed(true)}
              />
            )}
          </View>
          <Text style={styles.title}>Stonk Watcher</Text>
        </View>

        <View style={styles.actions}>
          {privyReady ? (
            <PrivyEmailLoginButton
              disabled={Boolean(busy) && busy !== "privy"}
              onBusyChange={(on) => setBusy(on ? "privy" : null)}
            />
          ) : null}

          <Pressable
            onPress={() => void continueAsGuest()}
            disabled={Boolean(busy)}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
            accessibilityState={{ disabled: Boolean(busy), busy: busy === "guest" }}
            style={({ pressed }) => [
              styles.button,
              privyReady ? styles.guestButton : styles.guestPrimary,
              pressed && styles.pressed,
            ]}
          >
            {busy === "guest" ? (
              <ActivityIndicator color="#101010" />
            ) : (
              <>
                <GuestIcon />
                <Text style={styles.buttonText}>Continue as Guest</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.hint}>
            {privyReady
              ? "Sign in with Google or email for a live in-app Solana wallet. Guest is paper trade only."
              : "Set EXPO_PUBLIC_PRIVY_APP_ID and EXPO_PUBLIC_PRIVY_CLIENT_ID to enable Google / email wallets."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#101010", overflow: "hidden" },
  background: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  glowTop: { position: "absolute", width: 616.4, height: 616.4, left: -292.2, top: -238.2 },
  glowBottom: { position: "absolute", width: 616.4, height: 616.4, left: -3.2, bottom: -185.2 },
  glowLeft: { position: "absolute", width: 735.4, height: 735.4, left: -546.2, top: 147.8 },
  glowRight: { position: "absolute", width: 735.4, height: 735.4, left: 160.8, top: -125.2 },
  grid: { position: "absolute", left: -219, top: -10, width: 966, height: 966, opacity: 0.12 },
  content: {
    flexGrow: 1,
    minHeight: 540,
    paddingHorizontal: 16,
    justifyContent: "space-between",
    alignItems: "center",
    gap: 32,
  },
  topSpacer: { height: 32 },
  brand: { alignItems: "center", gap: 16 },
  logo: { width: 79.358, height: 82 },
  title: {
    fontFamily: "GoogleSansFlex",
    fontSize: 32,
    fontWeight: "600",
    color: BRAND,
    letterSpacing: -0.64,
    textAlign: "center",
  },
  actions: { width: "100%", gap: 12 },
  button: {
    minHeight: 53,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  guestPrimary: { backgroundColor: BRAND },
  guestButton: { backgroundColor: "#FFFFFF" },
  buttonText: {
    fontFamily: "GoogleSansFlex",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.32,
    color: "#101010",
    flexShrink: 1,
  },
  hint: {
    fontFamily: "GoogleSansFlex",
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 4,
  },
  pressed: { opacity: 0.8 },
});
