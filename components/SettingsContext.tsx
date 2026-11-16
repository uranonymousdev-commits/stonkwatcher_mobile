import { useLocalization } from "./LocalizationContext";
import { useAuth } from "./AuthContext";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { restoreProfileAvatar } from "../utils/profile-avatar";
import type { DemoAccount } from "../lib/demo-account";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { profileIdentity } from "../lib/profile-identity";

const AVATAR_KEY = "stonkwatcher.profile-avatar.v1";

type Preferences = {
  name: string;
  username: string;
  bio: string;
  paperTrade: boolean;
  avatarUri: string | null;
  notifications: boolean;
  positions: boolean;
  rug: boolean;
  rewards: boolean;
  announcements: boolean;
  screenLock: boolean;
  language: string;
};

const basePrefs: Preferences = {
  name: "Guest",
  username: "@guest",
  bio: "",
  avatarUri: null,
  paperTrade: false,
  notifications: true,
  positions: false,
  rug: true,
  rewards: false,
  announcements: true,
  screenLock: true,
  language: "System (English)",
};

function prefsFromAccount(account: DemoAccount | null, user: User | null, language: string, avatarUri: string | null): Preferences {
  if (!account) {
    if (user) {
      const identity = profileIdentity(user);
      return {
        ...basePrefs,
        name: identity.displayName,
        username: `@${identity.username}`,
        bio: typeof user.user_metadata?.bio === "string" ? user.user_metadata.bio : "",
        paperTrade: user.user_metadata?.paper_trade === true,
        language,
        avatarUri,
      };
    }
    return { ...basePrefs, language, avatarUri };
  }
  return {
    ...basePrefs,
    name: account.displayName,
    username: account.username.startsWith("@") ? account.username : `@${account.username}`,
    bio: account.bio,
    paperTrade: account.paperTrade,
    language,
    avatarUri,
  };
}

function avatarKeyFor(accountId: string | null) {
  return accountId ? `${AVATAR_KEY}.${accountId}` : AVATAR_KEY;
}

const C = createContext<{
  prefs: Preferences;
  update: (x: Partial<Preferences>) => Promise<void>;
} | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { demoAccount, user, accountId, updateDemoAccount } = useAuth();
  const { preference, saveLanguage } = useLocalization();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [localPrefs, setLocalPrefs] = useState<Preferences>(() =>
    prefsFromAccount(demoAccount, user, preference, null),
  );
  const avatarChanged = useRef(false);
  const avatarWrite = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    avatarChanged.current = false;
    setAvatarUri(null);
    setLocalPrefs(prefsFromAccount(demoAccount, user, preference, null));
    void AsyncStorage.getItem(avatarKeyFor(accountId)).then((saved) => {
      if (cancelled || avatarChanged.current || !saved) return;
      const next = restoreProfileAvatar(saved);
      setAvatarUri(next);
      setLocalPrefs((current) => ({ ...current, avatarUri: next }));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Reload when the account or its saved profile fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, demoAccount?.id, user?.user_metadata?.display_name, user?.user_metadata?.username, user?.user_metadata?.bio, user?.user_metadata?.paper_trade, preference]);

  const prefsRef = useRef(localPrefs);
  useEffect(() => {
    prefsRef.current = localPrefs;
  }, [localPrefs]);

  const update = useCallback(
    async (x: Partial<Preferences>) => {
      if (user && !demoAccount) {
        const data: Record<string, string | boolean> = {};
        if (x.name !== undefined) data.display_name = x.name.trim();
        if (x.username !== undefined) data.username = x.username.replace(/^@+/, "").trim();
        if (x.bio !== undefined) data.bio = x.bio;
        if (x.paperTrade !== undefined) data.paper_trade = x.paperTrade;
        if (Object.keys(data).length) {
          // Optimistic: show the new profile fields right away, roll them back if Supabase rejects.
          const before = prefsRef.current;
          const rollback: Partial<Preferences> = {};
          for (const key of ["name", "username", "bio", "paperTrade"] as const) {
            if (x[key] !== undefined) (rollback as Record<string, unknown>)[key] = before[key];
          }
          setLocalPrefs((p) => ({ ...p, ...x }));
          const { error } = await supabase.auth.updateUser({ data });
          if (error) {
            setLocalPrefs((p) => ({ ...p, ...rollback }));
            throw error;
          }
        }
      }
      if (x.language) void saveLanguage(x.language).catch(() => undefined);
      if (x.avatarUri !== undefined) {
        avatarChanged.current = true;
        const uri = x.avatarUri;
        setAvatarUri(uri);
        avatarWrite.current = avatarWrite.current
          .then(() =>
            uri
              ? AsyncStorage.setItem(avatarKeyFor(accountId), uri)
              : AsyncStorage.removeItem(avatarKeyFor(accountId)),
          )
          .catch(() => undefined);
      }
      setLocalPrefs((p) => ({ ...p, ...x }));
      if (demoAccount) {
        const patch: Partial<DemoAccount> = {};
        if (x.name !== undefined) patch.displayName = x.name;
        if (x.username !== undefined) patch.username = x.username;
        if (x.bio !== undefined) patch.bio = x.bio;
        if (x.paperTrade !== undefined) patch.paperTrade = x.paperTrade;
        if (Object.keys(patch).length) await updateDemoAccount(patch);
      }
    },
    [accountId, demoAccount, user, saveLanguage, updateDemoAccount],
  );

  const value = useMemo(
    () => ({ prefs: { ...localPrefs, language: preference, avatarUri }, update }),
    [localPrefs, preference, avatarUri, update],
  );

  return (
    <C.Provider value={value}>
      {children}
    </C.Provider>
  );
}

export function useSettings() {
  const v = useContext(C);
  if (!v) throw Error("SettingsProvider missing");
  return v;
}
