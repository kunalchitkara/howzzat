"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildRecentBalls } from "@/lib/scoring/recent-balls";
import type { ScoringInningsView } from "@/lib/scoring/types";
import type { DeliveryEvent, RulesProfile } from "@howzzat/rules-engine";
import type { MatchScoringContext, ScoringPlayer } from "@/lib/scoring/types";
import { formatBallLabel } from "@/lib/scoring/ball-label";
import { deliveryEndedOver, maxLegalBalls } from "@/lib/scoring/ball-position";
import { resolveScoringIsLegalBall } from "@/lib/scoring/delivery-legal";
import { apiFetch } from "@/lib/client/api";
import {
  canConfirmLineup,
  describeLineupBlockers,
  describeSquadConfirmError,
} from "@/lib/scoring/squad-validation";
import { suggestOversForFormula, suggestOversForSquad } from "@/lib/scoring/suggest-overs";
import {
  canRecordMoreBalls,
  hasFailedDeliveries,
  hasPendingDeliveries,
  hasUnsyncedDeliveries,
  hydrateFromContext,
  initialMatchScoringStoreState,
  recordBallLocally,
  scoringRulesProfileFromContext,
  setOnFieldPlayers,
  type RecordBallPayload,
} from "@/lib/scoring/match-scoring-store";
import { useMatchScoringSync } from "@/lib/scoring/use-match-scoring-sync";
import { BallHistory } from "./BallHistory";
import { EditBallModal, type DeliveryPatch } from "./EditBallModal";
import { SquadSetupRecap } from "./SquadSetupRecap";
import "./scorepad.css";

type WicketKind = "bowled" | "caught" | "run_out" | "lbw" | "stumped";
type ExtrasPanel = "wide" | "no_ball" | "bye" | "leg_bye" | null;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(url, init);
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Request failed");
  }
}

function scoringRulesProfile(ctx: MatchScoringContext): RulesProfile {
  return scoringRulesProfileFromContext(ctx);
}

