import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { apiUrl, createIosDemoMatch } from "../lib/api";

export default function HomeScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDemo() {
    setBusy(true);
    setError(null);
    try {
      const demo = await createIosDemoMatch();
      router.push(`/match/${demo.matchId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start demo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Howzzat Scorer</Text>
      <Text style={styles.subtitle}>2 overs per side · live API</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>iOS live demo</Text>
        <Text style={styles.cardBody}>
          Both teams bat 2 overs. Toss → squads → ball-by-ball (wides, byes, nb)
          → 2nd innings → result → live dashboard.
        </Text>
        <Text style={styles.api}>API: {apiUrl("")}</Text>
      </View>

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={startDemo}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Start 2-over match</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <Link href="/score" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Offline rules demo</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#eef2f7",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B4169",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0B4169" },
  cardBody: { fontSize: 14, color: "#666", marginTop: 6, lineHeight: 20 },
  api: { fontSize: 11, color: "#999", marginTop: 10 },
  button: {
    backgroundColor: "#54ACEE",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { marginTop: 16, padding: 12, alignItems: "center" },
  secondaryText: { color: "#3d85c6", fontWeight: "600" },
  error: { color: "#c0392b", textAlign: "center", marginTop: 12 },
});
