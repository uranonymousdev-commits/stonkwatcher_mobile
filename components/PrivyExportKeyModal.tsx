import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useIdentityToken, usePrivy } from "@privy-io/expo";
import { WebView } from "react-native-webview";
import { Eye, EyeOff, X } from "lucide-react-native";
import { LocalizedText as Text, LocalizedAlert as Alert } from "./LocalizationContext";
import { ApiError, apiPost } from "../lib/api";
import { privyKeyExportUrl } from "../lib/privy-runtime";
import { COLORS, FONTS } from "../constants/theme";

type Props = {
  visible: boolean;
  address?: string;
  onClose: () => void;
};

type ExportResponse = {
  privateKey?: string;
  error?: string;
  code?: string;
};

function walletIdForAddress(
  linkedAccounts: unknown[] | undefined,
  address: string,
) {
  for (const account of linkedAccounts ?? []) {
    if (!account || typeof account !== "object") continue;
    const row = account as {
      type?: unknown;
      chain_type?: unknown;
      address?: unknown;
      id?: unknown;
      wallet_id?: unknown;
    };
    if (row.type !== "wallet") continue;
    if (row.chain_type && row.chain_type !== "solana") continue;
    if (String(row.address || "") !== address) continue;
    if (typeof row.id === "string" && row.id) return row.id;
    if (typeof row.wallet_id === "string" && row.wallet_id) return row.wallet_id;
  }
  return "";
}

/**
 * Native in-app private key export for Privy Solana wallets.
 * Tries partner API export first (access + identity JWT), then falls back to
 * Privy's official in-app WebView export page.
 */
