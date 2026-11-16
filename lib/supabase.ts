import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { tracedFetch } from "./telemetry";

export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL || "https://unconfigured.supabase.co", SUPABASE_ANON_KEY || "missing", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // The callback route handles tokens on every platform.
    detectSessionInUrl: false,
  },
  // Trace auth/profile calls too; Supabase isn't in the propagation list, so no extra headers are sent.
  global: { fetch: (input, init) => tracedFetch(input, init) },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
