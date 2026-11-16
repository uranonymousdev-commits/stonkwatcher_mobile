import { LocalizedText as Text } from "../../components/LocalizationContext";
import { SkeletonPage } from "../../components/Skeleton";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, router } from "expo-router";
import * as Linking from "expo-linking";
import { createSessionFromUrl } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../components/AuthContext";

export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const { loading, user } = useAuth();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      try {
        const callbackUrl = url ?? await Linking.getInitialURL();
        const session = callbackUrl ? await createSessionFromUrl(callbackUrl) : null;
        if (!session) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error("Sign in did not return a session. Please try again.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not finish sign in.");
        }
      } finally {
        if (!cancelled) setDone(true);
      }
    }
    void finish();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if ((!done || loading || !user) && !error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "transparent",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <SkeletonPage />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "transparent",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: "#FF574A", textAlign: "center" }}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/login")} style={{ padding: 16, marginTop: 16 }}>
          <Text style={{ color: "#BBDC12" }}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return <Redirect href="/wallet" />;
}
