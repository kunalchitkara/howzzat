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
import {
  fetchScoringContext,
  recordToss,
  type ScoringContext,
} from "../../../lib/api";

export default function TossScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const router = useRouter();
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [electedTo, setElectedTo] = useState<"bat" | "bowl">("bat");

  const refresh = useCallback(async () => {
    const data = await fetchScoringContext(matchId);
    setCtx(data);
    if (data.toss.tossWinnerTeamId) {
      setWinnerTeamId(data.toss.tossWinnerTeamId);
      setElectedTo((data.toss.electedTo as "bat" | "bowl") ?? "bat");
    }
  }, [matchId]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refresh]);

  async function saveToss() {
    if (!winnerTeamId) return;
    setBusy(true);
    setError(null);
    try {
      await recordToss(matchId, {
        tossWinnerTeamId: winnerTeamId,
        electedTo,
      });
      router.push(`/match/${matchId}/score`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save toss");
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

  if (ctx.toss.tossWinnerTeamId && ctx.status !== "SCHEDULED") {
    const winnerName = ctx.toss.tossWinnerName ?? "Winner";
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Toss recorded</Text>
        <View style={styles.card}>
          <Text style={styles.line}>
            <Text style={styles.bold}>{winnerName}</Text> won the toss and elected to{" "}
            <Text style={styles.bold}>{ctx.toss.electedTo}</Text>
          </Text>
        </View>
        <Pressable style={styles.btn} onPress={() => router.push(`/match/${matchId}/score`)}>
          <Text style={styles.btnText}>Continue to scoring →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Record the toss</Text>
      <Text style={styles.sub}>Which team won, and what did they choose?</Text>

      <Text style={styles.section}>Toss winner</Text>
      {[ctx.homeTeam, ctx.awayTeam].map((team) => (
        <Pressable
          key={team.id}
          style={[styles.option, winnerTeamId === team.id && styles.optionOn]}
          onPress={() => setWinnerTeamId(team.id)}
        >
          <Text style={styles.optionText}>{team.name}</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Winner elected to</Text>
      <View style={styles.row}>
        {(["bat", "bowl"] as const).map((choice) => (
          <Pressable
            key={choice}
            style={[styles.choice, electedTo === choice && styles.choiceOn]}
            onPress={() => setElectedTo(choice)}
          >
            <Text style={[styles.choiceText, electedTo === choice && styles.choiceTextOn]}>
              {choice === "bat" ? "Bat" : "Bowl"}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.btn, (!winnerTeamId || busy) && styles.btnDisabled]}
        onPress={saveToss}
        disabled={!winnerTeamId || busy}
      >
        <Text style={styles.btnText}>{busy ? "Saving…" : "Save toss & start match"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f7" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 22, fontWeight: "800", color: "#0B4169" },
  sub: { color: "#666", marginTop: 6, marginBottom: 20 },
  section: { fontWeight: "700", color: "#0B4169", marginTop: 16, marginBottom: 8 },
  option: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionOn: { borderColor: "#54ACEE" },
  optionText: { fontSize: 15 },
  row: { flexDirection: "row", gap: 10 },
  choice: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  choiceOn: { borderColor: "#54ACEE", backgroundColor: "#d6eaf8" },
  choiceText: { fontWeight: "700", color: "#666" },
  choiceTextOn: { color: "#0B4169" },
  btn: {
    backgroundColor: "#0B4169",
    padding: 16,
    borderRadius: 10,
    marginTop: 24,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginVertical: 16 },
  line: { fontSize: 15, color: "#333", marginBottom: 8 },
  bold: { fontWeight: "700", color: "#0B4169" },
  error: { color: "#c0392b", marginTop: 12, textAlign: "center" },
});
