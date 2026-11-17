import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { X } from "lucide-react-native";
import { LocalizedText as Text, LocalizedAlert as Alert } from "./LocalizationContext";
import { privyKeyExportUrl } from "../lib/privy-runtime";
import { COLORS, FONTS } from "../constants/theme";

type Props = {
  visible: boolean;
  address?: string;
  onClose: () => void;
};

/**
 * In-app Privy Solana key export.
 * Privy only assembles private keys in a secure browser context, so we host
 * that flow inside a Modal WebView (not the external browser).
 * @see https://docs.privy.io/recipes/mobile-key-export
 */
export default function PrivyExportKeyModal({ visible, address, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const closed = useRef(false);

  const uri = useMemo(() => privyKeyExportUrl(address), [address]);

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    setLoading(true);
    onClose();
    // Allow reopening after dismiss.
    setTimeout(() => {
      closed.current = false;
    }, 300);
  }, [onClose]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(String(event.nativeEvent.data || "{}")) as {
          status?: string;
          error?: string;
        };
        if (data.status === "success") {
          close();
          return;
        }
        if (data.status === "error") {
          Alert.alert(
            "Export failed",
            data.error || "Could not export your private key. Try again.",
          );
          close();
        }
      } catch {
        /* ignore non-JSON page messages */
      }
    },
    [close],
  );

  if (!uri) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={close}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Export Private Key</Text>
            <Text style={styles.subtitle}>
              Copy your Solana key securely, then store it offline. Never share it.
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

        <View style={styles.webviewWrap}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={COLORS.stonkGreen} />
              <Text style={styles.loadingText}>Loading secure export…</Text>
            </View>
          ) : null}
          <WebView
            source={{ uri }}
            onMessage={onMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              Alert.alert(
                "Export unavailable",
                "Could not open the export page. Check your connection and try again.",
              );
            }}
            style={styles.webview}
            originWhitelist={["https://*", "http://*"]}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            // Avoid caching login/export material on device.
            {...(Platform.OS === "ios" ? { incognito: true } : null)}
            startInLoadingState
          />
        </View>

        <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <Text style={styles.footer}>
            Privy shows the key in a secure popup so you can copy it. The key never passes through
            Stonk Watcher servers.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#101010",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: COLORS.white,
    fontFamily: FONTS.regular,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: "#A5A5A5",
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  webviewWrap: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#171C05",
    borderWidth: 1,
    borderColor: "#2A2F1A",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(16,16,16,0.72)",
  },
  loadingText: {
    color: "#CFCFCF",
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  footer: {
    color: "#7A7A7A",
    fontFamily: FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
