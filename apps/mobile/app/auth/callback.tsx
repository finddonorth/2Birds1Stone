import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { mobileSupabase } from "../../lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    async function completeAuth() {
      if (!mobileSupabase || !params.code || Array.isArray(params.code)) {
        router.replace("/");
        return;
      }

      await mobileSupabase.auth.exchangeCodeForSession(params.code);
      router.replace("/");
    }

    void completeAuth();
  }, [params.code, router]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color="#d96b2b" />
      <Text style={styles.text}>Finishing sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#f6f0e8"
  },
  text: {
    color: "#17212b",
    fontSize: 16
  }
});
