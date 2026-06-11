import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { fetchScoringContext, type ScoringContext } from "../../../lib/api";

type Step = { key: string; label: string; href: string; done: boolean };

export default function MatchHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchScoringContext(matchId);
    setCtx(data);
  }, [matchId]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!ctx) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const tossDone = Boolean(ctx.toss.tossWinnerTeamId);
  const inningsStarted = ctx.innings.length > 0;
  const inningsComplete = ctx.innings.some((i) => i.complete);
  const matchDone = ctx.status === "COMPLETED";

  const squadsDone = ctx.squadsConfirmed;

  const steps: Step[] = [
    {
      key: "squads",
      label: "1. Squads",
      href: `/match/${matchId}/squads`,
      done: squadsDone,
    },
    {
      key: "toss",
      label: "2. Toss",
      href: `/match/${matchId}/toss`,
      done: tossDone,
    },
    {
      key: "score",
      label: "3. Score",
      href: `/match/${matchId}/score`,
      done: inningsComplete,
    },
    {
      key: "result",
      label: "4. Result",
      href: `/match/${matchId}/result`,
      done: matchDone,
    },
    {
      key: "dashboard",
      label: "Dashboard",
      href: `/match/${matchId}/dashboard`,
      done: inningsStarted,
    },
  ];

  const active = ctx.innings.find((i) => !i.complete);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.teams}>
        {ctx.homeTeam.name} vs {ctx.awayTeam.name}
      </Text>
      <View style={[styles.badge, ctx.status === "LIVE" && styles.badgeLive]}>
        <Text style={styles.badgeText}>
          {ctx.status === "LIVE" ? "● LIVE" : ctx.status}
        </Text>
      </View>

      {tossDone && (
        <View style={styles.tossCard}>
          <Text style={styles.tossTitle}>Toss</Text>
          <Text style={styles.tossLine}>
            {ctx.toss.tossWinnerName} won the toss ·
            elected to {ctx.toss.electedTo}
          </Text>
        </View>
      )}

      {active && (
        <View style={styles.liveCard}>
          <Text style={styles.liveScore}>
            {active.battingTeamName}: {active.totalRuns}/{active.wickets}
          </Text>
          <Text style={styles.liveMeta}>
            Ball{" "}
            {active.lastBall
              ? `${active.lastBall.overNumber}.${active.lastBall.ballInOver}`
              : "—"}{" "}
            · {active.displayOvers}/{ctx.totalOvers} ov
            {ctx.chase ? ` · need ${ctx.chase.runsNeeded}` : ""}
          </Text>
        </View>
      )}

      {steps.map((step) => (
        <Link key={step.key} href={step.href as `/match/${string}/toss`} asChild>
          <Pressable style={[styles.step, step.done && styles.stepDone]}>
            <Text style={styles.stepLabel}>{step.label}</Text>
            <Text style={styles.stepArrow}>{step.done ? "✓" : "→"}</Text>
          </Pressable>
        </Link>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f7" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  teams: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0B4169",
    textAlign: "center",
    marginBottom: 8,
  },
  badge: {
    alignSelf: "center",
    backgroundColor: "#ddd",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeLive: { backgroundColor: "#c0392b" },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  tossCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  tossTitle: { fontWeight: "700", color: "#0B4169" },
  tossLine: { color: "#666", marginTop: 4, fontSize: 14 },
  liveCard: {
    backgroundColor: "#0B4169",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  liveScore: { color: "#fff", fontSize: 22, fontWeight: "800" },
  liveMeta: { color: "rgba(255,255,255,0.85)", marginTop: 4 },
  step: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepDone: { borderLeftWidth: 4, borderLeftColor: "#54ACEE" },
  stepLabel: { fontSize: 16, fontWeight: "700", color: "#0B4169" },
  stepArrow: { fontSize: 18, color: "#54ACEE", fontWeight: "700" },
  error: { color: "#c0392b", textAlign: "center", marginTop: 12 },
});
