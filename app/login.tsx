import { LocalizedText as Text, LocalizedAlert as Alert } from "../components/LocalizationContext";
import { useAuth } from "../components/AuthContext";
import { AuthCancelledError, signInWithGoogle } from "../lib/auth";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useReducedMotion } from "react-native-reanimated";
import GuestIcon from "../assets/login/guest.svg";
import GoogleIcon from "../assets/login/google.svg";
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
  const { signInWithDemo, signInWithWallet } = useAuth();
  const reducedMotion = useReducedMotion();
  const signingIn = useRef(false);
  const [busyProvider, setBusyProvider] = useState<"guest" | "google" | null>(null);
  const busy = busyProvider !== null;
  const [busy, setBusy] = useState<"guest" | "phantom" | "jupiter" | null>(null);
  const [animationFailed, setAnimationFailed] = useState(false);

  const continueAsGuest = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusyProvider("guest");
    setBusy("guest");
    try {
      await signInWithDemo("guest");
      router.replace("/wallet");
    } catch {
      Alert.alert("Sign in failed", "Could not start the guest account. Please try again.");
    } finally {
      signingIn.current = false;
        setBusyProvider(null);
    }
  };

  const continueWithGoogle = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusyProvider("google");
    try {
      const session = await signInWithGoogle();
      if (session) router.replace("/wallet");
    } catch (error) {
      if (!(error instanceof AuthCancelledError)) {
        Alert.alert("Sign in failed", error instanceof Error ? error.message : "Could not sign in with Google. Please try again.");
      }
    } finally {
      signingIn.current = false;
      setBusyProvider(null);
      setBusy(null);
    }
  };

  const continueWithWallet = async (provider: "phantom" | "jupiter") => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(provider);
    try {
      const result = await signInWithWallet(provider);
      if (!result.pending) {
        router.replace("/wallet");
        return;
      }
      if (provider === "jupiter") {
        Alert.alert(
          "Connect in Jupiter",
          result.hint ||
            "Open Jupiter, tap the globe, open stonkwatcher.xyz, then approve the wallet connect prompt for live trading.",
        );
      }
      // Phantom deeplink returns via wallet-callback route.
    } catch (error) {
      Alert.alert(
        "Wallet connect failed",
        error instanceof Error ? error.message : "Could not connect this wallet.",
      );
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
            {reducedMotion || animationFailed ? <Logo /> : (
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
          <Pressable
            onPress={() => void continueAsGuest()}
            disabled={Boolean(busy)}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
            accessibilityState={{ disabled: busy, busy: busyProvider === "guest" }}
            style={({ pressed }) => [styles.button, styles.guestButton, pressed && styles.pressed]}
          >
            {busyProvider === "guest" ? <ActivityIndicator color="#101010" /> : <>
            accessibilityState={{ disabled: Boolean(busy), busy: busy === "guest" }}
            style={({ pressed }) => [styles.button, styles.guestButton, pressed && styles.pressed]}
          >
            {busy === "guest" ? <ActivityIndicator color="#101010" /> : <>
              <GuestIcon />
              <Text style={styles.buttonText}>Continue as Guest</Text>
            </>}
          </Pressable>
          <Pressable
            onPress={() => void continueWithGoogle()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            accessibilityState={{ disabled: busy, busy: busyProvider === "google" }}
            style={({ pressed }) => [styles.button, styles.googleButton, pressed && styles.pressed]}
          >
            {busyProvider === "google" ? <ActivityIndicator color="#101010" /> : <>
              <GoogleIcon />
              <Text style={styles.buttonText}>Sign in with Google</Text>
            </>}
          </Pressable>
          <View style={styles.walletButtons}>
            <Pressable
              onPress={() => void continueWithWallet("phantom")}
              disabled={Boolean(busy)}
              accessibilityRole="button"
              accessibilityLabel="Phantom"
              accessibilityState={{ disabled: Boolean(busy), busy: busy === "phantom" }}
              style={({ pressed }) => [styles.button, styles.walletButton, pressed && styles.pressed]}
            >
              {busy === "phantom" ? <ActivityIndicator color="#101010" /> : <>
                <PhantomIcon />
                <Text style={styles.buttonText}>Phantom</Text>
              </>}
            </Pressable>
            <Pressable
              onPress={() => void continueWithWallet("jupiter")}
              disabled={Boolean(busy)}
              accessibilityRole="button"
              accessibilityLabel="Jupiter"
              accessibilityState={{ disabled: Boolean(busy), busy: busy === "jupiter" }}
              style={({ pressed }) => [styles.button, styles.walletButton, pressed && styles.pressed]}
            >
              {busy === "jupiter" ? <ActivityIndicator color="#101010" /> : <>
                <JupiterIcon />
                <Text style={styles.buttonText}>Jupiter</Text>
              </>}
            </Pressable>
          </View>
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
  content: { flexGrow: 1, minHeight: 540, paddingHorizontal: 16, justifyContent: "space-between", alignItems: "center", gap: 32 },
  topSpacer: { height: 32 },
  brand: { alignItems: "center", gap: 16 },
  logo: { width: 79.358, height: 82 },
  title: { fontFamily: "GoogleSansFlex", fontSize: 32, fontWeight: "600", color: BRAND, letterSpacing: -0.64, textAlign: "center" },
  actions: { width: "100%", gap: 12 },
  button: { minHeight: 53, padding: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  guestButton: { backgroundColor: BRAND },
  googleButton: { backgroundColor: "#FFFFFF" },
  buttonText: { fontFamily: "GoogleSansFlex", fontSize: 16, lineHeight: 21, fontWeight: "600", letterSpacing: -0.32, color: "#101010", flexShrink: 1 },
  pressed: { opacity: 0.8 },
});
