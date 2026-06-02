import { useMemo, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import {
  applyDelivery,
  createInningsState,
  finalizeInnings,
  getBuiltinProfile,
  resolveInningsConfig,
} from "@howzzat/rules-engine";
import type { DeliveryEvent } from "@howzzat/rules-engine";

export default function ScoreScreen() {
  const profile = getBuiltinProfile("u9-softball-london-v1")!;
  const inningsConfig = useMemo(() => {
    const c = resolveInningsConfig(profile, 8);
    return { playersPerSide: c.playersPerSide, totalOvers: c.totalOvers };
  }, [profile]);

  const [state, setState] = useState(() =>
    createInningsState(profile, inningsConfig),
  );
  const [ball, setBall] = useState(1);

  const totals = finalizeInnings(state, profile);

  function recordRuns(runs: number) {
    const event: DeliveryEvent = {
      overNumber: Math.ceil(ball / 6),
      ballInOver: ((ball - 1) % 6) + 1,
      isLegalBall: true,
      runsOffBat: runs,
      extrasRuns: 0,
      strikerId: "striker",
      nonStrikerId: "non_striker",
      bowlerId: "bowler",
    };
    setState((s) => applyDelivery(s, event, profile));
    setBall((b) => b + 1);
  }

  function recordWicket() {
    const event: DeliveryEvent = {
      overNumber: Math.ceil(ball / 6),
      ballInOver: ((ball - 1) % 6) + 1,
      isLegalBall: true,
      runsOffBat: 0,
      extrasRuns: 0,
      wicketType: "bowled",
      strikerId: "striker",
      nonStrikerId: "non_striker",
      bowlerId: "bowler",
      dismissedBatsmanId: "striker",
    };
    setState((s) => applyDelivery(s, event, profile));
    setBall((b) => b + 1);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.score}>{totals.totalRuns}</Text>
      <Text style={styles.meta}>
        {totals.wickets} wkts · net {totals.netRuns} · ball {ball}
      </Text>

      <View style={styles.row}>
        {[0, 1, 2, 3, 4, 6].map((r) => (
          <Pressable key={r} style={styles.key} onPress={() => recordRuns(r)}>
            <Text style={styles.keyText}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={[styles.key, styles.wicket]} onPress={recordWicket}>
        <Text style={styles.keyText}>W</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#eef2f7" },
  score: {
    fontSize: 56,
    fontWeight: "800",
    color: "#0B4169",
    textAlign: "center",
    marginTop: 24,
  },
  meta: { textAlign: "center", color: "#666", marginBottom: 32 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  key: {
    width: 72,
    height: 72,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wicket: { backgroundColor: "#C0392B", marginTop: 12, alignSelf: "center", width: 120 },
  keyText: { fontSize: 24, fontWeight: "700", color: "#0B4169" },
});
