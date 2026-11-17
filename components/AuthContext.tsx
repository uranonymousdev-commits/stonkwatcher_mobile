import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { signOut as supabaseSignOut, syncProfile } from "../lib/auth";
import {
  loadDemoSession,
  saveDemoAccount,
  startFreshDemo,
  signInDemo as persistDemoSignIn,
  signOutDemo as persistDemoSignOut,
  type DemoAccount,
  type DemoProvider,
} from "../lib/demo-account";
import {
  clearWalletSession,
  connectWallet,
  loadWalletSession,
  saveWalletSession,
  walletAccountId,
  type WalletProviderId,
  type WalletSession,
} from "../lib/wallet";
import { logoutPrivy } from "../lib/privy-runtime";
import { supabase, supabaseReady } from "../lib/supabase";
import { ensureWalletProfile } from "../lib/wallet-profile";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  demoAccount: DemoAccount | null;
  wallet: WalletSession | null;
  accountId: string | null;
  loading: boolean;
  configured: boolean;
  isSignedIn: boolean;
  isLiveWallet: boolean;
  signInWithDemo: (provider: DemoProvider) => Promise<DemoAccount>;
  signInWithWallet: (provider: WalletProviderId) => Promise<{ pending: boolean; hint?: string }>;
  completeWalletSignIn: (wallet: WalletSession) => Promise<WalletSession>;
  updateDemoAccount: (patch: Partial<DemoAccount>) => Promise<DemoAccount | null>;
  resetDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const [localWallet, localDemo] = await Promise.all([loadWalletSession(), loadDemoSession()]);
        if (!active) return;
        if (localWallet) {
          setWallet(localWallet);
          setDemoAccount(null);
          return;
        }
        if (!supabaseReady) {
          setDemoAccount(localDemo);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session ?? null);
        setDemoAccount(data.session ? null : localDemo);
        if (data.session?.user) {
          void persistDemoSignOut().catch(() => undefined);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void boot();

    if (!supabaseReady) {
      return () => {
        active = false;
      };
    }
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      if (next?.user) {
        setDemoAccount(null);
        void persistDemoSignOut().catch(() => undefined);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  useEffect(() => {
    if (user) void syncProfile(user).catch(() => undefined);
    // Run outside the auth callback: updateUser emits another auth event.
    // Once defaults exist, synchronization preserves the saved names.
  }, [user]);

  const signInWithDemo = useCallback(async (provider: DemoProvider) => {
    await clearWalletSession();
    setWallet(null);
    const account = await persistDemoSignIn(provider);
    setDemoAccount(account);
    setSession(null);
    return account;
  }, []);

  const completeWalletSignIn = useCallback(async (next: WalletSession) => {
    const saved = await saveWalletSession(next);
    await persistDemoSignOut();
    // Seed a random-looking editable username for Privy / live wallets.
    if (saved.provider === "privy" || saved.address) {
      await ensureWalletProfile(saved.address).catch(() => undefined);
    }
    setDemoAccount(null);
    setWallet(saved);
    setSession(null);
    return saved;
  }, []);

  const signInWithWallet = useCallback(
    async (provider: WalletProviderId) => {
      const result = await connectWallet(provider);
      if (result.session) {
        await completeWalletSignIn(result.session);
        return { pending: false };
      }
      if (result.jupiter) {
        return { pending: true, hint: result.jupiter.hint };
      }
      return { pending: true };
    },
    [completeWalletSignIn],
  );

  const updateDemoAccount = useCallback(async (patch: Partial<DemoAccount>) => {
    const latest = await loadDemoSession();
    if (!latest) return null;
    const saved = await saveDemoAccount({ ...latest, ...patch });
    setDemoAccount(saved);
    return saved;
  }, []);

  const resetDemo = useCallback(async () => {
    if (demoAccount) setDemoAccount(await startFreshDemo(demoAccount.provider));
  }, [demoAccount]);

  const signOut = useCallback(async () => {
    await Promise.all([
      persistDemoSignOut(),
      clearWalletSession(),
      logoutPrivy().catch(() => undefined),
    ]);
    setDemoAccount(null);
    setWallet(null);
    if (supabaseReady) {
      try {
        await supabaseSignOut();
      } catch {
        /* local sign-out still wins */
      }
    }
    setSession(null);
  }, []);

  const accountId = wallet
    ? walletAccountId(wallet)
    : demoAccount?.id ?? session?.user?.id ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      demoAccount,
      wallet,
      accountId,
      loading,
      configured: supabaseReady,
      isSignedIn: Boolean(wallet || demoAccount || session?.user),
      // Live = on-chain wallet session (Privy / Phantom / Jupiter). Guest demo is never live.
      isLiveWallet: Boolean(wallet?.address),
      signInWithDemo,
      signInWithWallet,
      completeWalletSignIn,
      updateDemoAccount,
      resetDemo,
      signOut,
    }),
    [
      session,
      demoAccount,
      wallet,
      accountId,
      loading,
      signInWithDemo,
      signInWithWallet,
      completeWalletSignIn,
      updateDemoAccount,
      resetDemo,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
