import React, { useEffect } from "react";
import { LocalizedAlert as Alert } from "./LocalizationContext";

type Props = {
  visible: boolean;
  address?: string;
  onClose: () => void;
};

/** Web: private key export is native-only (Privy Expo + partner API). */
export default function PrivyExportKeyModal({ visible, onClose }: Props) {
  useEffect(() => {
    if (!visible) return;
    Alert.alert(
      "Export on mobile",
      "Private key export is available in the iOS / Android app after Google sign-in.",
    );
    onClose();
  }, [visible, onClose]);

  return null;
}
