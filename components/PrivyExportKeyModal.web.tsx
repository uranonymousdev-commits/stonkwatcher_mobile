import React, { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import { privyKeyExportUrl } from "../lib/privy-runtime";

type Props = {
  visible: boolean;
  address?: string;
  onClose: () => void;
};

/** Web: open the hosted Privy export page in a browser tab. */
export default function PrivyExportKeyModal({ visible, address, onClose }: Props) {
  useEffect(() => {
    if (!visible) return;
    const url = privyKeyExportUrl(address);
    if (!url) {
      onClose();
      return;
    }
    void WebBrowser.openBrowserAsync(url).finally(() => onClose());
  }, [visible, address, onClose]);

  return null;
}
