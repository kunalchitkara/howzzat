import {
  applyStrikeRotationsAfterDelivery,
  finalizeInnings,
  replayInnings,
  type DeliveryEvent,
  type RulesProfile,
} from "@howzzat/rules-engine";
import {
  countLegalBalls,
  currentOverBowler,
  deliveryEndedOver,
  formatOversFromLegalBalls,
  isInningsComplete,
  lastBallAfterDeliveries,
  maxLegalBalls,
  nextBallAfterDeliveries,
} from "@/lib/scoring/ball-position";
import { deliverySymbol } from "@/lib/scoring/delivery-symbol";
import type { RecordDeliveryResponse } from "@/lib/scoring/delivery-response";
import { buildRecentBalls } from "@/lib/scoring/recent-balls";
import { deliveryToEvent } from "@/lib/services/match-utils";
import type {
  MatchScoringContext,
  RecentBallBubble,
  ScoringDeliveryView,
  ScoringInningsView,
} from "@/lib/scoring/types";

export type SyncStatus = "idle" | "saving" | "saved" | "error";

export interface PendingDelivery {
  clientDeliveryId: string;
  payload: Record<string, unknown>;
  status: "pending" | "inflight" | "failed";
  error?: string;
  flushNow: boolean;
}

export interface LiveInningsState {
  inningsId: string;
  inningsNumber: number;
  battingTeamId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  totalRuns: number;
  wickets: number;
  batRuns: number;
  netRuns: number;
  legalBallsBowled: number;
  displayOvers: string;
  complete: boolean;
  nextBall: { overNumber: number; ballInOver: number };
  lastBall: { overNumber: number; ballInOver: number } | null;
  recentBalls: RecentBallBubble[];
  deliveries: ScoringDeliveryView[];
  bowlerLocked: boolean;
  lockedBowlerId: string | null;
}

export interface MatchScoringStoreState {
  liveInnings: LiveInningsState | null;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  pendingQueue: PendingDelivery[];
  syncStatus: SyncStatus;
  syncError: string | null;
  rulesProfile: RulesProfile | null;
  totalOvers: number;
  playersPerSide: number;
  rotateStrikeAfterWicket: boolean;
}

export const initialMatchScoringStoreState: MatchScoringStoreState = {
  liveInnings: null,
  strikerId: "",
  nonStrikerId: "",
  bowlerId: "",
  pendingQueue: [],
  syncStatus: "idle",
  syncError: null,
  rulesProfile: null,
  totalOvers: 20,
  playersPerSide: 8,
  rotateStrikeAfterWicket: true,
};

export function scoringRulesProfileFromContext(
  ctx: MatchScoringContext,
): RulesProfile {
  return {
    startingScore: ctx.startingScore,
    wicketPenalty: ctx.wicketPenalty,
    rotateStrikeAfterWicket: ctx.rotateStrikeAfterWicket,
    playersPerSide: { min: ctx.squadMin ?? 2, max: ctx.squadMax ?? 15 },
    scoring: {
      wide: ctx.extrasScoring.wide,
      noBall: ctx.extrasScoring.noBall,
      runsOffBat: { min: 0, max: 6 },
      extrasRuns: { min: 0, max: 6 },
    },
    format: "pairs",
  } as unknown as RulesProfile;
}

