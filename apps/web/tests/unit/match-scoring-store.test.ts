import { describe, expect, it } from "vitest";
import {
  hydrateFromContext,
  initialMatchScoringStoreState,
  recordBallLocally,
  scoringRulesProfileFromContext,
} from "@/lib/scoring/match-scoring-store";
import type { MatchScoringContext } from "@/lib/scoring/types";

function minimalCtx(overrides: Partial<MatchScoringContext> = {}): MatchScoringContext {
  return {
    matchId: "m1",
    status: "LIVE",
    hostTeamId: "home-tt",
    squadsConfirmed: true,
    canReopenSquads: false,
    chaseContinuedAfterTarget: false,
    toss: {
      tossWinnerTeamId: "home-tt",
      tossWinnerName: "Home",
      electedTo: "bat",
      tossCallerPlayerId: null,
      tossCallerName: null,
      battingFirstTeamId: "home-tt",
    },
    homeTeam: { id: "home-tt", name: "Home", teamId: "home-org" },
    awayTeam: { id: "away-tt", name: "Away", teamId: "away-org" },
    playersPerSide: 8,
    squadMin: 2,
    squadMax: 15,
    oversPerInningsFormula: "2 * playersPerSide",
    totalOvers: 4,
    matchTotalOvers: 4,
    pairOvers: 4,
    startingScore: 200,
    wicketPenalty: 5,
    rotateStrikeAfterWicket: true,
    extrasScoring: {
      wide: { default: { rebowl: true }, lastOver: { rebowl: false } },
      noBall: { default: { rebowl: true }, lastOver: { rebowl: false } },
    },
    tournamentAgeGroup: null,
    squads: { home: [], away: [] },
    rosters: { home: [], away: [] },
    innings: [
      {
        id: "inn1",
        inningsNumber: 1,
        battingTeamId: "home-tt",
        battingTeamName: "Home",
        bowlingTeamName: "Away",
        totalRuns: 200,
        wickets: 0,
        batRuns: 0,
        netRuns: 0,
        oversBowled: 0,
        legalBallsBowled: 0,
        displayOvers: "0.0",
        deliveryCount: 0,
        complete: false,
        nextBall: { overNumber: 1, ballInOver: 1 },
        lastBall: null,
        recentBalls: [],
        deliveries: [],
        bowlerLocked: false,
        lockedBowlerId: null,
      },
    ],
    activeInningsId: "inn1",
    canStartInnings: null,
    canFinalize: false,
    chase: null,
    suggestedResult: null,
    scoringLock: {
      requiresAuth: false,
      needsSignIn: false,
      canScore: true,
      lockedByOther: false,
      isHolder: true,
      holderUserId: "u1",
      holderName: "Scorer",
      claimedAt: null,
    },
    ...overrides,
  };
}

describe("match-scoring-store", () => {
  it("hydrates live innings from scoring context", () => {
    const ctx = minimalCtx();
    const next = hydrateFromContext(initialMatchScoringStoreState, ctx);
    expect(next.liveInnings?.inningsId).toBe("inn1");
    expect(next.liveInnings?.totalRuns).toBe(200);
    expect(next.rulesProfile).toEqual(scoringRulesProfileFromContext(ctx));
  });

  it("recordBallLocally updates totals and enqueues pending delivery", () => {
    const ctx = minimalCtx();
    let state = hydrateFromContext(initialMatchScoringStoreState, ctx);
    state = {
      ...state,
      strikerId: "p1",
      nonStrikerId: "p2",
      bowlerId: "p3",
    };

    const { state: after, flushNow, clientDeliveryId } = recordBallLocally(state, {
      runsOffBat: 4,
      isLegalBall: true,
    });

    expect(clientDeliveryId).toBeTruthy();
    expect(after.liveInnings?.totalRuns).toBe(204);
    expect(after.liveInnings?.batRuns).toBe(4);
    expect(after.pendingQueue).toHaveLength(1);
    expect(after.pendingQueue[0]?.clientDeliveryId).toBe(clientDeliveryId);
    expect(after.syncStatus).toBe("saving");
    expect(flushNow).toBe(false);
  });

  it("flushes immediately on wicket", () => {
    const ctx = minimalCtx();
    let state = hydrateFromContext(initialMatchScoringStoreState, ctx);
    state = { ...state, strikerId: "p1", nonStrikerId: "p2", bowlerId: "p3" };

    const { flushNow, state: after } = recordBallLocally(state, {
      runsOffBat: 0,
      isLegalBall: true,
      wicketType: "bowled",
      dismissedBatsmanId: "p1",
    });

    expect(flushNow).toBe(true);
    expect(after.liveInnings?.wickets).toBe(1);
    expect(after.liveInnings?.totalRuns).toBe(195);
  });
});