export default function PrivyExportKeyModal({ visible, address, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { user, getAccessToken, refreshUser } = usePrivy();
  const { getIdentityToken } = useIdentityToken();
  const [loading, setLoading] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  const [useWebExport, setUseWebExport] = useState(false);
  const requestId = useRef(0);

  const exportPageUrl = privyKeyExportUrl(address);

  const close = useCallback(() => {
    setPrivateKey("");
    setRevealed(false);
    setError("");
    setLoading(false);
    setUseWebExport(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const addressValue = String(address || "").trim();
    const id = ++requestId.current;

    const timer = setTimeout(() => {
      if (!addressValue) {
        setError("No Solana wallet address to export.");
        setLoading(false);
        setUseWebExport(false);
        return;
      }

      setError("");
      setPrivateKey("");
      setRevealed(false);

      // Prefer Privy's official in-app WebView export — server JWT export is slow/unreliable on Expo.
      if (exportPageUrl) {
        setLoading(false);
        setUseWebExport(true);
        return;
      }

      setLoading(true);
      setUseWebExport(false);

      void (async () => {
        try {
          const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
            Promise.race([
              promise,
              new Promise<T>((_, reject) => {
                setTimeout(() => reject(new Error("Export timed out. Try again.")), ms);
              }),
            ]);

          await withTimeout(refreshUser().then(() => null).catch(() => null), 2_500);
          const [accessToken, identityToken] = await withTimeout(
            Promise.all([getAccessToken(), getIdentityToken()]),
            3_000,
          );
          if (!accessToken && !identityToken) {
            throw new Error("Sign in with Google again, then export your key.");
          }
          const walletId = walletIdForAddress(user?.linked_accounts, addressValue);
          const result = await withTimeout(
            apiPost<ExportResponse>("/api/wallet/export", {
              address: addressValue,
              accessToken: accessToken || undefined,
              identityToken: identityToken || undefined,
              walletId: walletId || undefined,
            }),
            6_000,
          );
          if (requestId.current !== id) return;
          if (!result.privateKey) {
            throw new Error(result.error || "Export returned no private key.");
          }
          setPrivateKey(result.privateKey);
        } catch (err) {
          if (requestId.current !== id) return;
          const message =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not export your private key.";
          setError(message);
        } finally {
          if (requestId.current === id) setLoading(false);
        }
      })();
    }, 0);

    return () => clearTimeout(timer);
  }, [
    visible,
    address,
    user,
    getAccessToken,
    getIdentityToken,
    refreshUser,
    exportPageUrl,
  ]);

  const copyKey = async () => {
    if (!privateKey) return;
    setRevealed(true);
    await Clipboard.setStringAsync(privateKey);
    Alert.alert("Copied", "Private key copied. Store it offline and never share it.");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={close}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Export Private Key</Text>
            <Text style={styles.subtitle}>
              Anyone with this key can move your funds. Copy it once, store it offline, then close
              this screen.
            </Text>
          </View>
          <Pressable
            onPress={close}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close export"
          >
            <X size={20} color={COLORS.white} />
          </Pressable>
        </View>

        {useWebExport && exportPageUrl ? (
          <View style={styles.webCard}>
            <Text style={styles.webHint}>
              Sign in on this secure sheet if asked, then tap Export to copy your Solana key.
            </Text>
            <WebView
              source={{ uri: exportPageUrl }}
              style={styles.webview}
              incognito
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data) as {
                    status?: string;
                    error?: string;
                  };
                  if (data.status === "success") {
                    Alert.alert("Exported", "Copy your private key from the sheet, then close.");
                  } else if (data.status === "error") {
                    setUseWebExport(false);
                    setError(data.error || "Web export failed.");
                  }
                } catch {
                  /* ignore non-JSON bridge messages */
                }
              }}
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator color={COLORS.stonkGreen} />
                </View>
              )}
            />
          </View>
        ) : (
          <View style={styles.card}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={COLORS.stonkGreen} />
                <Text style={styles.loadingText}>Preparing your Solana key…</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorTitle}>Export failed</Text>
                <Text style={styles.errorBody}>{error}</Text>
                <Text style={styles.hint}>
                  Check your connection and sign in again before retrying.
                </Text>
                {exportPageUrl ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      setError("");
                      setUseWebExport(true);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Open secure export sheet</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                <Text style={styles.label}>Solana private key (Base58)</Text>
                <Pressable
                  onPress={() => setRevealed((value) => !value)}
                  style={styles.keyBox}
                  accessibilityRole="button"
                  accessibilityLabel={revealed ? "Hide private key" : "Reveal private key"}
                >
                  <Text
                    style={styles.keyText}
                    selectable={revealed}
                    numberOfLines={revealed ? undefined : 2}
                  >
                    {revealed ? privateKey : "••••••••••••••••••••••••••••••••••••••••"}
                  </Text>
                  {revealed ? (
                    <EyeOff size={18} color="#A5A5A5" />
                  ) : (
                    <Eye size={18} color="#A5A5A5" />
                  )}
                </Pressable>

                <Pressable
                  style={styles.copyButton}
                  onPress={() => void copyKey()}
                  accessibilityRole="button"
                >
                  <Text style={styles.copyButtonText}>
                    {revealed ? "Copy Private Key" : "Reveal & Copy Private Key"}
                  </Text>
                </Pressable>

                {!revealed ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setRevealed(true)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Reveal Key</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        )}

        <Text style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          Close this screen when finished. Keep your private key somewhere safe and never share it.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#101010",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: "#A5A5A5",
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#171C05",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2F1A",
    padding: 16,
    minHeight: 220,
  },
  webCard: {
    flex: 1,
    backgroundColor: "#171C05",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2F1A",
    overflow: "hidden",
    minHeight: 360,
  },
  webHint: {
    color: "#B6B6B6",
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: "#101010",
  },
  webLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#101010",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 28,
  },
  loadingText: {
    color: "#CFCFCF",
    fontFamily: FONTS.regular,
    fontSize: 13,
  },
  errorTitle: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 16,
    fontWeight: "700",
  },
  errorBody: {
    color: "#FF8F85",
    fontFamily: FONTS.regular,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  hint: {
    color: "#8A8A8A",
    fontFamily: FONTS.regular,
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  label: {
    color: "#B6B6B6",
    fontFamily: FONTS.regular,
    fontSize: 12,
    marginBottom: 10,
  },
  keyBox: {
    backgroundColor: "#101010",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2F2F2F",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 72,
  },
  keyText: {
    flex: 1,
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  copyButton: {
    marginTop: 14,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.stonkGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  copyButtonText: {
    color: "#101010",
    fontFamily: FONTS.regular,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#41463B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    color: "#7A7A7A",
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