function computeLiveInnings(
  innings: ScoringInningsView,
  profile: RulesProfile,
  totalOvers: number,
  playersPerSide: number,
): LiveInningsState {
  const events = innings.deliveries.map(deliveryToEvent);
  const state = replayInnings(
    profile,
    { playersPerSide, totalOvers },
    events,
  );
  const totals = finalizeInnings(state, profile);
  const legalBallsBowled = countLegalBalls(innings.deliveries);
  const complete = isInningsComplete(innings.deliveries, totalOvers, null);
  const nextBall = nextBallAfterDeliveries(innings.deliveries, totalOvers);
  const lastBall = lastBallAfterDeliveries(innings.deliveries);
  const { locked: bowlerLocked, bowlerId: lockedBowlerId } = currentOverBowler(
    innings.deliveries.map((d) => ({
      overNumber: d.overNumber,
      ballInOver: d.ballInOver,
      bowlerId: d.bowlerId,
      isLegalBall: d.isLegalBall,
      extrasType: d.extrasType,
    })),
    nextBall,
    { profile, totalOvers },
  );

  return {
    inningsId: innings.id,
    inningsNumber: innings.inningsNumber,
    battingTeamId: innings.battingTeamId,
    battingTeamName: innings.battingTeamName,
    bowlingTeamName: innings.bowlingTeamName,
    totalRuns: totals.totalRuns,
    wickets: totals.wickets,
    batRuns: totals.batRuns,
    netRuns: totals.netRuns,
    legalBallsBowled,
    displayOvers: complete
      ? `${totalOvers}.0`
      : formatOversFromLegalBalls(legalBallsBowled),
    complete,
    nextBall,
    lastBall,
    recentBalls: buildRecentBalls(innings.deliveries),
    deliveries: innings.deliveries,
    bowlerLocked,
    lockedBowlerId,
  };
}

export function hydrateFromContext(
  state: MatchScoringStoreState,
  ctx: MatchScoringContext,
): MatchScoringStoreState {
  const profile = scoringRulesProfileFromContext(ctx);
  const active = ctx.innings.find((i) => i.id === ctx.activeInningsId) ?? null;
  if (!active || active.complete) {
    return {
      ...state,
      liveInnings: active
        ? computeLiveInnings(active, profile, ctx.totalOvers, ctx.playersPerSide)
        : null,
      rulesProfile: profile,
      totalOvers: ctx.totalOvers,
      playersPerSide: ctx.playersPerSide,
      rotateStrikeAfterWicket: ctx.rotateStrikeAfterWicket,
      pendingQueue: [],
      syncStatus: "idle",
      syncError: null,
    };
  }

  const liveInnings = computeLiveInnings(
    active,
    profile,
    ctx.totalOvers,
    ctx.playersPerSide,
  );
  let strikerId = state.strikerId;
  let nonStrikerId = state.nonStrikerId;
  let bowlerId = state.bowlerId;

  if (active.deliveries.length > 0) {
    const events = active.deliveries.map(deliveryToEvent);
    let s = events[0]!.strikerId;
    let ns = events[0]!.nonStrikerId;
    for (const event of events) {
      [s, ns] = applyStrikeRotationsAfterDelivery(s, ns, event, {
        rotateStrikeAfterWicket: ctx.rotateStrikeAfterWicket,
      });
    }
    strikerId = s;
    nonStrikerId = ns;
    if (!active.bowlerLocked) {
      const last = active.deliveries[active.deliveries.length - 1];
      if (last) bowlerId = last.bowlerId;
    } else if (active.lockedBowlerId) {
      bowlerId = active.lockedBowlerId;
    }
  }

  return {
    ...state,
    liveInnings,
    strikerId,
    nonStrikerId,
    bowlerId,
    rulesProfile: profile,
    totalOvers: ctx.totalOvers,
    playersPerSide: ctx.playersPerSide,
    rotateStrikeAfterWicket: ctx.rotateStrikeAfterWicket,
    pendingQueue: [],
    syncStatus: "idle",
    syncError: null,
  };
}

export interface RecordBallPayload {
  runsOffBat: number;
  extrasRuns?: number;
  isLegalBall: boolean;
  extrasType?: DeliveryEvent["extrasType"];
  extrasRunsType?: DeliveryEvent["extrasRunsType"];
  wicketType?: DeliveryEvent["wicketType"];
  dismissedBatsmanId?: string;
  fielderId?: string;
}

export interface RecordBallLocallyResult {
  state: MatchScoringStoreState;
  flushNow: boolean;
  clientDeliveryId: string;
}