export function ScorePad({
  matchId,
  initialCtx,
}: {
  matchId: string;
  initialCtx?: MatchScoringContext;
}) {
  const [ctx, setCtx] = useState<MatchScoringContext | null>(initialCtx ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoringStore, setScoringStore] = useState(initialMatchScoringStoreState);

  const refreshAfterInningsEvent = useCallback(async () => {
    const data = await api<MatchScoringContext>(
      `/api/v1/matches/${matchId}/scoring`,
    );
    setCtx(data);
    setScoringStore((s) => (hasPendingDeliveries(s) ? s : hydrateFromContext(s, data)));
    return data;
  }, [matchId]);

  const { scheduleFlush, awaitQueueEmpty } = useMatchScoringSync(
    scoringStore,
    setScoringStore,
    {
      onInningsComplete: () => {
        void refreshAfterInningsEvent();
      },
      onChaseTargetReached: () => {
        setChasePromptOpen(true);
      },
    },
  );

  const strikerId = scoringStore.strikerId;
  const nonStrikerId = scoringStore.nonStrikerId;
  const bowlerId = scoringStore.bowlerId;
  const setStrikerId = (id: string) =>
    setScoringStore((s) => setOnFieldPlayers(s, id, s.nonStrikerId, s.bowlerId));
  const setNonStrikerId = (id: string) =>
    setScoringStore((s) => setOnFieldPlayers(s, s.strikerId, id, s.bowlerId));
  const setBowlerId = (id: string) =>
    setScoringStore((s) => setOnFieldPlayers(s, s.strikerId, s.nonStrikerId, id));

  const [extrasOpen, setExtrasOpen] = useState<ExtrasPanel>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState<WicketKind>("bowled");
  const [fielderId, setFielderId] = useState("");
  const [dismissedId, setDismissedId] = useState("");
  const [draftHomeIds, setDraftHomeIds] = useState<string[]>([]);
  const [draftAwayIds, setDraftAwayIds] = useState<string[]>([]);
  const [draftHomeCaptainId, setDraftHomeCaptainId] = useState("");
  const [draftAwayCaptainId, setDraftAwayCaptainId] = useState("");

  const [tossWinnerId, setTossWinnerId] = useState("");
  const [electedTo, setElectedTo] = useState<"bat" | "bowl">("bat");
  const [chasePromptOpen, setChasePromptOpen] = useState(false);
  const [draftOvers, setDraftOvers] = useState(20);
  const [oversTouched, setOversTouched] = useState(false);
  const [quickAddName, setQuickAddName] = useState({ home: "", away: "" });
  const [quickAddBusySide, setQuickAddBusySide] = useState<"home" | "away" | null>(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [claimAttempted, setClaimAttempted] = useState(false);
  const scoringKeysRef = useRef<HTMLElement>(null);
  const extrasAnchorRef = useRef<HTMLDivElement>(null);

  const syncDraftFromServer = useCallback((data: MatchScoringContext) => {
    setDraftHomeIds(data.squads.home.map((p) => p.id));
    setDraftAwayIds(data.squads.away.map((p) => p.id));
    setDraftHomeCaptainId(data.squads.home.find((p) => p.isCaptain)?.id ?? "");
    setDraftAwayCaptainId(data.squads.away.find((p) => p.isCaptain)?.id ?? "");
  }, []);

  const refresh = useCallback(async () => {
    const data = await api<MatchScoringContext>(
      `/api/v1/matches/${matchId}/scoring`,
    );
    setCtx(data);
    return data;
  }, [matchId]);

  // Initial load only — do not depend on oversTouched; flipping it re-fetched and
  // syncDraftFromServer wiped unsaved squad picks on the first overs edit.
  useEffect(() => {
    function applyBootstrap(data: MatchScoringContext) {
      syncDraftFromServer(data);
      if (data.matchTotalOvers != null) {
        setDraftOvers(data.matchTotalOvers);
      } else {
        setDraftOvers(data.totalOvers);
      }
      if (data.toss.tossWinnerTeamId) {
        setTossWinnerId(data.toss.tossWinnerTeamId);
        setElectedTo((data.toss.electedTo as "bat" | "bowl") ?? "bat");
      }
    }

    if (initialCtx) {
      applyBootstrap(initialCtx);
      return;
    }

    refresh()
      .then(applyBootstrap)
      .catch((e) => setError(String(e.message ?? e)));
  }, [refresh, syncDraftFromServer, initialCtx]);

  useEffect(() => {
    if (!ctx) return;
    setScoringStore((s) => {
      if (hasPendingDeliveries(s)) return s;
      return hydrateFromContext(s, ctx);
    });
  }, [ctx]);

  useEffect(() => {
    if (!ctx || claimAttempted || ctx.status === "COMPLETED") return;
    if (ctx.scoringLock.lockedByOther || ctx.scoringLock.needsSignIn) return;

    setClaimAttempted(true);
    api<MatchScoringContext>(`/api/v1/matches/${matchId}/scoring/claim`, {
      method: "POST",
    })
      .then((data) => {
        setCtx(data);
        syncDraftFromServer(data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        void refresh();
      });
  }, [ctx, claimAttempted, matchId, refresh, syncDraftFromServer]);

  useEffect(() => {
    if (!ctx || ctx.squadsConfirmed || oversTouched) return;
    const lineupCount = Math.max(draftHomeIds.length, draftAwayIds.length);
    const squadSize =
      lineupCount > 0
        ? lineupCount
        : Math.max(ctx.squads.home.length, ctx.squads.away.length) ||
          ctx.playersPerSide;
    setDraftOvers(suggestOversForFormula(ctx.oversPerInningsFormula, squadSize));
  }, [
    ctx,
    ctx?.squadsConfirmed,
    ctx?.oversPerInningsFormula,
    ctx?.playersPerSide,
    ctx?.squads.home.length,
    ctx?.squads.away.length,
    draftHomeIds.length,
    draftAwayIds.length,
    oversTouched,
  ]);

  function playersForSide(side: "home" | "away"): ScoringPlayer[] {
    if (!ctx) return [];
    const roster = ctx.rosters[side];
    const squad = side === "home" ? ctx.squads.home : ctx.squads.away;
    const byId = new Map(
      [...roster, ...squad].map((p) => [p.id, p] as const),
    );
    const ids = side === "home" ? draftHomeIds : draftAwayIds;
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is ScoringPlayer => Boolean(p));
  }

  const activeInnings = useMemo(() => {
    const live = scoringStore.liveInnings;
    if (live && ctx?.activeInningsId === live.inningsId) {
      return {
        ...(ctx.innings.find((i) => i.id === live.inningsId) ?? live),
        ...live,
      } as ScoringInningsView;
    }
    return ctx?.innings.find((i) => i.id === ctx.activeInningsId) ?? null;
  }, [ctx, scoringStore.liveInnings]);

  const battingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    const playing =
      activeInnings.battingTeamId === ctx.homeTeam.id
        ? playersForSide("home")
        : playersForSide("away");
    if (playing.length > 0) return playing;
    return activeInnings.battingTeamId === ctx.homeTeam.id
      ? ctx.rosters.home
      : ctx.rosters.away;
  }, [ctx, activeInnings, draftHomeIds, draftAwayIds]);

  const bowlingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    const playing =
      activeInnings.battingTeamId === ctx.homeTeam.id
        ? playersForSide("away")
        : playersForSide("home");
    if (playing.length > 0) return playing;
    return activeInnings.battingTeamId === ctx.homeTeam.id
      ? ctx.rosters.away
      : ctx.rosters.home;
  }, [ctx, activeInnings, draftHomeIds, draftAwayIds]);

  function squadsForInnings(inn: ScoringInningsView) {
    if (!ctx) return { batting: [] as ScoringPlayer[], bowling: [] as ScoringPlayer[] };
    const homeBatting = inn.battingTeamId === ctx.homeTeam.id;
    const battingPlaying = homeBatting ? playersForSide("home") : playersForSide("away");
    const bowlingPlaying = homeBatting ? playersForSide("away") : playersForSide("home");
    return {
      batting:
        battingPlaying.length > 0
          ? battingPlaying
          : homeBatting
            ? ctx.squads.home
            : ctx.squads.away,
      bowling:
        bowlingPlaying.length > 0
          ? bowlingPlaying
          : homeBatting
            ? ctx.squads.away
            : ctx.squads.home,
    };
  }

  const editingInnings = useMemo(() => {
    if (!ctx || !editingDeliveryId) return null;
    return (
      ctx.innings.find((inn) =>
        inn.deliveries.some((d) => d.id === editingDeliveryId),
      ) ?? null
    );
  }, [ctx, editingDeliveryId]);

  const editingSquads = useMemo(() => {
    if (!editingInnings) return { batting: [] as ScoringPlayer[], bowling: [] as ScoringPlayer[] };
    return squadsForInnings(editingInnings);
  }, [editingInnings, ctx, draftHomeIds, draftAwayIds]);

  useEffect(() => {
    if (!extrasOpen) return;
    requestAnimationFrame(() => {
      extrasAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [extrasOpen]);

  useEffect(() => {
    if (!battingSquad.length || strikerId) return;
    setStrikerId(battingSquad[0]?.id ?? "");
    setNonStrikerId(battingSquad[1]?.id ?? battingSquad[0]?.id ?? "");
  }, [battingSquad, strikerId]);

  useEffect(() => {
    if (!bowlingSquad.length) return;
    if (activeInnings?.bowlerLocked && activeInnings.lockedBowlerId) return;
    if (
      bowlingSquad.length > 2 &&
      activeInnings &&
      !activeInnings.bowlerLocked
    ) {
      return;
    }
    if (bowlerId && bowlingSquad.some((p) => p.id === bowlerId)) return;
    setBowlerId(bowlingSquad[0]?.id ?? "");
  }, [
    bowlingSquad,
    bowlerId,
    activeInnings?.bowlerLocked,
    activeInnings?.lockedBowlerId,
  ]);

  useEffect(() => {
    if (!activeInnings?.bowlerLocked || !activeInnings.lockedBowlerId) return;
    setBowlerId(activeInnings.lockedBowlerId);
  }, [
    activeInnings?.bowlerLocked,
    activeInnings?.lockedBowlerId,
    activeInnings?.nextBall.overNumber,
  ]);

  async function runAction(
    fn: () => Promise<void>,
  ): Promise<MatchScoringContext | null> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveSquads() {
    if (!ctx) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/matches/${matchId}/squad`, {
        method: "POST",
        body: JSON.stringify({
          teamId: ctx.homeTeam.teamId,
          playerIds: draftHomeIds,
          captainId: draftHomeCaptainId || undefined,
        }),
      });
      await api(`/api/v1/matches/${matchId}/squad`, {
        method: "POST",
        body: JSON.stringify({
          teamId: ctx.awayTeam.teamId,
          playerIds: draftAwayIds,
          captainId: draftAwayCaptainId || undefined,
        }),
      });
      const data = await refresh();
      syncDraftFromServer(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function squadIdsForConfirm(): { homeIds: string[]; awayIds: string[] } {
    if (!ctx) return { homeIds: [], awayIds: [] };
    const homeIds =
      draftHomeIds.length > 0
        ? draftHomeIds
        : ctx.squads.home.map((p) => p.id);
    const awayIds =
      draftAwayIds.length > 0
        ? draftAwayIds
        : ctx.squads.away.map((p) => p.id);
    return { homeIds, awayIds };
  }

  async function editSquads() {
    if (!ctx?.canReopenSquads) return;
    await runAction(async () => {
      await api(`/api/v1/matches/${matchId}/squad/reopen`, { method: "POST" });
      const data = await refresh();
      syncDraftFromServer(data);
      if (data.matchTotalOvers != null) {
        setDraftOvers(data.matchTotalOvers);
      }
      setTossWinnerId("");
      setOversTouched(false);
    });
  }

  async function quickAddPlayer(side: "home" | "away") {
    const name = quickAddName[side].trim();
    if (!name || !ctx || busy || quickAddBusySide) return;
    setBusy(true);
    setQuickAddBusySide(side);
    setError(null);
    try {
      await api(`/api/v1/matches/${matchId}/players`, {
        method: "POST",
        body: JSON.stringify({ side, legalName: name }),
      });
      const data = await refresh();
      const serverIds =
        side === "home"
          ? data.squads.home.map((p) => p.id)
          : data.squads.away.map((p) => p.id);
      if (side === "home") {
        setDraftHomeIds((ids) => [...new Set([...ids, ...serverIds])]);
        const addedId = serverIds.find((id) => !ctx.squads.home.some((p) => p.id === id));
        if (addedId) {
          setDraftHomeCaptainId((current) => current || addedId);
        }
      } else {
        setDraftAwayIds((ids) => [...new Set([...ids, ...serverIds])]);
        const addedId = serverIds.find((id) => !ctx.squads.away.some((p) => p.id === id));
        if (addedId) {
          setDraftAwayCaptainId((current) => current || addedId);
        }
      }
      setQuickAddName((prev) => ({ ...prev, [side]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setQuickAddBusySide(null);
      setBusy(false);
    }
  }

  async function confirmSquads() {
    if (!ctx) return;
    const { homeIds, awayIds } = squadIdsForConfirm();
    const squadMin = ctx.squadMin ?? 2;
    const squadMax = ctx.squadMax ?? 15;
    if (!canConfirmLineup(homeIds.length, awayIds.length, squadMin, squadMax)) {
      setError(
        describeSquadConfirmError({
          homeTeamName: ctx.homeTeam.name,
          awayTeamName: ctx.awayTeam.name,
          homeCount: homeIds.length,
          awayCount: awayIds.length,
          min: squadMin,
          max: squadMax,
          homeRosterEmpty: ctx.rosters.home.length === 0,
          awayRosterEmpty: ctx.rosters.away.length === 0,
        }),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const serverHome = ctx.squads.home.map((p) => p.id).sort().join(",");
      const serverAway = ctx.squads.away.map((p) => p.id).sort().join(",");
      const draftHome = [...homeIds].sort().join(",");
      const draftAway = [...awayIds].sort().join(",");
      const squadsUnchanged = serverHome === draftHome && serverAway === draftAway;

      if (!squadsUnchanged) {
        await api(`/api/v1/matches/${matchId}/squad`, {
          method: "POST",
          body: JSON.stringify({
            teamId: ctx.homeTeam.teamId,
            playerIds: homeIds,
            captainId: draftHomeCaptainId || undefined,
          }),
        });
        await api(`/api/v1/matches/${matchId}/squad`, {
          method: "POST",
          body: JSON.stringify({
            teamId: ctx.awayTeam.teamId,
            playerIds: awayIds,
            captainId: draftAwayCaptainId || undefined,
          }),
        });
      }
      await api(`/api/v1/matches/${matchId}/squad/confirm`, {
        method: "POST",
        body: JSON.stringify({ totalOvers: draftOvers }),
      });
      const data = await refresh();
      syncDraftFromServer(data);
      setDraftHomeIds(data.squads.home.map((p) => p.id));
      setDraftAwayIds(data.squads.away.map((p) => p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopChaseInnings() {
    if (!activeInnings) return;
    setChasePromptOpen(false);
    setBusy(true);
    try {
      await awaitQueueEmpty();
      await api(`/api/v1/matches/${matchId}/innings/${activeInnings.id}/end`, {
        method: "POST",
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function continueChase() {
    setChasePromptOpen(false);
    setBusy(true);
    try {
      await awaitQueueEmpty();
      await api(`/api/v1/matches/${matchId}/chase/continue`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function addToSquad(side: "home" | "away", playerId: string) {
    if (!ctx) return;
    const squadMax = ctx.squadMax ?? 15;
    if (side === "home") {
      if (draftHomeIds.length >= squadMax) return;
      setDraftHomeIds((ids) => (ids.includes(playerId) ? ids : [...ids, playerId]));
    } else {
      if (draftAwayIds.length >= squadMax) return;
      setDraftAwayIds((ids) => (ids.includes(playerId) ? ids : [...ids, playerId]));
    }
  }

  function setCaptain(side: "home" | "away", playerId: string) {
    if (side === "home") {
      setDraftHomeCaptainId((current) => (current === playerId ? "" : playerId));
    } else {
      setDraftAwayCaptainId((current) => (current === playerId ? "" : playerId));
    }
  }

  function removeFromSquad(side: "home" | "away", playerId: string) {
    if (side === "home") {
      setDraftHomeIds((ids) => ids.filter((id) => id !== playerId));
      if (draftHomeCaptainId === playerId) setDraftHomeCaptainId("");
    } else {
      setDraftAwayIds((ids) => ids.filter((id) => id !== playerId));
      if (draftAwayCaptainId === playerId) setDraftAwayCaptainId("");
    }
    if (strikerId === playerId || nonStrikerId === playerId || bowlerId === playerId) {
      setStrikerId("");
      setNonStrikerId("");
      setBowlerId("");
    }
  }

  function shuffleIds(ids: string[]): string[] {
    const copy = [...ids];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  function randomiseSide(side: "home" | "away") {
    if (!ctx) return;
    const squadMinCount = ctx.squadMin ?? 2;
    const squadMaxCount = ctx.squadMax ?? 15;
    const roster = ctx.rosters[side];
    if (roster.length === 0) {
      if (side === "home") {
        setDraftHomeIds([]);
        setDraftHomeCaptainId("");
      } else {
        setDraftAwayIds([]);
        setDraftAwayCaptainId("");
      }
      return;
    }
    const picks = shuffleIds(roster.map((p) => p.id)).slice(
      0,
      Math.min(squadMinCount, squadMaxCount, roster.length),
    );
    if (side === "home") {
      setDraftHomeIds(picks);
      if (draftHomeCaptainId && !picks.includes(draftHomeCaptainId)) {
        setDraftHomeCaptainId("");
      }
    } else {
      setDraftAwayIds(picks);
      if (draftAwayCaptainId && !picks.includes(draftAwayCaptainId)) {
        setDraftAwayCaptainId("");
      }
    }
  }

  function randomiseLineups() {
    randomiseSide("home");
    randomiseSide("away");
  }

  async function saveToss() {
    if (!tossWinnerId) {
      setError("Select which team won the toss");
      return;
    }
    await runAction(async () => {
      await api(`/api/v1/matches/${matchId}/toss`, {
        method: "POST",
        body: JSON.stringify({
          tossWinnerTeamId: tossWinnerId,
          electedTo,
        }),
      });
    });
  }

  async function startInnings() {
    if (!ctx?.canStartInnings) return;
    await runAction(async () => {
      await api(`/api/v1/matches/${matchId}/innings`, {
        method: "POST",
        body: JSON.stringify({
          battingTeamId: ctx.canStartInnings!.battingTeamId,
          inningsNumber: ctx.canStartInnings!.inningsNumber,
        }),
      });
      setScoringStore((s) =>
        setOnFieldPlayers(s, "", "", ""),
      );
    });
  }

  function postDelivery(payload: Record<string, unknown>) {
    if (!activeInnings || !ctx) return;
    if (!ctx.scoringLock.canScore) {
      setError(
        ctx.scoringLock.lockedByOther
          ? `${ctx.scoringLock.holderName ?? "Another manager"} is already scoring this match`
          : "Sign in as a club manager to score this match",
      );
      return;
    }
    const incomingExtrasType = payload.extrasType as DeliveryEvent["extrasType"];
    const isLegalBall = resolveScoringIsLegalBall(
      { overNumber: activeInnings.nextBall.overNumber, extrasType: incomingExtrasType },
      ctx.extrasScoring,
      ctx.totalOvers,
      payload.isLegalBall !== false,
    );
    if (
      isLegalBall &&
      activeInnings.legalBallsBowled >= maxLegalBalls(ctx.totalOvers)
    ) {
      setError(`Innings complete (${ctx.totalOvers} overs)`);
      return;
    }
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError("Pick striker, non-striker, and bowler before scoring");
      return;
    }

    const canRecord = canRecordMoreBalls(scoringStore);
    if (!canRecord.ok) {
      setError(canRecord.reason);
      return;
    }

    setError(null);
    const ballPayload: RecordBallPayload = {
      runsOffBat: Number(payload.runsOffBat ?? 0),
      extrasRuns: Number(payload.extrasRuns ?? 0),
      isLegalBall,
      extrasType: payload.extrasType as DeliveryEvent["extrasType"],
      extrasRunsType: payload.extrasRunsType as DeliveryEvent["extrasRunsType"],
      wicketType: payload.wicketType as DeliveryEvent["wicketType"],
      dismissedBatsmanId: payload.dismissedBatsmanId as string | undefined,
      fielderId: payload.fielderId as string | undefined,
    };

    setScoringStore((prev) => {
      const result = recordBallLocally(prev, ballPayload);
      queueMicrotask(() => scheduleFlush(result.flushNow, result.state));
      return result.state;
    });
    setExtrasOpen(null);

    const isEndOfOver = deliveryEndedOver(
      {
        overNumber: activeInnings.nextBall.overNumber,
        ballInOver: activeInnings.nextBall.ballInOver,
        isLegalBall,
        extrasType: ballPayload.extrasType,
      },
      scoringRulesProfile(ctx),
      ctx.totalOvers,
    );
    if (isEndOfOver && bowlingSquad.length === 2) {
      const idx = bowlingSquad.findIndex((p) => p.id === bowlerId);
      const next = bowlingSquad[(idx + 1) % bowlingSquad.length];
      if (next) setBowlerId(next.id);
    } else if (isEndOfOver && bowlingSquad.length > 2) {
      setBowlerId("");
    }
  }

  async function recordExtra(payload: Record<string, unknown>) {
    postDelivery(payload);
    setExtrasOpen(null);
    requestAnimationFrame(() => {
      scoringKeysRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function swapEnds() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  function pickStriker(id: string) {
    if (id === nonStrikerId) swapEnds();
    else setStrikerId(id);
  }

  function pickNonStriker(id: string) {
    if (id === strikerId) swapEnds();
    else setNonStrikerId(id);
  }

  function syncOnFieldPlayersFromInnings(data: MatchScoringContext) {
    setScoringStore((s) => hydrateFromContext(s, data));
  }

  const editingDelivery = useMemo(
    () =>
      editingInnings?.deliveries.find((d) => d.id === editingDeliveryId) ?? null,
    [editingInnings, editingDeliveryId],
  );

  function renderInningsBallHistory(inn: ScoringInningsView) {
    const balls = buildRecentBalls(inn.deliveries, inn.deliveries.length);
    if (!balls.length) return null;
    return (
      <div key={inn.id} className="sp-result-innings">
        <h3>
          Innings {inn.inningsNumber}: {inn.battingTeamName} — {inn.totalRuns}/
          {inn.wickets}
        </h3>
        <BallHistory
          balls={balls}
          selectedBallId={editingDeliveryId}
          onSelectBall={(id) => setEditingDeliveryId(id)}
        />
      </div>
    );
  }

  async function saveEditedDelivery(patch: DeliveryPatch) {
    if (!editingDeliveryId) return;
    const updated = await runAction(async () => {
      await api(`/api/v1/deliveries/${editingDeliveryId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    });
    setEditingDeliveryId(null);
    setExtrasOpen(null);
    setWicketOpen(false);
    if (updated) syncOnFieldPlayersFromInnings(updated);
  }

  async function recordRuns(runs: number) {
    postDelivery({ runsOffBat: runs, isLegalBall: true });
  }

  async function recordWicket() {
    const dismissed = dismissedId || strikerId;
    if (
      (wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped") &&
      !fielderId
    ) {
      setError("Select a fielder for this dismissal");
      return;
    }
    await postDelivery({
      runsOffBat: 0,
      isLegalBall: true,
      wicketType,
      dismissedBatsmanId: dismissed,
      fielderId:
        wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped"
          ? fielderId || undefined
          : undefined,
    });
    setWicketOpen(false);
    setFielderId("");
    setDismissedId("");
  }

  async function finalizeMatch() {
    setBusy(true);
    setError(null);
    try {
      await awaitQueueEmpty();
      await api(`/api/v1/matches/${matchId}/finalize`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const liveChase = useMemo(() => {
    if (!ctx?.chase || !activeInnings) return ctx?.chase ?? null;
    return {
      ...ctx.chase,
      runsNeeded: Math.max(0, ctx.chase.targetRuns - activeInnings.totalRuns),
      targetReached: activeInnings.totalRuns >= ctx.chase.targetRuns,
    };
  }, [ctx?.chase, activeInnings?.totalRuns]);

  const syncLabel =
    scoringStore.syncStatus === "saving"
      ? "Saving…"
      : scoringStore.syncStatus === "saved"
        ? "Saved"
        : scoringStore.syncStatus === "error"
          ? "Sync error — tap to retry"
          : null;
  const syncBlocked =
    hasUnsyncedDeliveries(scoringStore) || scoringStore.syncStatus === "saving";

  if (!ctx) {
    return (
      <div className="sp-wrap">
        <div className="sp-header sp-skeleton-header" aria-hidden />
        <div className="sp-skeleton-body">
          <p className="sp-muted">Loading scorer…</p>
          <p className="sp-skeleton-hint">Fetching squads, toss, and match state</p>
        </div>
        {error && <p className="sp-error">{error}</p>}
      </div>
    );
  }

  const title = `${ctx.homeTeam.name} vs ${ctx.awayTeam.name}`;
  const { homeIds: confirmHomeIds, awayIds: confirmAwayIds } = squadIdsForConfirm();
  const squadMin = ctx.squadMin ?? 2;
  const squadMax = ctx.squadMax ?? 15;
  const lineupPlayerCount = Math.max(confirmHomeIds.length, confirmAwayIds.length);
  const suggestedLineupOvers = suggestOversForFormula(
    ctx.oversPerInningsFormula,
    lineupPlayerCount > 0 ? lineupPlayerCount : ctx.playersPerSide,
  );
  const canConfirmSquads = canConfirmLineup(
    confirmHomeIds.length,
    confirmAwayIds.length,
    squadMin,
    squadMax,
  );
  const lineupBlockerHint = describeLineupBlockers({
    homeTeamName: ctx.homeTeam.name,
    awayTeamName: ctx.awayTeam.name,
    homeCount: confirmHomeIds.length,
    awayCount: confirmAwayIds.length,
    min: squadMin,
    max: squadMax,
    homeRosterEmpty: ctx.rosters.home.length === 0,
    awayRosterEmpty: ctx.rosters.away.length === 0,
  });

  return (
    <div className="sp-wrap">
      <header className="sp-header">
        <div>
          <h1>{title}</h1>
          {ctx.venue && <p>{ctx.venue}</p>}
          {ctx.toss.tossWinnerTeamId && ctx.toss.tossWinnerName && (
            <p className="sp-toss-line">
              {ctx.toss.tossWinnerName} won the toss · elected to {ctx.toss.electedTo}
            </p>
          )}
        </div>
        <div className="sp-header-links">
          {syncLabel && (
            <button
              type="button"
              className={`sp-sync-status sp-sync-${scoringStore.syncStatus}`}
              title={scoringStore.syncError ?? undefined}
              onClick={() => {
                if (scoringStore.syncStatus === "error") scheduleFlush(true);
              }}
            >
              {syncLabel}
            </button>
          )}
          <Link href={`/match/${matchId}`}>Scorecard</Link>
        </div>
      </header>

      {error && <p className="sp-error">{error}</p>}

      {ctx.scoringLock.needsSignIn && (
        <div className="sp-scoring-lock">
          <strong>Sign in to score</strong>
          Club managers must sign in before scoring. Parents can watch the{" "}
          <Link href={`/match/${matchId}`}>live scorecard</Link>.
          <p style={{ marginTop: 10 }}>
            <Link href="/login">Sign in →</Link>
          </p>
        </div>
      )}

      {ctx.scoringLock.lockedByOther && (
        <div className="sp-scoring-lock">
          <strong>Scoring locked</strong>
          {ctx.scoringLock.holderName ?? "Another manager"} is scoring this match. You can
          follow the{" "}
          <Link href={`/match/${matchId}`}>live scorecard</Link> instead.
        </div>
      )}

      <nav className="sp-steps" aria-label="Match flow">
        {(
          [
            ["1", "Toss", Boolean(ctx.toss.tossWinnerTeamId)],
            ["2", "Lineups", ctx.squadsConfirmed],
            ["3", "Score", ctx.innings.length > 0],
            ["4", "Result", ctx.status === "COMPLETED"],
          ] as [string, string, boolean][]
        ).map(([n, label, done]) => (
          <span
            key={n}
            className={`sp-step${done ? " done" : ""}`}
          >
            {n}. {label}
          </span>
        ))}
      </nav>

      {ctx.status === "COMPLETED" && (
        <div className="sp-banner done">
          Match complete —{" "}
          <Link href={`/match/${matchId}`}>view scorecard</Link>
        </div>
      )}

      {!ctx.toss.tossWinnerTeamId &&
        ctx.status !== "COMPLETED" &&
        ctx.scoringLock.canScore && (
        <section className="sp-card sp-toss">
          <h2>1. Record the toss</h2>
          <p className="sp-muted">Which team won, and what did they choose?</p>

          <p className="sp-toss-label">Toss winner</p>
          <div className="sp-toss-teams">
            {[ctx.homeTeam, ctx.awayTeam].map((team) => (
              <button
                key={team.id}
                type="button"
                className={`sp-toss-team${tossWinnerId === team.id ? " on" : ""}`}
                disabled={busy}
                onClick={() => setTossWinnerId(team.id)}
              >
                {team.name}
              </button>
            ))}
          </div>

          <p className="sp-toss-label">Winner elected to</p>
          <div className="sp-toss-choices">
            {(["bat", "bowl"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={`sp-toss-choice${electedTo === choice ? " on" : ""}`}
                disabled={busy}
                onClick={() => setElectedTo(choice)}
              >
                {choice === "bat" ? "Bat" : "Bowl"}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="sp-btn primary sp-toss-save"
            disabled={busy || !tossWinnerId}
            onClick={saveToss}
          >
            Save toss &amp; pick lineups
          </button>
        </section>
      )}

      {ctx.toss.tossWinnerTeamId &&
        !ctx.squadsConfirmed &&
        ctx.status !== "COMPLETED" &&
        ctx.scoringLock.canScore && (
        <section className="sp-card sp-roster">
          <div className="sp-section-head">
            <h2>2. Match lineups</h2>
            <button
              type="button"
              className="sp-btn sp-btn-pill"
              disabled={busy}
              onClick={randomiseLineups}
            >
              Randomise
            </button>
          </div>
          <p className="sp-muted">
            Pick players from your roster or type a name to add quickly — opponent
            names can be added right here.
          </p>
          {ctx.tournamentAgeGroup && (
            <p className="sp-muted">
              {ctx.tournamentAgeGroup} — players above age band in{" "}
              <span className="sp-over-age">red</span>.
            </p>
          )}
          <div className="sp-roster-cols">
            {(["home", "away"] as const).map((side) => {
              const teamLabel = side === "home" ? ctx.homeTeam.name : ctx.awayTeam.name;
              const roster = ctx.rosters[side];
              const selectedIds = side === "home" ? draftHomeIds : draftAwayIds;
              const captainId = side === "home" ? draftHomeCaptainId : draftAwayCaptainId;
              const selected = playersForSide(side);
              const available = roster.filter((p) => !selectedIds.includes(p.id));
              return (
                <div key={side}>
                  <h3>{teamLabel}</h3>
                  <p className="sp-roster-sub">Playing ({selected.length})</p>
                  <ul className="sp-roster-list">
                    {selected.map((p) => (
                      <li key={p.id} className={p.overAge ? "sp-over-age" : undefined}>
                        <span>
                          {p.name}
                          {captainId === p.id && <span className="sp-captain-mark"> (c)</span>}
                        </span>
                        <span className="sp-roster-actions">
                          <button
                            type="button"
                            className={`sp-roster-btn captain${captainId === p.id ? " on" : ""}`}
                            disabled={busy}
                            onClick={() => setCaptain(side, p.id)}
                          >
                            c
                          </button>
                          <button
                            type="button"
                            className="sp-roster-btn remove"
                            disabled={busy}
                            onClick={() => removeFromSquad(side, p.id)}
                          >
                            −
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="sp-roster-sub">Roster</p>
                  {roster.length === 0 ? (
                    <p className="sp-muted sp-roster-empty">
                      {side === "home"
                        ? `No club roster yet — add ${squadMin} ${squadMin === 1 ? "player" : "players"} using Add player below.`
                        : `No previous opponent players — add ${squadMin} ${squadMin === 1 ? "player" : "players"} using Add player below.`}
                    </p>
                  ) : available.length === 0 ? (
                    <p className="sp-muted sp-roster-empty">All roster players selected.</p>
                  ) : (
                  <ul className="sp-roster-list">
                    {available.map((p) => (
                      <li key={p.id}>
                        <span>{p.name}</span>
                        <button
                          type="button"
                          className="sp-roster-btn add"
                          disabled={busy || selectedIds.length >= squadMax}
                          onClick={() => addToSquad(side, p.id)}
                        >
                          +
                        </button>
                      </li>
                    ))}
                  </ul>
                  )}
                  <div className="sp-quick-add">
                    <label className="sp-quick-add-label" htmlFor={`sp-quick-add-${side}`}>
                      Add player
                    </label>
                    <div className="sp-quick-add-row">
                      <input
                        id={`sp-quick-add-${side}`}
                        type="text"
                        className="sp-quick-add-input"
                        placeholder="Player name"
                        value={quickAddName[side]}
                        disabled={busy}
                        autoComplete="off"
                        onChange={(e) =>
                          setQuickAddName((prev) => ({ ...prev, [side]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void quickAddPlayer(side);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary sp-quick-add-btn"
                        disabled={
                          busy ||
                          quickAddBusySide === side ||
                          selectedIds.length >= squadMax
                        }
                        aria-label={`Add player to ${teamLabel}`}
                        onClick={() => void quickAddPlayer(side)}
                      >
                        {quickAddBusySide === side ? "Adding…" : "Add player"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sp-overs-field">
            <label htmlFor="sp-overs-input">
              Overs per innings
              <input
                id="sp-overs-input"
                type="number"
                className="sp-overs-input"
                min={1}
                max={50}
                value={draftOvers}
                disabled={busy}
                onChange={(e) => {
                  setOversTouched(true);
                  setDraftOvers(Math.max(1, Math.min(50, Number(e.target.value) || 1)));
                }}
              />
            </label>
            <p className="sp-muted">
              {lineupPlayerCount > 0
                ? `${lineupPlayerCount} players → ${suggestedLineupOvers} overs suggested. Adjust if needed.`
                : "Pick players above — overs scale with squad size (e.g. 10 → 20)."}
            </p>
          </div>
          <button
            type="button"
            className="sp-btn primary"
            disabled={busy || !canConfirmSquads}
            onClick={confirmSquads}
          >
            Confirm lineups &amp; continue
          </button>
          {!canConfirmSquads && lineupBlockerHint && (
            <p className="sp-muted sp-lineup-hint" style={{ marginTop: 8 }}>
              {lineupBlockerHint}
            </p>
          )}
        </section>
      )}

      {ctx.squadsConfirmed &&
        ctx.toss.tossWinnerTeamId &&
        ctx.canStartInnings &&
        ctx.status !== "COMPLETED" &&
        ctx.scoringLock.canScore && (
        <section className="sp-card">
          <div className="sp-section-head">
            <h2>3. Start innings</h2>
            {ctx.canReopenSquads && (
              <button
                type="button"
                className="sp-btn sp-btn-link"
                disabled={busy}
                onClick={editSquads}
              >
                ← Edit lineups
              </button>
            )}
          </div>
          <SquadSetupRecap ctx={ctx} />
          <p>{ctx.canStartInnings.label}</p>
          {ctx.canStartInnings.inningsNumber === 2 &&
            ctx.canStartInnings.targetRuns != null && (
              <p className="sp-chase sp-chase-target">
                Target: <strong>{ctx.canStartInnings.targetRuns}</strong> runs
              </p>
            )}
          <p className="sp-muted">
            Base {ctx.startingScore} · −{ctx.wicketPenalty} per wicket
          </p>
          <button
            type="button"
            className="sp-btn primary"
            disabled={busy}
            onClick={startInnings}
          >
            Start {ctx.canStartInnings.inningsNumber === 1 ? "1st" : "2nd"} innings
          </button>
        </section>
      )}

      {ctx.canFinalize && (
        <section className="sp-card sp-result">
          <h2>4. Final result</h2>
          {ctx.suggestedResult && (
            <p className="sp-result-line">{ctx.suggestedResult.line}</p>
          )}
          <p className="sp-muted">
            Host: <strong>{ctx.homeTeam.name}</strong> (home)
          </p>
          <div className="sp-result-revise">
            <p className="sp-roster-sub">Tap a ball to correct scores before finalizing</p>
            {ctx.innings.map(renderInningsBallHistory)}
          </div>
          <button
            type="button"
            className="sp-btn primary"
            disabled={busy || syncBlocked}
            onClick={finalizeMatch}
          >
            Finalize match
          </button>
        </section>
      )}

      {ctx.status === "COMPLETED" && ctx.innings.length > 0 && (
        <section className="sp-card sp-result">
          <h2>Match result</h2>
          {ctx.suggestedResult && (
            <p className="sp-result-line">{ctx.suggestedResult.line}</p>
          )}
          <div className="sp-result-revise">
            <p className="sp-roster-sub">Tap a ball to update scores — result refreshes automatically</p>
            {ctx.innings.map(renderInningsBallHistory)}
          </div>
        </section>
      )}

      {editingDelivery && editingInnings && (
        <EditBallModal
          delivery={editingDelivery}
          battingSquad={editingSquads.batting}
          bowlingSquad={editingSquads.bowling}
          busy={busy}
          onClose={() => setEditingDeliveryId(null)}
          onSave={saveEditedDelivery}
        />
      )}

      {ctx.squadsConfirmed &&
        ctx.toss.tossWinnerTeamId &&
        activeInnings &&
        !activeInnings.complete &&
        !editingDeliveryId &&
        ctx.scoringLock.canScore && (
        <>
          <section className="sp-scoreboard">
            <div>
              <div className="sp-score-label">
                {activeInnings.battingTeamName} · Innings{" "}
                {activeInnings.inningsNumber}
              </div>
              <div className="sp-score-main">
                {activeInnings.totalRuns}
                <span className="sp-score-wkts">-{activeInnings.wickets}</span>
              </div>
              <div className="sp-score-meta">
                Net {activeInnings.netRuns > 0 ? "+" : ""}
                {activeInnings.netRuns} · {activeInnings.batRuns} off bat · Ball{" "}
                {activeInnings.lastBall
                  ? formatBallLabel(
                      activeInnings.lastBall.overNumber,
                      activeInnings.lastBall.ballInOver,
                    )
                  : "—"}{" "}
                · {activeInnings.displayOvers}/{ctx.totalOvers} ov
              </div>
              {liveChase && (
                <div className="sp-chase">
                  Need <strong>{liveChase.runsNeeded}</strong> runs to win (target{" "}
                  {liveChase.targetRuns})
                </div>
              )}
            </div>
            <div className="sp-vs">
              vs {activeInnings.bowlingTeamName}
            </div>
          </section>

          {activeInnings.recentBalls.length > 0 && (
            <section className="sp-card sp-recent">
              <p className="sp-roster-sub">Tap a ball to correct it</p>
              <BallHistory
                balls={activeInnings.recentBalls}
                selectedBallId={editingDeliveryId}
                onSelectBall={(id) => setEditingDeliveryId(id)}
              />
            </section>
          )}

          {chasePromptOpen && (
            <section className="sp-card sp-chase-prompt">
              <h3>Target reached</h3>
              <p>Chasing side has passed the target. Stop the innings or continue batting?</p>
              <div className="sp-chase-actions">
                <button type="button" className="sp-btn primary" disabled={busy} onClick={stopChaseInnings}>
                  Stop — end innings
                </button>
                <button type="button" className="sp-btn" disabled={busy} onClick={continueChase}>
                  Continue batting
                </button>
              </div>
            </section>
          )}

          <section className="sp-card sp-players">
            <h3>On the field</h3>
            <div className="sp-batsmen">
              <label className="sp-batsman-field">
                <span className="sp-batsman-label">
                  Batsman <span className="sp-on-strike">on strike</span>
                </span>
                <select
                  className={strikerId ? "sp-striker" : undefined}
                  value={strikerId}
                  disabled={busy}
                  onChange={(e) => pickStriker(e.target.value)}
                >
                  {battingSquad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="sp-strike-toggle"
                disabled={busy || !strikerId || !nonStrikerId}
                aria-label="Switch who is on strike"
                onClick={swapEnds}
              >
                ⇄
              </button>
              <label className="sp-batsman-field">
                <span className="sp-batsman-label">
                  Batsman <span className="sp-off-strike">off strike</span>
                </span>
                <select
                  value={nonStrikerId}
                  disabled={busy}
                  onChange={(e) => pickNonStriker(e.target.value)}
                >
                  {battingSquad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="sp-players-hint">
              Tap ⇄ to switch strike, or pick a different player in either slot.
            </p>
            <label>
              Bowler
              {activeInnings.bowlerLocked ? (
                <span className="sp-bowler-locked">
                  locked for over{" "}
                  {activeInnings.lastBall?.overNumber ?? activeInnings.nextBall.overNumber}
                </span>
              ) : (
                <span className="sp-bowler-pick">pick before 1st ball of over</span>
              )}
              <select
                className="sp-bowler"
                value={bowlerId}
                disabled={busy || activeInnings.bowlerLocked}
                onChange={(e) => setBowlerId(e.target.value)}
              >
                {!bowlerId && !activeInnings.bowlerLocked && (
                  <option value="">Pick bowler…</option>
                )}
                {bowlingSquad.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section ref={scoringKeysRef} className="sp-pad">
            <p className="sp-pad-label">Off the bat</p>
            <div className="sp-runs">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <button
                  key={r}
                  type="button"
                  className="sp-key run"
                  onClick={() => recordRuns(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="sp-extras">
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "wide" ? " active" : ""}`}
                onClick={() => setExtrasOpen((v) => (v === "wide" ? null : "wide"))}
              >
                Wide
              </button>
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "no_ball" ? " active" : ""}`}
                onClick={() => setExtrasOpen((v) => (v === "no_ball" ? null : "no_ball"))}
              >
                No ball
              </button>
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "bye" ? " active" : ""}`}
                onClick={() => setExtrasOpen((v) => (v === "bye" ? null : "bye"))}
              >
                Bye
              </button>
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "leg_bye" ? " active" : ""}`}
                onClick={() => setExtrasOpen((v) => (v === "leg_bye" ? null : "leg_bye"))}
              >
                Leg bye
              </button>
              <button
                type="button"
                className="sp-key wicket"
                onClick={() => {
                  setExtrasOpen(null);
                  setDismissedId(strikerId);
                  setWicketOpen((v) => !v);
                }}
              >
                Wicket
              </button>
            </div>
          </section>

          <div ref={extrasAnchorRef} className="sp-extras-anchor" />

          {extrasOpen === "wide" && (
            <section className="sp-card sp-extras-panel">
              <h3>Wide</h3>
              <p className="sp-muted">Ball missed the bat — add wide penalty and any runs run.</p>
              <button
                type="button"
                className="sp-btn"
                onClick={() =>
                  recordExtra({ runsOffBat: 0, isLegalBall: false, extrasType: "wide", extrasRuns: 0 })
                }
              >
                Wd only
              </button>
              <p className="sp-roster-sub">Wide + runs (no bat)</p>
              <div className="sp-extras-runs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    onClick={() =>
                      recordExtra({
                        runsOffBat: 0,
                        isLegalBall: false,
                        extrasType: "wide_runs",
                        extrasRuns: r,
                      })
                    }
                  >
                    Wd+{r}
                  </button>
                ))}
              </div>
            </section>
          )}

          {extrasOpen === "no_ball" && (
            <section className="sp-card sp-extras-panel">
              <h3>No ball</h3>
              <div className="sp-extras-subsection">
                <h4>Nb + byes (no bat)</h4>
                <div className="sp-extras-runs">
                  {[1, 2, 3, 4].map((r) => (
                    <button
                      key={`b-${r}`}
                      type="button"
                      className="sp-key run"
                      disabled={busy}
                      onClick={() =>
                        recordExtra({
                          runsOffBat: 0,
                          isLegalBall: false,
                          extrasType: "no_ball_runs",
                          extrasRuns: r,
                          extrasRunsType: "bye",
                        })
                      }
                    >
                      Nb+{r}b
                    </button>
                  ))}
                </div>
              </div>
              <div className="sp-extras-subsection">
                <h4>Nb + leg byes (no bat)</h4>
                <div className="sp-extras-runs">
                  {[1, 2, 3, 4].map((r) => (
                    <button
                      key={`lb-${r}`}
                      type="button"
                      className="sp-key run"
                      disabled={busy}
                      onClick={() =>
                        recordExtra({
                          runsOffBat: 0,
                          isLegalBall: false,
                          extrasType: "no_ball_runs",
                          extrasRuns: r,
                          extrasRunsType: "leg_bye",
                        })
                      }
                    >
                      Nb+{r}lb
                    </button>
                  ))}
                </div>
              </div>
              <div className="sp-extras-subsection">
                <h4>Nb only or off the bat</h4>
                <button
                  type="button"
                  className="sp-btn"
                  onClick={() =>
                    recordExtra({ runsOffBat: 0, isLegalBall: false, extrasType: "no_ball", extrasRuns: 0 })
                  }
                >
                  Nb only
                </button>
                <div className="sp-extras-runs">
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="sp-key run"
                      disabled={busy}
                      onClick={() =>
                        recordExtra({
                          runsOffBat: r,
                          isLegalBall: false,
                          extrasType: "no_ball",
                          extrasRuns: 0,
                        })
                      }
                    >
                      Nb+{r}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {(extrasOpen === "bye" || extrasOpen === "leg_bye") && (
            <section className="sp-card sp-extras-panel">
              <h3>{extrasOpen === "bye" ? "Byes" : "Leg byes"}</h3>
              <p className="sp-muted">
                Legal delivery — ball missed the bat
                {extrasOpen === "leg_bye" ? " but hit the batter's body" : ""}.
              </p>
              <div className="sp-extras-runs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    onClick={() =>
                      recordExtra({
                        runsOffBat: 0,
                        isLegalBall: true,
                        extrasType: extrasOpen,
                        extrasRuns: r,
                      })
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

          {wicketOpen && (
            <section className="sp-card sp-wicket-panel">
              <h3>Wicket</h3>
              <label>
                Type
                <select
                  value={wicketType}
                  onChange={(e) => setWicketType(e.target.value as WicketKind)}
                >
                  <option value="bowled">Bowled</option>
                  <option value="caught">Caught</option>
                  <option value="run_out">Run out</option>
                  <option value="lbw">LBW</option>
                  <option value="stumped">Stumped</option>
                </select>
              </label>
              <label>
                Out
                <select
                  value={dismissedId || strikerId}
                  onChange={(e) => setDismissedId(e.target.value)}
                >
                  {battingSquad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {(wicketType === "caught" ||
                wicketType === "run_out" ||
                wicketType === "stumped") && (
                <label>
                  Fielder
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {bowlingSquad.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="sp-btn primary"
                onClick={recordWicket}
              >
                Confirm wicket
              </button>
            </section>
          )}

          {activeInnings.complete && ctx.canStartInnings && (
            <section className="sp-card">
              <SquadSetupRecap ctx={ctx} />
              <p>Innings complete ({ctx.totalOvers} overs).</p>
              {ctx.canStartInnings.inningsNumber === 2 &&
                ctx.canStartInnings.targetRuns != null && (
                  <p className="sp-chase sp-chase-target">
                    Target to win: <strong>{ctx.canStartInnings.targetRuns}</strong> runs
                  </p>
                )}
              <button
                type="button"
                className="sp-btn primary"
                disabled={busy}
                onClick={startInnings}
              >
                {ctx.canStartInnings.label}
              </button>
            </section>
          )}
        </>
      )}

    </div>
  );
}
