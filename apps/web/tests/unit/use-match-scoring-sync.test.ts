import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { apiFetch } from "@/lib/client/api";
import type { RecordDeliveryResponse } from "@/lib/scoring/delivery-response";
import {
  hydrateFromContext,
  initialMatchScoringStoreState,
  recordBallLocally,
  type MatchScoringStoreState,
} from "@/lib/scoring/match-scoring-store";
import { flushScoringQueue } from "@/lib/scoring/use-match-scoring-sync";
import type { MatchScoringContext } from "@/lib/scoring/types";

vi.mock("@/lib/client/api", () => ({
  apiFetch: vi.fn(),
}));

function minimalCtx(): MatchScoringContext {
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
  };
}

function hydratedWithPlayers(): MatchScoringStoreState {
  let state = hydrateFromContext(initialMatchScoringStoreState, minimalCtx());
  return { ...state, strikerId: "p1", nonStrikerId: "p2", bowlerId: "p3" };
}

function mockAck(clientDeliveryId: string): RecordDeliveryResponse {
  return {
    deliveryId: "server-d1",
    clientDeliveryId,
    innings: {
      runs: 195,
      wickets: 1,
      legalBalls: 1,
      overDisplay: "0.1",
      batRuns: 0,
      netRuns: 0,
      complete: false,
    },
    nextBall: { overNumber: 1, ballInOver: 2 },
    endOfOver: false,
    chase: null,
  };
}

describe("use-match-scoring-sync", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("enqueue with flushNow true drains queue when store override is passed", async () => {
    const staleStore = hydratedWithPlayers();
    const { state: enqueued, flushNow, clientDeliveryId } = recordBallLocally(
      staleStore,
      {
        runsOffBat: 0,
        isLegalBall: true,
        wicketType: "bowled",
        dismissedBatsmanId: "p1",
      },
    );

    expect(flushNow).toBe(true);
    expect(enqueued.pendingQueue).toHaveLength(1);

    const storeRef = { current: staleStore };
    let store = staleStore;
    const setStore: Dispatch<SetStateAction<MatchScoringStoreState>> = (action) => {
      store = typeof action === "function" ? action(store) : action;
      storeRef.current = store;
    };

    vi.mocked(apiFetch).mockResolvedValue(mockAck(clientDeliveryId));

    await flushScoringQueue(storeRef, setStore, { storeOverride: enqueued });

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/deliveries", {
      method: "POST",
      body: JSON.stringify(enqueued.pendingQueue[0]!.payload),
    });
    expect(store.pendingQueue).toHaveLength(0);
    expect(store.syncStatus).toBe("saved");
  });
});
