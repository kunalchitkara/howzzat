import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  apiFetch,
  fetchScorecard,
  fetchScoringContext,
  type MatchScorecardView,
  type ScoringContext,
} from "../../../lib/api";

type LiveSnapshot = {
  status: string;
  homeTeam: string;
  awayTeam: string;
  innings: { teamName: string; totalRuns: number; wickets: number; overs: number }[];
};

export default function DashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [scorecard, setScorecard] = useState<MatchScorecardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [scoring, card, snap] = await Promise.all([
      fetchScoringContext(matchId),
      fetchScorecard(matchId).catch(() => null),
      apiFetch<LiveSnapshot>(`/api/v1/matches/${matchId}/live`).catch(() => null),
    ]);
    setCtx(scoring);
    if (card) setScorecard(card);
    if (snap) setLive(snap);
  }, [matchId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    const t = setInterval(() => {
      load().catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (!ctx && !scorecard) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const inn = scorecard?.innings[0];
  const bbb = scorecard?.ballByBall?.innings[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>{scorecard?.matchTitle ?? "Match dashboard"}</Text>
      <View style={[styles.liveBanner, live?.status === "LIVE" && styles.liveOn]}>
        <Text style={styles.liveText}>
          {live?.status === "LIVE" ? "● LIVE · updates every 3s" : live?.status ?? ctx?.status}
        </Text>
        {live && (
          <Text style={styles.liveScore}>
            {live.homeTeam} vs {live.awayTeam}
          </Text>
        )}
      </View>

      {ctx?.toss.tossWinnerName && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Toss</Text>
          <Text style={styles.body}>
            {ctx.toss.tossWinnerName} won the toss and elected to {ctx.toss.electedTo}
          </Text>
        </View>
      )}

      {inn && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scorecard — {inn.teamName}</Text>
          <Text style={styles.bigScore}>
            {inn.totalRuns}/{inn.wickets}
          </Text>
          <Text style={styles.body}>{inn.overs} overs · net {inn.netRuns}</Text>

          <Text style={styles.subTitle}>Batting</Text>
          {inn.batters.map((b) => (
            <View key={b.playerId} style={styles.row}>
              <Text style={styles.name}>{b.name}</Text>
              <Text style={styles.figs}>
                {b.runs} ({b.balls})
              </Text>
            </View>
          ))}

          <Text style={styles.subTitle}>Bowling</Text>
          {inn.bowlers.map((b) => (
            <View key={b.playerId} style={styles.row}>
              <Text style={styles.name}>{b.name}</Text>
              <Text style={styles.figs}>
                {b.overs}-{b.runs}-{b.wickets}
              </Text>
            </View>
          ))}

          {inn.partnerships.length > 0 && (
            <>
              <Text style={styles.subTitle}>Partnership</Text>
              {inn.partnerships.map((p) => (
                <Text key={p.label} style={styles.body}>
                  {p.label}: {p.batter1} & {p.batter2} — {p.runs} ({p.wickets} wkts)
                </Text>
              ))}
            </>
          )}
        </View>
      )}

      {bbb && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ball-by-ball</Text>
          {bbb.overs.map((over) => (
            <View key={over.overNumber} style={styles.overBlock}>
              <Text style={styles.overHead}>
                {over.overNumber === 1 ? "1st" : `${over.overNumber}th`} Over · {over.partnershipLabel}:{" "}
                {over.partnershipRuns}
              </Text>
              <Text style={styles.ballLine}>
                {over.deliveries.map((b) => b.symbol).join(" ")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {scorecard?.resultBanner && (
        <View style={styles.resultCard}>
          <Text style={styles.resultText}>{scorecard.resultBanner.text}</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f7" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "800", color: "#0B4169", marginBottom: 12 },
  liveBanner: {
    backgroundColor: "#0B4169",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  liveOn: { backgroundColor: "#c0392b" },
  liveText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  liveScore: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: "800", color: "#0B4169", fontSize: 16, marginBottom: 8 },
  bigScore: { fontSize: 32, fontWeight: "800", color: "#0B4169" },
  body: { color: "#444", fontSize: 14, marginTop: 4 },
  subTitle: { fontWeight: "700", color: "#666", marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  name: { fontSize: 14 },
  figs: { fontWeight: "600", color: "#0B4169" },
  overBlock: { marginBottom: 12 },
  overHead: { fontWeight: "700", color: "#0B4169", fontSize: 13 },
  ballLine: { color: "#333", marginTop: 4, fontFamily: "Menlo" },
  resultCard: {
    backgroundColor: "#d6eaf8",
    borderRadius: 10,
    padding: 16,
    marginTop: 4,
  },
  resultText: { fontWeight: "700", color: "#0B4169", textAlign: "center" },
  error: { color: "#c0392b", textAlign: "center", marginTop: 12 },
});
