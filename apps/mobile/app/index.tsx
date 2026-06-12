import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { apiUrl, createIosDemoMatch, createU9DemoMatch } from "../lib/api";
import {
  fetchCurrentUser,
  signOut,
  useGoogleSignIn,
  type AuthUser,
} from "../lib/auth";

export default function HomeScreen() {
  const router = useRouter();
  const google = useGoogleSignIn();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyU9, setBusyU9] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!google.busy && !google.error) {
      void refreshUser();
    }
  }, [google.busy, google.error, refreshUser]);

  async function startDemo(create: () => Promise<{ matchId: string }>, setLoading: (v: boolean) => void) {
    setLoading(true);
    setError(null);
    try {
      const demo = await create();
      router.push(`/match/${demo.matchId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start demo");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/icon.png")}
        style={styles.logo}
        accessibilityLabel="Howzzat"
      />
      <Text style={styles.subtitle}>Cricket Scoring</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live demo</Text>
        <Text style={styles.cardBody}>
          Run a pairs match without signing in: squads → toss → ball-by-ball → result →
          live dashboard.
        </Text>
        <Text style={styles.api}>API: {apiUrl("")}</Text>
      </View>

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => startDemo(createIosDemoMatch, setBusy)}
        disabled={busy || busyU9}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Start 2-over match</Text>
        )}
      </Pressable>

      <Pressable
        style={[styles.button, busyU9 && styles.buttonDisabled]}
        onPress={() => startDemo(createU9DemoMatch, setBusyU9)}
        disabled={busy || busyU9}
      >
        {busyU9 ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Start U9 4-over match</Text>
        )}
      </Pressable>

      {(error || google.error) && (
        <Text style={styles.error}>{error ?? google.error}</Text>
      )}

      <Link href="/score" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Offline rules demo</Text>
        </Pressable>
      </Link>

      {checkingAuth ? (
        <ActivityIndicator color="#94a3b8" style={styles.authSpinner} />
      ) : user ? (
        <View style={styles.userCard}>
          <Text style={styles.userLabel}>Signed in (optional)</Text>
          <Text style={styles.userName}>{user.name ?? user.email}</Text>
          <Pressable onPress={handleSignOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.googleBtn, (!google.ready || google.busy) && styles.buttonDisabled]}
          onPress={() => void google.signIn()}
          disabled={!google.ready || google.busy}
        >
          {google.busy ? (
            <ActivityIndicator color="#0B4169" />
          ) : (
            <Text style={styles.googleBtnText}>Sign in with Google (optional)</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
    padding: 24,
    paddingTop: 48,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 8,
    borderRadius: 16,
  },
  subtitle: {
    fontSize: 15,
    color: "#5a6a7a",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B4169",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: "#4a5568",
    lineHeight: 20,
    marginBottom: 10,
  },
  api: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: "Menlo",
  },
  userCard: {
    backgroundColor: "#e8f4ec",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#b8dfc4",
  },
  userLabel: {
    fontSize: 12,
    color: "#2d6a3e",
    fontWeight: "600",
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B4169",
  },
  signOut: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
    textDecorationLine: "underline",
  },
  googleBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  googleBtnText: {
    color: "#0B4169",
    fontSize: 16,
    fontWeight: "700",
  },
  button: {
    backgroundColor: "#0B4169",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondary: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: "#0B4169",
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#b91c1c",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  authSpinner: {
    marginTop: 16,
  },
});
