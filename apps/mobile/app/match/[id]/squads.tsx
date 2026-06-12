import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  confirmSquads,
  fetchScoringContext,
  reopenSquads,
  saveSquad,
  type ScoringContext,
  type ScoringPlayer,
} from "../../../lib/api";

type Side = "home" | "away";

function syncDraft(ctx: ScoringContext) {
  return {
    homeIds: ctx.squads.home.map((p) => p.id),
    awayIds: ctx.squads.away.map((p) => p.id),
    homeCaptainId: ctx.squads.home.find((p) => p.isCaptain)?.id ?? "",
    awayCaptainId: ctx.squads.away.find((p) => p.isCaptain)?.id ?? "",
    overs: ctx.matchTotalOvers ?? ctx.totalOvers,
  };
}

function SquadColumn({
  label,
  roster,
  selectedIds,
  captainId,
  busy,
  onAdd,
  onRemove,
  onCaptain,
}: {
  label: string;
  roster: ScoringPlayer[];
  selectedIds: string[];
  captainId: string;
  busy: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCaptain: (id: string) => void;
}) {
  const selected = selectedIds
    .map((id) => roster.find((p) => p.id === id))
    .filter(Boolean) as ScoringPlayer[];
  const available = roster.filter((p) => !selectedIds.includes(p.id));

  return (
    <View style={styles.column}>
      <Text style={styles.team}>{label}</Text>
      <Text style={styles.subLabel}>Playing ({selected.length})</Text>
      {selected.map((p) => (
        <View key={p.id} style={styles.row}>
          <Text style={styles.playerName}>
            {p.name}
            {captainId === p.id ? " (c)" : ""}
          </Text>
          <View style={styles.rowActions}>
            <Pressable
              style={[styles.smallBtn, captainId === p.id && styles.smallBtnOn]}
              onPress={() => onCaptain(p.id)}
              disabled={busy}
            >
              <Text style={styles.smallBtnText}>c</Text>
            </Pressable>
            <Pressable
              style={[styles.smallBtn, styles.removeBtn]}
              onPress={() => onRemove(p.id)}
              disabled={busy}
            >
              <Text style={styles.smallBtnText}>−</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Text style={[styles.subLabel, { marginTop: 8 }]}>Roster</Text>
      {available.map((p) => (
        <View key={p.id} style={styles.row}>
          <Text style={styles.playerName}>{p.name}</Text>
          <Pressable
            style={[styles.smallBtn, styles.addBtn]}
            onPress={() => onAdd(p.id)}
            disabled={busy}
          >
            <Text style={styles.smallBtnText}>+</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export default function SquadsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id!;
  const router = useRouter();
  const [ctx, setCtx] = useState<ScoringContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [homeIds, setHomeIds] = useState<string[]>([]);
  const [awayIds, setAwayIds] = useState<string[]>([]);
  const [homeCaptainId, setHomeCaptainId] = useState("");
  const [awayCaptainId, setAwayCaptainId] = useState("");
  const [draftOvers, setDraftOvers] = useState(2);
  const [oversTouched, setOversTouched] = useState(false);

  const refresh = useCallback(async () => {
    const data = await fetchScoringContext(matchId);
    setCtx(data);
    if (!data.squadsConfirmed) {
      const draft = syncDraft(data);
      setHomeIds(draft.homeIds);
      setAwayIds(draft.awayIds);
      setHomeCaptainId(draft.homeCaptainId);
      setAwayCaptainId(draft.awayCaptainId);
      if (!oversTouched) setDraftOvers(draft.overs);
    }
    return data;
  }, [matchId, oversTouched]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [refresh]);

  const squadMin = ctx?.squadMin ?? ctx?.playersPerSide ?? 2;
  const squadMax = ctx?.squadMax ?? 15;
  const canConfirm = useMemo(
    () =>
      homeIds.length >= squadMin &&
      awayIds.length >= squadMin &&
      homeIds.length <= squadMax &&
      awayIds.length <= squadMax,
    [homeIds, awayIds, squadMin, squadMax],
  );

  function addToSquad(side: Side, playerId: string) {
    const max = squadMax;
    if (side === "home") {
      if (homeIds.length >= max) return;
      setHomeIds((ids) => [...ids, playerId]);
      if (!homeCaptainId) setHomeCaptainId(playerId);
    } else {
      if (awayIds.length >= max) return;
      setAwayIds((ids) => [...ids, playerId]);
      if (!awayCaptainId) setAwayCaptainId(playerId);
    }
  }

  function removeFromSquad(side: Side, playerId: string) {
    if (side === "home") {
      setHomeIds((ids) => ids.filter((id) => id !== playerId));
      if (homeCaptainId === playerId) setHomeCaptainId("");
    } else {
      setAwayIds((ids) => ids.filter((id) => id !== playerId));
      if (awayCaptainId === playerId) setAwayCaptainId("");
    }
  }

  async function onConfirm() {
    if (!ctx || !canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const serverHome = ctx.squads.home.map((p) => p.id).sort().join(",");
      const serverAway = ctx.squads.away.map((p) => p.id).sort().join(",");
      const draftHome = [...homeIds].sort().join(",");
      const draftAway = [...awayIds].sort().join(",");
      const squadsUnchanged = serverHome === draftHome && serverAway === draftAway;

      if (!squadsUnchanged) {
        await saveSquad(matchId, {
          teamId: ctx.homeTeam.teamId,
          playerIds: homeIds,
          captainId: homeCaptainId || undefined,
        });
        await saveSquad(matchId, {
          teamId: ctx.awayTeam.teamId,
          playerIds: awayIds,
          captainId: awayCaptainId || undefined,
        });
      }
      await confirmSquads(matchId, draftOvers);
      router.push(`/match/${matchId}/toss`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm squads");
    } finally {
      setBusy(false);
    }
  }

  async function onReopen() {
    if (!ctx?.canReopenSquads) return;
    setBusy(true);
    setError(null);
    try {
      await reopenSquads(matchId);
      setOversTouched(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reopen squads");
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
          <Text style={styles.players}>
            {ctx.squads.home.map((p) => `${p.name}${p.isCaptain ? " (c)" : ""}`).join(", ")}
          </Text>
          <Text style={[styles.team, { marginTop: 12 }]}>{ctx.awayTeam.name}</Text>
          <Text style={styles.players}>
            {ctx.squads.away.map((p) => `${p.name}${p.isCaptain ? " (c)" : ""}`).join(", ")}
          </Text>
          <Text style={styles.oversLine}>{ctx.matchTotalOvers ?? ctx.totalOvers} overs per innings</Text>
        </View>
        {ctx.canReopenSquads && (
          <Pressable style={styles.secondaryBtn} onPress={onReopen} disabled={busy}>
            <Text style={styles.secondaryBtnText}>{busy ? "…" : "Edit squads"}</Text>
          </Pressable>
        )}
        <Pressable style={styles.btn} onPress={() => router.push(`/match/${matchId}/toss`)}>
          <Text style={styles.btnText}>Continue to toss →</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>1. Match squads</Text>
      <Text style={styles.sub}>
        Pick {squadMin}–{squadMax} players per side ({homeIds.length} home, {awayIds.length}{" "}
        away).
      </Text>

      <View style={styles.card}>
        <SquadColumn
          label={ctx.homeTeam.name}
          roster={ctx.rosters.home}
          selectedIds={homeIds}
          captainId={homeCaptainId}
          busy={busy}
          onAdd={(pid) => addToSquad("home", pid)}
          onRemove={(pid) => removeFromSquad("home", pid)}
          onCaptain={setHomeCaptainId}
        />
        <View style={styles.divider} />
        <SquadColumn
          label={ctx.awayTeam.name}
          roster={ctx.rosters.away}
          selectedIds={awayIds}
          captainId={awayCaptainId}
          busy={busy}
          onAdd={(pid) => addToSquad("away", pid)}
          onRemove={(pid) => removeFromSquad("away", pid)}
          onCaptain={setAwayCaptainId}
        />
      </View>

      <View style={styles.oversField}>
        <Text style={styles.oversLabel}>Overs per innings</Text>
        <TextInput
          style={styles.oversInput}
          keyboardType="number-pad"
          value={String(draftOvers)}
          editable={!busy}
          onChangeText={(text) => {
            setOversTouched(true);
            const n = Math.max(1, Math.min(50, Number(text) || 1));
            setDraftOvers(n);
          }}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.btn, (!canConfirm || busy) && styles.btnDisabled]}
        onPress={onConfirm}
        disabled={!canConfirm || busy}
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
  column: { marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },
  team: { fontWeight: "700", color: "#0B4169", marginBottom: 4 },
  subLabel: { fontSize: 12, color: "#64748b", fontWeight: "600", marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowActions: { flexDirection: "row", gap: 6 },
  playerName: { flex: 1, color: "#444", fontSize: 14 },
  smallBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnOn: { backgroundColor: "#54ACEE" },
  addBtn: { backgroundColor: "#d4edda" },
  removeBtn: { backgroundColor: "#f8d7da" },
  smallBtnText: { fontWeight: "800", color: "#0B4169" },
  players: { color: "#444", marginTop: 4, fontSize: 14 },
  oversLine: { marginTop: 12, color: "#64748b", fontSize: 13 },
  oversField: { marginBottom: 16 },
  oversLabel: { fontWeight: "600", color: "#0B4169", marginBottom: 6 },
  oversInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    fontSize: 16,
    maxWidth: 80,
  },
  btn: {
    backgroundColor: "#0B4169",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    padding: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryBtnText: { color: "#0B4169", fontWeight: "600", textDecorationLine: "underline" },
  error: { color: "#c0392b", textAlign: "center", marginBottom: 12 },
});
