import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { confirmSquads, fetchScoringContext, type ScoringContext } from "../../../lib/api";

export default function SquadsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const router = useRouter();
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await fetchScoringContext(matchId);
    setCtx(data);
  }, [matchId]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refresh]);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      await confirmSquads(matchId);
      router.push(`/match/${matchId}/toss`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm squads");
    } finally {
      setBusy(false);
    }
  }

  if (!ctx) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  if (ctx.squadsConfirmed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Squads confirmed</Text>
        <View style={styles.card}>
          <Text style={styles.team}>{ctx.homeTeam.name}</Text>
          <Text style={styles.players}>{ctx.squads.home.map((p) => p.name).join(", ")}</Text>
          <Text style={[styles.team, { marginTop: 12 }]}>{ctx.awayTeam.name}</Text>
          <Text style={styles.players}>{ctx.squads.away.map((p) => p.name).join(", ")}</Text>
        </View>
        <Pressable style={styles.btn} onPress={() => router.push(`/match/${matchId}/toss`)}>
          <Text style={styles.btnText}>Continue to toss →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const ready =
    ctx.squads.home.length >= ctx.playersPerSide &&
    ctx.squads.away.length >= ctx.playersPerSide;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>1. Match squads</Text>
      <Text style={styles.sub}>
        {ctx.playersPerSide} players per side. Edit squads on the web scorer if needed.
      </Text>

      <View style={styles.card}>
        <Text style={styles.team}>{ctx.homeTeam.name}</Text>
        <Text style={styles.players}>
          {ctx.squads.home.length > 0
            ? ctx.squads.home.map((p) => p.name).join(", ")
            : "No players selected"}
        </Text>
        <Text style={[styles.team, { marginTop: 12 }]}>{ctx.awayTeam.name}</Text>
        <Text style={styles.players}>
          {ctx.squads.away.length > 0
            ? ctx.squads.away.map((p) => p.name).join(", ")
            : "No players selected"}
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.btn, (!ready || busy) && styles.btnDisabled]}
        onPress={onConfirm}
        disabled={!ready || busy}
      >
        <Text style={styles.btnText}>{busy ? "Saving…" : "Confirm squads & continue"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f7" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 22, fontWeight: "800", color: "#0B4169" },
  sub: { color: "#666", marginTop: 6, marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 16 },
  team: { fontWeight: "700", color: "#0B4169" },
  players: { color: "#444", marginTop: 4, fontSize: 14 },
  btn: {
    backgroundColor: "#0B4169",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 12 },
});
