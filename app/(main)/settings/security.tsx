import { LocalizedText as Text, LocalizedAlert as Alert } from "../../../components/LocalizationContext";
import { useAuth } from "../../../components/AuthContext";
import { privyKeyExportUrl } from "../../../lib/privy-runtime";

import React, { useState } from "react";
import { View, Switch, StyleSheet, Pressable, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Page, lime } from "../../../components/SettingsUI";
import { useSettings } from "../../../components/SettingsContext";

export default function Security() {
  const { prefs, update } = useSettings();
  const { wallet } = useAuth();
  const [locked, setLocked] = useState(prefs.screenLock);
  const canExport = wallet?.provider === "privy" && Boolean(wallet.address);

  const saveChanges = () => {
    update({ screenLock: locked });
    Alert.alert(
      "Saved",
      "Demo screen lock preference saved. Device authentication is not enabled.",
    );
  };

  const exportKeys = async () => {
    if (!canExport || !wallet?.address) {
      Alert.alert(
        "Export keys",
        "Sign in with Google / email to create your in-app wallet, then export its private key.",
      );
      return;
    }
    const url = privyKeyExportUrl(wallet.address);
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
    <Page title="Security" action="Save Changes" onAction={saveChanges}>
      <View style={styles.container}>
        <View style={styles.row}>
          <Text style={styles.label}>Screen Lock</Text>

          <View style={styles.switchWrapper}>
            <Switch
              value={locked}
              onValueChange={setLocked}
              trackColor={{
                false: "#303030",
                true: lime,
              }}
              thumbColor="#171717"
              ios_backgroundColor="#303030"
            />
          </View>
        </View>

        <Pressable
          style={styles.exportRow}
          onPress={() => void exportKeys()}
          accessibilityRole="button"
          accessibilityLabel="Export wallet private key"
        >
          <View style={styles.exportCopy}>
            <Text style={styles.label}>Export Private Key</Text>
            <Text style={styles.caption}>
              {canExport
                ? "Opens a secure web page to copy your Solana key (Base58)."
                : "Available after Google / email sign-in."}
            </Text>
          </View>
          <Text style={styles.exportAction}>{canExport ? "Export" : "N/A"}</Text>
        </Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: 0,
  },
  row: {
    width: "100%",
    height: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    includeFontPadding: false,
  },
  caption: {
    color: "#8A8A8A",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  switchWrapper: {
    height: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  exportRow: {
    width: "100%",
    minHeight: 72,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2A2A2A",
  },
  exportCopy: {
    flex: 1,
  },
  exportAction: {
    color: lime,
    fontSize: 14,
    fontWeight: "600",
  },
});
