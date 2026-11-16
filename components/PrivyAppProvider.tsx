import React from "react";
import { Platform } from "react-native";
import { PrivyProvider } from "@privy-io/expo";
import { PrivyElements } from "@privy-io/expo/ui";
import { PRIVY_APP_ID, PRIVY_CLIENT_ID } from "../lib/config";
import { isPrivyConfigured } from "../lib/privy-runtime";

export default function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  if (!isPrivyConfigured()) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{
        embedded: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
      {Platform.OS !== "web" ? <PrivyElements /> : null}
    </PrivyProvider>
  );
}
