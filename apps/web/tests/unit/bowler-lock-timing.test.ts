import { describe, expect, it } from "vitest";
import { getBuiltinProfile } from "@howzzat/rules-engine";
import {
  currentOverBowler,
  lastBallAfterDeliveries,
  nextBallAfterDeliveries,
} from "@/lib/scoring/ball-position";
import { resolveScoringIsLegalBall } from "@/lib/scoring/delivery-legal";
import { buildRecentBalls } from "@/lib/scoring/recent-balls";

const u9Profile = getBuiltinProfile("u9-softball-london-v1")!;
const u9Extras = u9Profile.scoring;

type Row = {
  id: string;
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
  bowlerId: string;
  runsOffBat: number;
  extrasType: string | null;
  extrasRuns: number;
  wicketType: string | null;
};

function lockState(deliveries: Row[], totalOvers: number) {
  const nextBall = nextBallAfterDeliveries(deliveries, totalOvers);
  return {
    nextBall,
    last: lastBallAfterDeliveries(deliveries),
    lock: currentOverBowler(deliveries, nextBall, {
      profile: u9Profile,
      totalOvers,
    }),
  };
}

describe("bowler lock timing at end of over", () => {
  it("unlocks bowler immediately after over 1 ends (U9 extras over)", () => {
    const deliveries: Row[] = [];
    const extras = { wide: u9Extras.wide, noBall: u9Extras.noBall };
    let seq = 0;

    function record(partial: {
      runsOffBat?: number;
      extrasType?: string | null;
      extrasRuns?: number;
      clientLegal?: boolean;
    }) {
      const next = nextBallAfterDeliveries(deliveries, 4);
      const isLegalBall = resolveScoringIsLegalBall(
        { overNumber: next.overNumber, extrasType: partial.extrasType as never },
        extras,
        4,
        partial.clientLegal ?? !partial.extrasType,
      );
      deliveries.push({
        id: `d${++seq}`,
        overNumber: next.overNumber,
        ballInOver: next.ballInOver,
        isLegalBall,
        bowlerId: "b1",
        runsOffBat: partial.runsOffBat ?? 0,
        extrasType: partial.extrasType ?? null,
        extrasRuns: partial.extrasRuns ?? 0,
        wicketType: null,
      });
      return lockState(deliveries, 4);
    }

    record({ runsOffBat: 6 });
    record({ extrasType: "wide_runs", extrasRuns: 1, clientLegal: false });
    record({ extrasType: "no_ball_runs", extrasRuns: 3, clientLegal: false });
    record({ runsOffBat: 2 });
    record({ extrasType: "leg_bye", extrasRuns: 4, clientLegal: true });
    const afterOver1 = record({ runsOffBat: 6 });

    expect(afterOver1.nextBall).toEqual({ overNumber: 2, ballInOver: 1 });
    expect(afterOver1.lock).toEqual({ locked: false, bowlerId: null });

    const recent = buildRecentBalls(deliveries);
    const over1End = recent.find((b) => b.isOverEnd);
    expect(over1End?.ballInOver).toBe(6);
  });

  it("unlocks after over 2 ball 6, stays locked through ball 5", () => {
    const deliveries: Row[] = [];
    let seq = 0;

    function record(partial: {
      runsOffBat?: number;
      extrasType?: string | null;
      extrasRuns?: number;
    }) {
      const next = nextBallAfterDeliveries(deliveries, 4);
      const isLegalBall = resolveScoringIsLegalBall(
        { overNumber: next.overNumber, extrasType: partial.extrasType as never },
        { wide: u9Extras.wide, noBall: u9Extras.noBall },
        4,
        !partial.extrasType,
      );
      deliveries.push({
        id: `d${++seq}`,
        overNumber: next.overNumber,
        ballInOver: next.ballInOver,
        isLegalBall,
        bowlerId: "b1",
        runsOffBat: partial.runsOffBat ?? 0,
        extrasType: partial.extrasType ?? null,
        extrasRuns: partial.extrasRuns ?? 0,
        wicketType: null,
      });
      return lockState(deliveries, 4);
    }

    for (let i = 0; i < 6; i++) record({ runsOffBat: 1 });
    for (const runs of [3, 6, 4, 0, 1]) record({ runsOffBat: runs });
    const afterO2b5 = lockState(deliveries, 4);
    expect(afterO2b5.lock.locked).toBe(true);

    const afterO2b6 = record({ runsOffBat: 2 });
    expect(afterO2b6.nextBall).toEqual({ overNumber: 3, ballInOver: 1 });
    expect(afterO2b6.lock).toEqual({ locked: false, bowlerId: null });

    const afterO3b1 = record({ runsOffBat: 1 });
    expect(afterO3b1.lock.locked).toBe(true);
  });

  it("unlocks when six counting balls are bowled even if nextBall repeats", () => {
    const deliveries = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `o1-${i}`,
        overNumber: 1,
        ballInOver: i + 1,
        isLegalBall: true,
        bowlerId: "b1",
        runsOffBat: 1,
        extrasType: null,
        extrasRuns: 0,
        wicketType: null,
      })),
      {
        id: "o1-6",
        overNumber: 1,
        ballInOver: 6,
        isLegalBall: true,
        bowlerId: "b1",
        runsOffBat: 4,
        extrasType: null,
        extrasRuns: 0,
        wicketType: null,
      },
    ];

    const afterOver1 = lockState(deliveries, 4);
    expect(afterOver1.nextBall).toEqual({ overNumber: 2, ballInOver: 1 });
    expect(afterOver1.lock).toEqual({ locked: false, bowlerId: null });
  });
});
