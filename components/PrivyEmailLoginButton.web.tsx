import React from "react";

type Props = {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

/** Privy hosted login is native-only. */
export default function PrivyEmailLoginButton(_props: Props) {
  return null;
}
