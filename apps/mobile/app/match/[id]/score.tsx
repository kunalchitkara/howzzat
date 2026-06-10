import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  applyStrikeRotationsAfterDelivery,
  type DeliveryEvent,
} from "@howzzat/rules-engine";
import { formatBallLabel } from "../../../lib/ball-label";
import { apiFetch, fetchScoringContext, type ScoringContext } from "../../../lib/api";

type WicketKind = "bowled" | "caught" | "run_out" | "lbw" | "stumped";
type ExtrasPanel = "wide" | "no_ball" | "bye" | "leg_bye" | null;

function playerName(squad: { id: string; name: string }[], id: string) {
  return squad.find((p) => p.id === id)?.name ?? "—";
}

export default function MobileScoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const router = useRouter();
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thisOver, setThisOver] = useState<string[]>([]);

  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");

  const [extrasOpen, setExtrasOpen] = useState<ExtrasPanel>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState<WicketKind>("bowled");
  const [fielderId, setFielderId] = useState("");
  const [dismissedId, setDismissedId] = useState("");

  const refresh = useCallback(async () => {
    const data = await fetchScoringContext(matchId);
    setCtx(data);
    return data;
  }, [matchId]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refresh]);

  const activeInnings = useMemo(
    () => ctx?.innings.find((i) => i.id === ctx.activeInningsId) ?? null,
    [ctx],
  );

  const battingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    const isHome = activeInnings.battingTeamId === ctx.homeTeam.id;
    const squad = isHome ? ctx.squads.home : ctx.squads.away;
    const roster = isHome ? ctx.rosters?.home : ctx.rosters?.away;
    return squad.length > 0 ? squad : (roster ?? []);
  }, [ctx, activeInnings]);

  const bowlingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    const isHome = activeInnings.battingTeamId === ctx.homeTeam.id;
    const squad = isHome ? ctx.squads.away : ctx.squads.home;
    const roster = isHome ? ctx.rosters?.away : ctx.rosters?.home;
    return squad.length > 0 ? squad : (roster ?? []);
  }, [ctx, activeInnings]);

  useEffect(() => {
    if (battingSquad.length && !strikerId) {
      setStrikerId(battingSquad[0]!.id);
      setNonStrikerId(battingSquad[1]?.id ?? battingSquad[0]!.id);
    }
    if (bowlingSquad.length && !bowlerId) {
      setBowlerId(bowlingSquad[0]!.id);
    }
  }, [battingSquad, bowlingSquad, strikerId, bowlerId]);

  useEffect(() => {
    if (!activeInnings?.bowlerLocked || !activeInnings.lockedBowlerId) return;
    setBowlerId(activeInnings.lockedBowlerId);
  }, [
    activeInnings?.bowlerLocked,
    activeInnings?.lockedBowlerId,
    activeInnings?.nextBall.overNumber,
  ]);

  function swapStrike() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  function ballSymbol(body: Record<string, unknown>): string {
    if (body.wicketType) return "W";
    if (body.extrasType === "wide") return "Wd";
    if (body.extrasType === "wide_runs") return `Wd+${body.extrasRuns ?? 0}`;
    if (body.extrasType === "no_ball") {
      const bat = Number(body.runsOffBat ?? 0);
      return bat > 0 ? `Nb+${bat}` : "Nb";
    }
    if (body.extrasType === "no_ball_runs") {
      const suffix = body.extrasRunsType === "leg_bye" ? "lb" : "b";
      return `Nb+${body.extrasRuns}${suffix}`;
    }
    if (body.extrasType === "bye") return `B${body.extrasRuns}`;
    if (body.extrasType === "leg_bye") return `Lb${body.extrasRuns}`;
    const runs = Number(body.runsOffBat ?? 0);
    return runs === 0 ? "·" : String(runs);
  }

  function rotateStrikeAfter(body: Record<string, unknown>) {
    if (!ctx || !activeInnings) return;
    const event: DeliveryEvent = {
      overNumber: activeInnings.nextBall.overNumber,
      ballInOver: activeInnings.nextBall.ballInOver,
      strikerId,
      nonStrikerId,
      bowlerId,
      runsOffBat: Number(body.runsOffBat ?? 0),
      extrasRuns: Number(body.extrasRuns ?? 0),
      isLegalBall: body.isLegalBall !== false,
      extrasType: body.extrasType as DeliveryEvent["extrasType"],
      extrasRunsType: body.extrasRunsType as DeliveryEvent["extrasRunsType"],
      wicketType: body.wicketType as DeliveryEvent["wicketType"],
      dismissedBatsmanId: body.dismissedBatsmanId as string | undefined,
    };
    const [nextStriker, nextNonStriker] = applyStrikeRotationsAfterDelivery(
      strikerId,
      nonStrikerId,
      event,
      { rotateStrikeAfterWicket: ctx.rotateStrikeAfterWicket },
    );
    setStrikerId(nextStriker);
    setNonStrikerId(nextNonStriker);
  }

  async function recordDelivery(body: Record<string, unknown>) {
    if (!activeInnings) return;
    setBusy(true);
    setError(null);
    try {
      const sym = ballSymbol(body);
      const isEndOfOver =
        activeInnings.nextBall.ballInOver === 6 && body.isLegalBall !== false && !body.wicketType;

      await apiFetch("/api/v1/deliveries", {
        method: "POST",
        body: JSON.stringify({
          inningsId: activeInnings.id,
          overNumber: activeInnings.nextBall.overNumber,
          ballInOver: activeInnings.nextBall.ballInOver,
          strikerId,
          nonStrikerId,
          bowlerId,
          ...body,
        }),
      });

      setThisOver((prev) => (isEndOfOver ? [] : [...prev, sym]));
      rotateStrikeAfter(body);

      const updated = await refresh();
      setWicketOpen(false);
      setFielderId("");
      setExtrasOpen(null);

      if (updated.canFinalize) {
        router.push(`/match/${matchId}/result`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(false);
    }
  }

  async function startInnings() {
    if (!ctx?.canStartInnings) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/matches/${matchId}/innings`, {
        method: "POST",
        body: JSON.stringify({
          battingTeamId: ctx.canStartInnings.battingTeamId,
          inningsNumber: ctx.canStartInnings.inningsNumber,
        }),
      });
      setStrikerId("");
      setNonStrikerId("");
      setBowlerId("");
      setThisOver([]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start innings");
    } finally {
      setBusy(false);
    }
  }

  function confirmWicket() {
    if (
      (wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped") &&
      !fielderId
    ) {
      setError("Select a fielder");
      return;
    }
    void recordDelivery({
      wicketType,
      dismissedBatsmanId: dismissedId || strikerId,
      fielderId:
        wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped"
          ? fielderId
          : undefined,
      runsOffBat: 0,
      isLegalBall: true,
    });
  }

  if (!ctx) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  if (!ctx.toss.tossWinnerTeamId) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Record the toss first</Text>
        <Link href={`/match/${matchId}/toss`} style={styles.link}>
          Go to toss →
        </Link>
      </View>
    );
  }

  const ballLabel = activeInnings
    ? formatBallLabel(activeInnings.nextBall.overNumber, activeInnings.nextBall.ballInOver)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.teams}>
        {ctx.homeTeam.name} vs {ctx.awayTeam.name}
      </Text>
      <Text style={styles.badge}>{ctx.status === "LIVE" ? "● LIVE" : ctx.status}</Text>

      {ctx.canStartInnings && (
        <Pressable style={styles.primaryBtn} onPress={startInnings} disabled={busy}>
          <Text style={styles.primaryBtnText}>{ctx.canStartInnings.label}</Text>
        </Pressable>
      )}

      {activeInnings && !activeInnings.complete && (
        <>
          <View style={styles.inningsHeader}>
            <Text style={styles.inningsLabel}>
              {activeInnings.battingTeamName} · {activeInnings.inningsNumber}
              {activeInnings.inningsNumber === 1 ? "st" : "nd"} innings
            </Text>
            <Text style={styles.vs}>vs {activeInnings.bowlingTeamName}</Text>
          </View>

          <Text style={styles.ballLabel}>Ball {ballLabel}</Text>
          <Text style={styles.score}>
            {activeInnings.totalRuns}/{activeInnings.wickets}
          </Text>
          <Text style={styles.meta}>
            {activeInnings.oversBowled}/{ctx.totalOvers} overs
            {ctx.startingScore > 0 ? ` · base ${ctx.startingScore}` : ""}
          </Text>

          {thisOver.length > 0 && (
            <View style={styles.thisOver}>
              <Text style={styles.thisOverLabel}>This over:</Text>
              <View style={styles.thisOverRow}>
                {thisOver.map((sym, i) => (
                  <View key={i} style={styles.overBall}>
                    <Text style={styles.overBallText}>{sym}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.playerCard}>
            <View style={styles.playerCardHead}>
              <Text style={styles.section}>Batting</Text>
              <Pressable style={styles.swapBtn} onPress={swapStrike} disabled={busy}>
                <Text style={styles.swapBtnText}>Swap strike</Text>
              </Pressable>
            </View>
            {battingSquad.map((p) => {
              const isStriker = p.id === strikerId;
              const isNonStriker = p.id === nonStrikerId;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.playerRow,
                    isStriker && styles.playerOnStrike,
                    isNonStriker && !isStriker && styles.playerNonStrike,
                  ]}
                  onPress={() => {
                    if (isNonStriker) swapStrike();
                    else if (!isStriker) setStrikerId(p.id);
                  }}
                  onLongPress={() => {
                    if (!isNonStriker) setNonStrikerId(p.id);
                  }}
                >
                  <Text style={styles.playerName}>
                    {p.name}
                    {isStriker ? " *" : ""}
                  </Text>
                  <Text style={styles.playerRole}>
                    {isStriker
                      ? "On strike"
                      : isNonStriker
                        ? "Non-striker (tap to swap)"
                        : "Tap = striker · hold = non-striker"}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={[styles.section, { marginTop: 12 }]}>Bowling</Text>
            <Text style={styles.bowlerHint}>
              {activeInnings.bowlerLocked
                ? `Bowler locked for over ${activeInnings.nextBall.overNumber}`
                : "Pick bowler before the first ball of the over"}
            </Text>
            {bowlingSquad.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.playerRow, p.id === bowlerId && styles.playerBowling]}
                disabled={busy || activeInnings.bowlerLocked}
                onPress={() => setBowlerId(p.id)}
              >
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerRole}>
                  {p.id === bowlerId
                    ? "Bowling this over"
                    : activeInnings.bowlerLocked
                      ? "—"
                      : "Tap to select"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Off the bat</Text>
          <View style={styles.row}>
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <Pressable
                key={r}
                style={styles.key}
                disabled={busy}
                onPress={() => recordDelivery({ runsOffBat: r, isLegalBall: true })}
              >
                <Text style={styles.keyText}>{r === 0 ? "·" : r}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            {(
              [
                ["wide", "Wd"],
                ["no_ball", "Nb"],
                ["bye", "Bye"],
                ["leg_bye", "Lb"],
              ] as const
            ).map(([kind, label]) => (
              <Pressable
                key={kind}
                style={[styles.key, styles.wide, extrasOpen === kind && styles.keyActive]}
                disabled={busy}
                onPress={() => setExtrasOpen((v) => (v === kind ? null : kind))}
              >
                <Text style={styles.keyText}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.key, styles.wicket]}
              disabled={busy}
              onPress={() => {
                setExtrasOpen(null);
                setDismissedId(strikerId);
                setWicketOpen(true);
              }}
            >
              <Text style={styles.keyText}>W</Text>
            </Pressable>
          </View>

          {extrasOpen === "wide" && (
            <View style={styles.extrasPanel}>
              <Pressable
                style={styles.panelBtn}
                onPress={() =>
                  recordDelivery({
                    extrasType: "wide",
                    extrasRuns: 0,
                    runsOffBat: 0,
                    isLegalBall: false,
                  })
                }
              >
                <Text style={styles.panelBtnText}>Wd only</Text>
              </Pressable>
              <Text style={styles.panelHint}>Wide + runs (no bat)</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4].map((r) => (
                  <Pressable
                    key={r}
                    style={styles.key}
                    onPress={() =>
                      recordDelivery({
                        extrasType: "wide_runs",
                        extrasRuns: r,
                        runsOffBat: 0,
                        isLegalBall: false,
                      })
                    }
                  >
                    <Text style={styles.keyText}>+{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {extrasOpen === "no_ball" && (
            <View style={styles.extrasPanel}>
              <Pressable
                style={styles.panelBtn}
                onPress={() =>
                  recordDelivery({
                    extrasType: "no_ball",
                    extrasRuns: 0,
                    runsOffBat: 0,
                    isLegalBall: false,
                  })
                }
              >
                <Text style={styles.panelBtnText}>Nb only</Text>
              </Pressable>
              <Text style={styles.panelHint}>Nb + off the bat</Text>
              <View style={styles.row}>
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <Pressable
                    key={r}
                    style={styles.key}
                    onPress={() =>
                      recordDelivery({
                        extrasType: "no_ball",
                        extrasRuns: 0,
                        runsOffBat: r,
                        isLegalBall: false,
                      })
                    }
                  >
                    <Text style={styles.keyText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.panelHint}>Nb + bye / leg bye</Text>
              <View style={styles.row}>
                {[1, 2, 3, 4].map((r) => (
                  <Pressable
                    key={r}
                    style={styles.key}
                    onPress={() =>
                      recordDelivery({
                        extrasType: "no_ball_runs",
                        extrasRuns: r,
                        extrasRunsType: "bye",
                        runsOffBat: 0,
                        isLegalBall: false,
                      })
                    }
                  >
                    <Text style={styles.keyText}>{r}b</Text>
                  </Pressable>
                ))}
                {[1, 2, 3, 4].map((r) => (
                  <Pressable
                    key={`lb${r}`}
                    style={styles.key}
                    onPress={() =>
                      recordDelivery({
                        extrasType: "no_ball_runs",
                        extrasRuns: r,
                        extrasRunsType: "leg_bye",
                        runsOffBat: 0,
                        isLegalBall: false,
                      })
                    }
                  >
                    <Text style={styles.keyText}>{r}lb</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {(extrasOpen === "bye" || extrasOpen === "leg_bye") && (
            <View style={styles.extrasPanel}>
              <Text style={styles.panelHint}>
                {extrasOpen === "bye"
                  ? "Legal ball — missed bat"
                  : "Legal ball — off body, not bat"}
              </Text>
              <View style={styles.row}>
                {[1, 2, 3, 4].map((r) => (
                  <Pressable
                    key={r}
                    style={styles.key}
                    onPress={() =>
                      recordDelivery({
                        extrasType: extrasOpen,
                        extrasRuns: r,
                        runsOffBat: 0,
                        isLegalBall: true,
                      })
                    }
                  >
                    <Text style={styles.keyText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {wicketOpen && (
            <View style={styles.wicketPanel}>
              <Text style={styles.section}>How out?</Text>
              <View style={styles.row}>
                {(
                  [
                    ["bowled", "Bowled"],
                    ["caught", "Caught"],
                    ["run_out", "Run out"],
                    ["lbw", "LBW"],
                    ["stumped", "Stumped"],
                  ] as const
                ).map(([type, label]) => (
                  <Pressable
                    key={type}
                    style={[styles.typeChip, wicketType === type && styles.typeChipOn]}
                    onPress={() => setWicketType(type)}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        wicketType === type && styles.typeChipTextOn,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.section}>Batter out</Text>
              {battingSquad.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.option,
                    (dismissedId || strikerId) === p.id && styles.optionOn,
                  ]}
                  onPress={() => setDismissedId(p.id)}
                >
                  <Text>{p.name}</Text>
                </Pressable>
              ))}

              {(wicketType === "caught" ||
                wicketType === "run_out" ||
                wicketType === "stumped") && (
                <>
                  <Text style={styles.section}>Fielder</Text>
                  {bowlingSquad.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.option, fielderId === p.id && styles.optionOn]}
                      onPress={() => setFielderId(p.id)}
                    >
                      <Text>{p.name}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              <Pressable style={styles.primaryBtn} onPress={confirmWicket} disabled={busy}>
                <Text style={styles.primaryBtnText}>Confirm wicket</Text>
              </Pressable>
              <Pressable onPress={() => setWicketOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.fieldSummary}>
            {playerName(battingSquad, strikerId)}* to {playerName(bowlingSquad, bowlerId)}
          </Text>

          <Link href={`/match/${matchId}/dashboard`} style={styles.dashboardLink}>
            View live dashboard →
          </Link>
        </>
      )}

      {activeInnings?.complete && ctx.canStartInnings && (
        <View style={styles.card}>
          <Text style={styles.msg}>
            Innings complete ({ctx.totalOvers} overs). Start the 2nd innings with the same
            limit.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={startInnings} disabled={busy}>
            <Text style={styles.primaryBtnText}>{ctx.canStartInnings.label}</Text>
          </Pressable>
        </View>
      )}

      {ctx.canFinalize && (
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push(`/match/${matchId}/result`)}
        >
          <Text style={styles.primaryBtnText}>Both innings done — record result</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2f7" },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  teams: { fontSize: 18, fontWeight: "700", color: "#0B4169", textAlign: "center" },
  badge: { textAlign: "center", color: "#c0392b", fontWeight: "700", marginBottom: 12 },
  inningsHeader: { marginBottom: 8 },
  inningsLabel: { textAlign: "center", fontWeight: "700", color: "#0B4169" },
  vs: { textAlign: "center", color: "#666", fontSize: 13 },
  ballLabel: { textAlign: "center", fontWeight: "600", color: "#666", marginBottom: 4 },
  score: { fontSize: 48, fontWeight: "800", color: "#0B4169", textAlign: "center" },
  meta: { textAlign: "center", color: "#666", marginBottom: 12 },
  thisOver: { marginBottom: 12, alignItems: "center" },
  thisOverLabel: { fontSize: 12, color: "#666", marginBottom: 6 },
  thisOverRow: { flexDirection: "row", gap: 6 },
  overBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#54ACEE",
    alignItems: "center",
    justifyContent: "center",
  },
  overBallText: { fontWeight: "700", color: "#0B4169" },
  playerCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  bowlerHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  playerCardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  playerRow: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#f5f8fb",
    borderWidth: 2,
    borderColor: "transparent",
  },
  playerOnStrike: { borderColor: "#54ACEE", backgroundColor: "#e8f4fc" },
  playerNonStrike: { borderColor: "#b8d4e8", backgroundColor: "#f5fafd" },
  playerBowling: { borderColor: "#3d85c6", backgroundColor: "#eef6fc" },
  playerName: { fontWeight: "700", color: "#0B4169" },
  playerRole: { fontSize: 12, color: "#666", marginTop: 2 },
  swapBtn: {
    backgroundColor: "#0B4169",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  swapBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  section: { fontWeight: "700", color: "#0B4169", marginBottom: 8, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  key: {
    backgroundColor: "#54ACEE",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  wide: { backgroundColor: "#3d85c6" },
  keyActive: { borderWidth: 2, borderColor: "#0B4169" },
  wicket: { backgroundColor: "#c0392b" },
  extrasPanel: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  panelBtn: {
    backgroundColor: "#0B4169",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  panelBtnText: { color: "#fff", fontWeight: "700" },
  panelHint: { fontSize: 12, color: "#666", marginBottom: 6, textAlign: "center" },
  keyText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  inputRow: { flexDirection: "row", gap: 8, marginVertical: 12 },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  inputBtn: {
    backgroundColor: "#0B4169",
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  inputBtnText: { color: "#fff", fontWeight: "700" },
  wicketPanel: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    marginBottom: 6,
  },
  typeChipOn: { backgroundColor: "#d6eaf8", borderWidth: 1, borderColor: "#54ACEE" },
  typeChipText: { fontSize: 12, fontWeight: "600", color: "#666" },
  typeChipTextOn: { color: "#0B4169" },
  option: {
    backgroundColor: "#f5f8fb",
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionOn: { borderColor: "#54ACEE" },
  cancel: { textAlign: "center", color: "#666", marginTop: 8 },
  fieldSummary: {
    textAlign: "center",
    fontWeight: "600",
    color: "#0B4169",
    marginTop: 8,
    marginBottom: 8,
  },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: "#0B4169",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  dashboardLink: { textAlign: "center", color: "#3d85c6", fontWeight: "600", marginTop: 8 },
  msg: { fontSize: 15, color: "#666", marginBottom: 12, textAlign: "center" },
  link: { color: "#54ACEE", fontWeight: "700" },
  error: { color: "#c0392b", textAlign: "center", marginTop: 12 },
});