export function recordBallLocally(
  state: MatchScoringStoreState,
  payload: RecordBallPayload,
): RecordBallLocallyResult {
  const live = state.liveInnings;
  const profile = state.rulesProfile;
  if (!live || !profile) {
    return { state, flushNow: false, clientDeliveryId: "" };
  }

  const clientDeliveryId = crypto.randomUUID();
  const ball = live.nextBall;
  const deliveryView: ScoringDeliveryView = {
    id: clientDeliveryId,
    sequence: live.deliveries.length + 1,
    overNumber: ball.overNumber,
    ballInOver: ball.ballInOver,
    symbol: deliverySymbol({
      runsOffBat: payload.runsOffBat,
      extrasType: payload.extrasType,
      extrasRuns: payload.extrasRuns,
      extrasRunsType: payload.extrasRunsType,
      wicketType: payload.wicketType,
    }),
    runsOffBat: payload.runsOffBat,
    isLegalBall: payload.isLegalBall,
    extrasType: payload.extrasType ?? null,
    extrasRuns: payload.extrasRuns ?? 0,
    extrasRunsType: payload.extrasRunsType ?? null,
    wicketType: payload.wicketType ?? null,
    strikerId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: state.bowlerId,
    fielderId: payload.fielderId ?? null,
    dismissedBatsmanId: payload.dismissedBatsmanId ?? null,
  };

  const deliveries = [...live.deliveries, deliveryView];
  const inningsView: ScoringInningsView = {
    id: live.inningsId,
    inningsNumber: live.inningsNumber,
    battingTeamId: live.battingTeamId,
    battingTeamName: live.battingTeamName,
    bowlingTeamName: live.bowlingTeamName,
    totalRuns: 0,
    wickets: 0,
    batRuns: 0,
    netRuns: 0,
    oversBowled: 0,
    legalBallsBowled: 0,
    displayOvers: "0.0",
    deliveryCount: deliveries.length,
    complete: false,
    nextBall: ball,
    lastBall: null,
    recentBalls: [],
    deliveries,
    bowlerLocked: false,
    lockedBowlerId: null,
  };

  const updatedLive = computeLiveInnings(
    inningsView,
    profile,
    state.totalOvers,
    state.playersPerSide,
  );

  const event: DeliveryEvent = {
    overNumber: ball.overNumber,
    ballInOver: ball.ballInOver,
    strikerId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: state.bowlerId,
    runsOffBat: payload.runsOffBat,
    extrasRuns: payload.extrasRuns ?? 0,
    isLegalBall: payload.isLegalBall,
    extrasType: payload.extrasType,
    extrasRunsType: payload.extrasRunsType,
    wicketType: payload.wicketType,
    dismissedBatsmanId: payload.dismissedBatsmanId,
    fielderId: payload.fielderId,
  };

  const [nextStriker, nextNonStriker] = applyStrikeRotationsAfterDelivery(
    state.strikerId,
    state.nonStrikerId,
    event,
    { rotateStrikeAfterWicket: state.rotateStrikeAfterWicket },
  );

  const endOfOver = deliveryEndedOver(
    {
      overNumber: ball.overNumber,
      ballInOver: ball.ballInOver,
      isLegalBall: payload.isLegalBall,
      extrasType: payload.extrasType,
    },
    profile,
    state.totalOvers,
  );
  const flushNow = Boolean(payload.wicketType) || endOfOver;

  const apiPayload: Record<string, unknown> = {
    inningsId: live.inningsId,
    clientDeliveryId,
    overNumber: ball.overNumber,
    ballInOver: ball.ballInOver,
    extrasRuns: 0,
    strikerId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: state.bowlerId,
    ...payload,
  };

  const pending: PendingDelivery = {
    clientDeliveryId,
    payload: apiPayload,
    status: "pending",
    flushNow,
  };

  return {
    state: {
      ...state,
      liveInnings: updatedLive,
      strikerId: nextStriker,
      nonStrikerId: nextNonStriker,
      pendingQueue: [...state.pendingQueue, pending],
      syncStatus: "saving",
      syncError: null,
    },
    flushNow,
    clientDeliveryId,
  };
}

