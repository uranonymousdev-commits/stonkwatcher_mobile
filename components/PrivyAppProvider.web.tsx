import React from "react";

/** Privy is native-only; web keeps Phantom / Jupiter connect. */
export default function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
