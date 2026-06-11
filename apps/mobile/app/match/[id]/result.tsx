import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch, fetchScoringContext, type ScoringContext } from "../../../lib/api";

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const router = useRouter();
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marginText, setMarginText] = useState("");
  const [marginEdited, setMarginEdited] = useState(false);

  const refresh = useCallback(async () => {
    const data = await fetchScoringContext(matchId);
    setCtx(data);
  }, [matchId]);

  useEffect(() => {
    refresh()
      .then((data) => {
        if (data.suggestedResult && !marginEdited) {
          setMarginText(data.suggestedResult.line);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refresh, marginEdited]);

  async function finalize() {
    setBusy(true);
    setError(null);
    try {
      if (marginText.trim()) {
        await apiFetch(`/api/v1/matches/${matchId}`, {
          method: "PATCH",
          body: JSON.stringify({
            marginText: marginText.trim(),
            resultSummary: marginText.trim(),
          }),
        });
      }
      await apiFetch(`/api/v1/matches/${matchId}/finalize`, { method: "POST" });
      router.push(`/match/${matchId}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finalize");
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>4. Final result</Text>
      <Text style={styles.sub}>Host: {ctx.homeTeam.name}</Text>

      {ctx.status === "COMPLETED" ? (
        <View style={styles.card}>
          <Text style={styles.done}>Match complete</Text>
          <Pressable
            style={styles.btn}
            onPress={() => router.push(`/match/${matchId}/dashboard`)}
          >
            <Text style={styles.btnText}>View dashboard →</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {ctx.innings.length > 0 ? (
            ctx.innings.map((inn) => (
              <View key={inn.id} style={styles.card}>
                <Text style={styles.team}>
                  {inn.battingTeamName} · {inn.inningsNumber}
                  {inn.inningsNumber === 1 ? "st" : "nd"} innings
                </Text>
                <Text style={styles.score}>
                  {inn.totalRuns}/{inn.wickets}
                </Text>
                <Text style={styles.meta}>
                  {inn.oversBowled}/{ctx.totalOvers} overs
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.warn}>Complete the innings in the scorer first.</Text>
          )}

          {ctx.suggestedResult && (
            <Text style={styles.suggested}>{ctx.suggestedResult.line}</Text>
          )}
          <Text style={styles.label}>Result line</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Blues won by 12 runs"
            value={marginText}
            onChangeText={(t) => {
              setMarginEdited(true);
              setMarginText(t);
            }}
          />

          <Pressable
            style={[styles.btn, (!ctx.canFinalize || busy) && styles.btnDisabled]}
            onPress={finalize}
            disabled={!ctx.canFinalize || busy}
          >
            <Text style={styles.btnText}>
              {busy ? "Saving…" : "Finalize match"}
            </Text>
          </Pressable>

          {!ctx.canFinalize && ctx.canStartInnings && (
            <Text style={styles.warn}>
              Start the 2nd innings in the scorer — same {ctx.totalOvers}-over limit.
            </Text>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f7" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 22, fontWeight: "800", color: "#0B4169", marginBottom: 8 },
  sub: { color: "#666", marginBottom: 16 },
  suggested: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0B4169",
    marginBottom: 12,
    textAlign: "center",
  },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, marginBottom: 16 },
  team: { fontWeight: "700", color: "#0B4169", fontSize: 16 },
  score: { fontSize: 36, fontWeight: "800", color: "#0B4169", marginTop: 8 },
  meta: { color: "#666", marginTop: 4 },
  label: { fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
  },
  btn: {
    backgroundColor: "#0B4169",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  done: { fontSize: 18, fontWeight: "700", color: "#0B4169", marginBottom: 16 },
  warn: { color: "#666", marginBottom: 16, textAlign: "center" },
  error: { color: "#c0392b", textAlign: "center", marginTop: 12 },
});