export function applyServerAck(
  state: MatchScoringStoreState,
  clientDeliveryId: string,
  ack: RecordDeliveryResponse,
): MatchScoringStoreState {
  const queue = state.pendingQueue.filter((p) => p.clientDeliveryId !== clientDeliveryId);
  const live = state.liveInnings;
  if (!live) {
    return {
      ...state,
      pendingQueue: queue,
      syncStatus: queue.length === 0 ? "saved" : state.syncStatus,
    };
  }

  const deliveries = live.deliveries.map((d) =>
    d.id === clientDeliveryId ? { ...d, id: ack.deliveryId } : d,
  );

  const updatedLive: LiveInningsState = {
    ...live,
    totalRuns: ack.innings.runs,
    wickets: ack.innings.wickets,
    batRuns: ack.innings.batRuns,
    netRuns: ack.innings.netRuns,
    legalBallsBowled: ack.innings.legalBalls,
    displayOvers: ack.innings.overDisplay,
    complete: ack.innings.complete,
    nextBall: ack.nextBall,
    lastBall: live.lastBall ?? {
      overNumber: ballBeforeAck(live, ack).overNumber,
      ballInOver: ballBeforeAck(live, ack).ballInOver,
    },
    deliveries,
    recentBalls: buildRecentBalls(deliveries),
  };

  const hasPending = queue.some(
    (p) => p.status === "pending" || p.status === "inflight",
  );
  const hasFailed = queue.some((p) => p.status === "failed");

  return {
    ...state,
    liveInnings: updatedLive,
    pendingQueue: queue,
    syncStatus: hasPending ? "saving" : hasFailed ? "error" : "saved",
    syncError: hasFailed ? state.syncError : null,
  };
}

function ballBeforeAck(
  live: LiveInningsState,
  ack: RecordDeliveryResponse,
): { overNumber: number; ballInOver: number } {
  if (live.deliveries.length === 0) return ack.nextBall;
  const last = live.deliveries[live.deliveries.length - 1]!;
  return { overNumber: last.overNumber, ballInOver: last.ballInOver };
}

export function markDeliveryFailed(
  state: MatchScoringStoreState,
  clientDeliveryId: string,
  error: string,
): MatchScoringStoreState {
  return {
    ...state,
    pendingQueue: state.pendingQueue.map((p) =>
      p.clientDeliveryId === clientDeliveryId
        ? { ...p, status: "failed" as const, error }
        : p,
    ),
    syncStatus: "error",
    syncError: error,
  };
}

export function markDeliveryInflight(
  state: MatchScoringStoreState,
  clientDeliveryId: string,
): MatchScoringStoreState {
  return {
    ...state,
    pendingQueue: state.pendingQueue.map((p) =>
      p.clientDeliveryId === clientDeliveryId
        ? { ...p, status: "inflight" as const }
        : p,
    ),
    syncStatus: "saving",
  };
}

export function setOnFieldPlayers(
  state: MatchScoringStoreState,
  strikerId: string,
  nonStrikerId: string,
  bowlerId: string,
): MatchScoringStoreState {
  return { ...state, strikerId, nonStrikerId, bowlerId };
}

export function hasPendingDeliveries(state: MatchScoringStoreState): boolean {
  return state.pendingQueue.some(
    (p) => p.status === "pending" || p.status === "inflight",
  );
}

export function canRecordMoreBalls(
  state: MatchScoringStoreState,
): { ok: true } | { ok: false; reason: string } {
  const live = state.liveInnings;
  if (!live) return { ok: false, reason: "No active innings" };
  if (live.complete) {
    return { ok: false, reason: `Innings complete (${state.totalOvers} overs)` };
  }
  if (live.legalBallsBowled >= maxLegalBalls(state.totalOvers)) {
    return { ok: false, reason: `Innings complete (${state.totalOvers} overs)` };
  }
  return { ok: true };
}
