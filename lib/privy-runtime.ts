import { Platform } from "react-native";
import {
  PRIVY_APP_ID,
  PRIVY_CLIENT_ID,
  PRIVY_KEY_EXPORT_URL,
} from "./config";

export type PrivyTxSigner = (transactionBase64: string) => Promise<string>;

let signer: PrivyTxSigner | null = null;
let logoutFn: (() => Promise<void>) | null = null;

export function isPrivyConfigured() {
  return (
    Platform.OS !== "web" &&
    Boolean(PRIVY_APP_ID.trim() && PRIVY_CLIENT_ID.trim())
  );
}

export function registerPrivySigner(next: PrivyTxSigner | null) {
  signer = next;
}

export function registerPrivyLogout(next: (() => Promise<void>) | null) {
  logoutFn = next;
}

export async function signWithPrivy(transactionBase64: string) {
  if (!signer) {
    throw new Error("Embedded wallet is not ready. Sign in with email again.");
  }
  return signer(transactionBase64);
}

export async function logoutPrivy() {
  if (!logoutFn) return;
  await logoutFn();
}

export function privyKeyExportUrl(address?: string) {
  const base = PRIVY_KEY_EXPORT_URL.replace(/\/$/, "");
  if (!base) return "";
  if (!address) return base;
  const url = new URL(base);
  url.searchParams.set("address", address);
  return url.toString();
}
