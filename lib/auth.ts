import * as Linking from "expo-linking";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import type { User } from "@supabase/supabase-js";
import { AUTH_REDIRECT_PATH } from "./config";
import { supabase, supabaseReady } from "./supabase";
import { missingProfileMetadata, profileIdentity } from "./profile-identity";

WebBrowser.maybeCompleteAuthSession();

export type AuthProvider = "google";

export class AuthCancelledError extends Error {
  constructor() {
    super("Sign in was cancelled.");
    this.name = "AuthCancelledError";
  }
}

function requireSupabase() {
  if (!supabaseReady) {
    throw new Error(
      "Google sign-in is not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env, then restart Expo.",
    );
  }
}

export function authRedirectUri() {
  return makeRedirectUri({
    scheme: "stonkwatcher",
    path: AUTH_REDIRECT_PATH,
  });
}

function tokensFromUrl(url: string) {
  const normalized = url.replace("#", url.includes("?") ? "&" : "?");
  const parsed = Linking.parse(normalized);
  const query = parsed.queryParams ?? {};
  const read = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };
  return {
    access_token: read("access_token"),
    refresh_token: read("refresh_token"),
    error: read("error_description") || read("error"),
  };
}

export async function createSessionFromUrl(url: string) {
  const { access_token, refresh_token, error } = tokensFromUrl(url);
  if (error) throw new Error(error);
  if (!access_token) return null;
  if (!refresh_token) throw new Error("Sign in did not return a refresh token. Please try again.");
  const { data, error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) throw sessionError;
  return data.session;
}

export async function syncProfile(user: User) {
  const missing = missingProfileMetadata(user);
  if (Object.keys(missing).length) {
    const { data, error } = await supabase.auth.updateUser({ data: missing });
    if (error) throw error;
    user = data.user;
  }
  const provider =
    (user.app_metadata?.provider as string | undefined) ||
    (user.app_metadata?.providers as string[] | undefined)?.[0] ||
    null;
  const metadata = user.user_metadata ?? {};
  const { displayName } = profileIdentity(user);
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      provider,
      display_name: displayName,
      avatar_url: typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw error;
  }
}

export async function signInWithOAuth(provider: AuthProvider) {
  requireSupabase();
  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== "web",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Could not start the sign-in session.");
  // Web navigates in the same tab; the callback route finishes the session.
  if (Platform.OS === "web") return null;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new AuthCancelledError();
  const session = await createSessionFromUrl(result.url);
  if (!session?.user) throw new Error("Sign in did not return a session.");
  return session;
}

export async function signInWithGoogle() {
  return signInWithOAuth("google");
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function accountLabel(user: User | null) {
  if (!user) return "Not signed in";
  const metadata = user.user_metadata ?? {};
  return (
    user.email ||
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "Signed in"
  );
}

export function providerLabel(user: User | null) {
  const provider =
    (user?.app_metadata?.provider as string | undefined) ||
    (user?.app_metadata?.providers as string[] | undefined)?.[0];
  if (provider === "apple") return "Apple";
  if (provider === "google") return "Google";
  return provider ? provider[0].toUpperCase() + provider.slice(1) : "Account";
}
